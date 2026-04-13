import type {
  CalendarExdates,
  CalendarTemporalValue,
  CalendarTimeContext,
  CalendarVEvent,
} from "./calendarMapper";

const PROD_ID = "-//TADOI//Calendar Export//EN";
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type RenderCalendarOptions = {
  events: CalendarVEvent[];
  timeContext: CalendarTimeContext;
};

const ZONED_DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TZ_NAME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  return Number(value ?? "0");
}

function getZonedFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = ZONED_DATE_TIME_FORMATTERS.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  ZONED_DATE_TIME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function getTimeZoneNameFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = TZ_NAME_FORMATTERS.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  });
  TZ_NAME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  return {
    year: getPart(parts, "year"),
    month: getPart(parts, "month"),
    day: getPart(parts, "day"),
    hour: getPart(parts, "hour"),
    minute: getPart(parts, "minute"),
    second: getPart(parts, "second"),
  };
}

function formatIcsDateTime(parts: ZonedDateParts): string {
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}T${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}`;
}

function getTimeZoneOffsetMinutes(epochMs: number, timeZone: string): number {
  const parts = getZonedParts(new Date(epochMs), timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - epochMs) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${pad2(hours)}${pad2(mins)}`;
}

function getTimeZoneName(epochMs: number, timeZone: string): string {
  const parts = getTimeZoneNameFormatter(timeZone).formatToParts(
    new Date(epochMs),
  );
  const raw = parts.find((part) => part.type === "timeZoneName")?.value;
  return raw ? raw.replace(/\s+/g, "") : timeZone;
}

function findOffsetChange(
  timeZone: string,
  lowMs: number,
  highMs: number,
  offsetAtLow: number,
): number {
  let low = lowMs;
  let high = highMs;
  while (high - low > 60000) {
    const mid = Math.floor((low + high) / 2);
    const offset = getTimeZoneOffsetMinutes(mid, timeZone);
    if (offset === offsetAtLow) {
      low = mid + 1000;
    } else {
      high = mid;
    }
  }
  return high;
}

type TzTransition = {
  kind: "STANDARD" | "DAYLIGHT";
  dtstart: string;
  from: number;
  to: number;
  tzName: string;
};

function getTransitionsForRange(
  timeZone: string,
  startYear: number,
  endYear: number,
): TzTransition[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const transitions: TzTransition[] = [];
  let cursor = Date.UTC(startYear, 0, 1, 0, 0, 0);
  const end = Date.UTC(endYear + 1, 0, 1, 0, 0, 0);
  let previousOffset = getTimeZoneOffsetMinutes(cursor, timeZone);
  let previousCursor = cursor;

  for (cursor += dayMs; cursor <= end; cursor += dayMs) {
    const nextOffset = getTimeZoneOffsetMinutes(cursor, timeZone);
    if (nextOffset !== previousOffset) {
      const transitionMs = findOffsetChange(
        timeZone,
        previousCursor,
        cursor,
        previousOffset,
      );
      const beforeOffset = getTimeZoneOffsetMinutes(
        Math.max(0, transitionMs - 60000),
        timeZone,
      );
      const afterOffset = getTimeZoneOffsetMinutes(
        transitionMs + 60000,
        timeZone,
      );
      const kind = afterOffset > beforeOffset ? "DAYLIGHT" : "STANDARD";
      const dtstart = formatIcsDateTime(
        getZonedParts(new Date(transitionMs), timeZone),
      );
      const tzName = getTimeZoneName(transitionMs + 60000, timeZone);
      transitions.push({
        kind,
        dtstart,
        from: beforeOffset,
        to: afterOffset,
        tzName,
      });
      previousOffset = nextOffset;
    }
    previousCursor = cursor;
  }

  return transitions;
}

function buildVTimezoneLines(
  timeZone: string,
  events: CalendarVEvent[],
): string[] {
  const eventYears = events
    .map((event) => Number(event.dtstart.value.slice(0, 4)))
    .filter((value) => Number.isFinite(value));
  const currentYear = new Date().getUTCFullYear();
  const anchorYear =
    eventYears.length > 0 ? Math.min(...eventYears) : currentYear;
  const minYear = anchorYear - 1;
  const maxYear =
    (eventYears.length > 0 ? Math.max(...eventYears) : currentYear) + 1;

  const transitions = getTransitionsForRange(timeZone, minYear, maxYear);

  const lines = ["BEGIN:VTIMEZONE", `TZID:${timeZone}`];

  if (transitions.length === 0) {
    const offset = getTimeZoneOffsetMinutes(
      Date.UTC(anchorYear, 0, 1, 0, 0, 0),
      timeZone,
    );
    const name = getTimeZoneName(Date.UTC(anchorYear, 0, 1, 0, 0, 0), timeZone);
    lines.push("BEGIN:STANDARD");
    lines.push(`DTSTART:${anchorYear}0101T000000`);
    lines.push(`TZOFFSETFROM:${formatOffset(offset)}`);
    lines.push(`TZOFFSETTO:${formatOffset(offset)}`);
    lines.push(`TZNAME:${name}`);
    lines.push("END:STANDARD");
    lines.push("END:VTIMEZONE");
    return lines;
  }

  for (const transition of transitions) {
    lines.push(`BEGIN:${transition.kind}`);
    lines.push(`DTSTART:${transition.dtstart}`);
    lines.push(`TZOFFSETFROM:${formatOffset(transition.from)}`);
    lines.push(`TZOFFSETTO:${formatOffset(transition.to)}`);
    lines.push(`TZNAME:${transition.tzName}`);
    lines.push(`END:${transition.kind}`);
  }

  lines.push("END:VTIMEZONE");
  return lines;
}

function renderTemporalLine(
  name: string,
  value: CalendarTemporalValue,
): string {
  if (value.kind === "date") {
    return `${name};VALUE=DATE:${value.value}`;
  }
  if (value.utc) {
    return `${name}:${value.value}`;
  }
  if (value.tzid) {
    return `${name};TZID=${value.tzid}:${value.value}`;
  }
  return `${name}:${value.value}`;
}

function renderExdateLine(exdates: CalendarExdates): string {
  if (exdates.kind === "date") {
    return `EXDATE;VALUE=DATE:${exdates.values.join(",")}`;
  }
  if (exdates.utc) {
    return `EXDATE:${exdates.values.join(",")}`;
  }
  if (exdates.tzid) {
    return `EXDATE;TZID=${exdates.tzid}:${exdates.values.join(",")}`;
  }
  return `EXDATE:${exdates.values.join(",")}`;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > 75 && current.length > 0) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
      continue;
    }
    current += char;
    currentBytes += charBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.join("\r\n ");
}

function sanitizeIcsUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARS_RE.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function renderEventLines(event: CalendarVEvent): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${escapeIcsText(event.uid)}`];

  if (event.xTaskId) {
    lines.push(`X-TADOI-TASK-ID:${escapeIcsText(event.xTaskId)}`);
  }
  if (event.xSeriesId) {
    lines.push(`X-TADOI-SERIES-ID:${escapeIcsText(event.xSeriesId)}`);
  }
  if (event.xInstanceOf) {
    lines.push(`X-TADOI-INSTANCE-OF:${escapeIcsText(event.xInstanceOf)}`);
  }

  lines.push(
    `DTSTAMP:${event.dtstampUtc}`,
    renderTemporalLine("DTSTART", event.dtstart),
    renderTemporalLine("DTEND", event.dtend),
  );

  if (event.rrule) {
    lines.push(event.rrule);
  }
  if (event.exdates && event.exdates.values.length > 0) {
    lines.push(renderExdateLine(event.exdates));
  }

  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.categories.length > 0) {
    lines.push(
      `CATEGORIES:${event.categories.map((value) => escapeIcsText(value)).join(",")}`,
    );
  }
  if (event.url) {
    const sanitizedUrl = sanitizeIcsUrl(event.url);
    if (sanitizedUrl) {
      lines.push(`URL:${sanitizedUrl}`);
    }
  }
  lines.push(`TRANSP:${event.transp}`);
  if (event.relatedTo) {
    lines.push(`RELATED-TO:${escapeIcsText(event.relatedTo)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

export function renderIcsCalendar(options: RenderCalendarOptions): string {
  const sortedEvents = [...options.events].sort((left, right) => {
    const keyDiff = left.sortKey.localeCompare(right.sortKey);
    if (keyDiff !== 0) return keyDiff;
    return left.uid.localeCompare(right.uid);
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:TADOI",
  ];

  if (options.timeContext.mode === "tzid") {
    lines.push(`X-WR-TIMEZONE:${options.timeContext.timeZone}`);
    lines.push(
      ...buildVTimezoneLines(options.timeContext.timeZone, sortedEvents),
    );
  }

  for (const event of sortedEvents) {
    lines.push(...renderEventLines(event));
  }

  lines.push("END:VCALENDAR");
  return lines.map((line) => foldIcsLine(line)).join("\r\n") + "\r\n";
}
