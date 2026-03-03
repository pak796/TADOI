import { formatDateToLocalIso } from "../domain/recurrence/rruleAdapter";

export class IcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsParseError";
  }
}

export type ParsedIcsTemporalValue = {
  kind: "date" | "date-time";
  raw: string;
  tzid?: string;
  isUtc: boolean;
  epochMs: number;
  localIso: string;
};

export type ParsedIcsEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  categories: string[];
  url?: string;
  dtstart?: ParsedIcsTemporalValue;
  dtend?: ParsedIcsTemporalValue;
  rrule?: string;
  exdates: ParsedIcsTemporalValue[];
  rdates: ParsedIcsTemporalValue[];
  recurrenceId?: ParsedIcsTemporalValue;
  status?: string;
  relatedTo?: string;
  xTaskId?: string;
  xSeriesId?: string;
  xInstanceOf?: string;
};

export type ParsedIcsCalendar = {
  calendarTimeZone?: string;
  events: ParsedIcsEvent[];
};

type ParsedLine = {
  name: string;
  params: Record<string, string[]>;
  value: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const ZONED_DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeTzid(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = unquote(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function splitCommaValues(value: string): string[] {
  const values: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }
    if (char === ",") {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

export function unescapeIcsText(value: string): string {
  return value
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function unfoldIcsLines(content: string): string[] {
  const rawLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
      continue;
    }
    unfolded.push(line);
  }

  return unfolded.filter((line) => line.length > 0);
}

function parseLine(line: string): ParsedLine {
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) {
    throw new IcsParseError(`Invalid ICS content line: ${line}`);
  }

  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [rawName, ...paramParts] = head.split(";");
  const name = rawName.trim().toUpperCase();
  const params: Record<string, string[]> = {};

  for (const paramPart of paramParts) {
    const equalsIndex = paramPart.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = paramPart.slice(0, equalsIndex).trim().toUpperCase();
    const rawValues = paramPart.slice(equalsIndex + 1);
    const values = rawValues
      .split(",")
      .map((entry) => unquote(entry.trim()))
      .filter((entry) => entry.length > 0);
    if (values.length > 0) {
      params[key] = values;
    }
  }

  return { name, params, value };
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
    hourCycle: "h23"
  });
  ZONED_DATE_TIME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value;
  return Number(value ?? "0");
}

function getZonedParts(epochMs: number, timeZone: string): DateParts {
  const parts = getZonedFormatter(timeZone).formatToParts(new Date(epochMs));
  return {
    year: getPart(parts, "year"),
    month: getPart(parts, "month"),
    day: getPart(parts, "day"),
    hour: getPart(parts, "hour"),
    minute: getPart(parts, "minute"),
    second: getPart(parts, "second")
  };
}

function toComparableUtc(parts: DateParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function epochFromZonedParts(parts: DateParts, timeZone: string): number {
  let guess = toComparableUtc(parts);
  const desired = toComparableUtc(parts);

  for (let i = 0; i < 6; i += 1) {
    const zoned = getZonedParts(guess, timeZone);
    const zonedComparable = toComparableUtc(zoned);
    const diff = desired - zonedComparable;
    if (diff === 0) {
      return guess;
    }
    guess += diff;
  }

  const zoned = getZonedParts(guess, timeZone);
  if (
    zoned.year !== parts.year ||
    zoned.month !== parts.month ||
    zoned.day !== parts.day ||
    zoned.hour !== parts.hour ||
    zoned.minute !== parts.minute ||
    zoned.second !== parts.second
  ) {
    throw new IcsParseError(
      `Unable to resolve datetime ${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)} in timezone ${timeZone}`
    );
  }

  return guess;
}

function parseDateValue(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new IcsParseError(`Invalid DATE value: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    throw new IcsParseError(`Invalid DATE value: ${value}`);
  }
  return { year, month, day };
}

function parseDateTimeValue(value: string): { parts: DateParts; isUtc: boolean } {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value.trim());
  if (!match) {
    throw new IcsParseError(`Invalid DATE-TIME value: ${value}`);
  }
  const parts: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6])
  };

  const test = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  if (
    test.getFullYear() !== parts.year ||
    test.getMonth() + 1 !== parts.month ||
    test.getDate() !== parts.day ||
    test.getHours() !== parts.hour ||
    test.getMinutes() !== parts.minute ||
    test.getSeconds() !== parts.second
  ) {
    throw new IcsParseError(`Invalid DATE-TIME value: ${value}`);
  }

  return {
    parts,
    isUtc: match[7] === "Z"
  };
}

function parseTemporalValue(
  rawValue: string,
  params: Record<string, string[]>,
  calendarTimeZone?: string
): ParsedIcsTemporalValue {
  const valueType = params.VALUE?.[0]?.toUpperCase();
  const tzid = normalizeTzid(params.TZID?.[0] ?? calendarTimeZone);
  const value = rawValue.trim();

  if (valueType === "DATE" || /^\d{8}$/.test(value)) {
    const parsed = parseDateValue(value);
    const epochMs = new Date(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0).getTime();
    const localIso = formatDateToLocalIso(new Date(epochMs));
    return {
      kind: "date",
      raw: value,
      tzid,
      isUtc: false,
      epochMs,
      localIso
    };
  }

  const parsedDateTime = parseDateTimeValue(value);
  let epochMs = 0;

  if (parsedDateTime.isUtc) {
    epochMs = Date.UTC(
      parsedDateTime.parts.year,
      parsedDateTime.parts.month - 1,
      parsedDateTime.parts.day,
      parsedDateTime.parts.hour,
      parsedDateTime.parts.minute,
      parsedDateTime.parts.second
    );
  } else if (tzid) {
    epochMs = epochFromZonedParts(parsedDateTime.parts, tzid);
  } else {
    epochMs = new Date(
      parsedDateTime.parts.year,
      parsedDateTime.parts.month - 1,
      parsedDateTime.parts.day,
      parsedDateTime.parts.hour,
      parsedDateTime.parts.minute,
      parsedDateTime.parts.second
    ).getTime();
  }

  return {
    kind: "date-time",
    raw: value,
    ...(tzid ? { tzid } : {}),
    isUtc: parsedDateTime.isUtc,
    epochMs,
    localIso: formatDateToLocalIso(new Date(epochMs))
  };
}

function parseTemporalList(
  rawValue: string,
  params: Record<string, string[]>,
  calendarTimeZone?: string
): ParsedIcsTemporalValue[] {
  const values = splitCommaValues(rawValue).map((entry) => entry.trim()).filter(Boolean);
  return values.map((entry) => parseTemporalValue(entry, params, calendarTimeZone));
}

function normalizeRRuleValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toUpperCase().startsWith("RRULE:")) {
    return trimmed.slice("RRULE:".length).trim();
  }
  return trimmed;
}

export function parseIcs(content: string): ParsedIcsCalendar {
  const lines = unfoldIcsLines(content);
  const events: ParsedIcsEvent[] = [];
  let inCalendar = false;
  let inEvent = false;
  let calendarTimeZone: string | undefined;
  let currentEvent: ParsedIcsEvent | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed.name === "BEGIN" && parsed.value.toUpperCase() === "VCALENDAR") {
      inCalendar = true;
      continue;
    }
    if (parsed.name === "END" && parsed.value.toUpperCase() === "VCALENDAR") {
      inCalendar = false;
      continue;
    }
    if (!inCalendar) {
      continue;
    }

    if (parsed.name === "X-WR-TIMEZONE") {
      calendarTimeZone = normalizeTzid(parsed.value);
      continue;
    }

    if (parsed.name === "BEGIN" && parsed.value.toUpperCase() === "VEVENT") {
      inEvent = true;
      currentEvent = {
        categories: [],
        exdates: [],
        rdates: []
      };
      continue;
    }

    if (parsed.name === "END" && parsed.value.toUpperCase() === "VEVENT") {
      if (currentEvent) {
        events.push(currentEvent);
      }
      inEvent = false;
      currentEvent = null;
      continue;
    }

    if (!inEvent || !currentEvent) {
      continue;
    }

    switch (parsed.name) {
      case "UID":
        currentEvent.uid = parsed.value.trim();
        break;
      case "SUMMARY":
        currentEvent.summary = unescapeIcsText(parsed.value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeIcsText(parsed.value);
        break;
      case "CATEGORIES": {
        const categories = splitCommaValues(parsed.value)
          .map((entry) => unescapeIcsText(entry).trim())
          .filter((entry) => entry.length > 0);
        currentEvent.categories.push(...categories);
        break;
      }
      case "URL":
        currentEvent.url = parsed.value.trim();
        break;
      case "DTSTART":
        currentEvent.dtstart = parseTemporalValue(parsed.value, parsed.params, calendarTimeZone);
        break;
      case "DTEND":
        currentEvent.dtend = parseTemporalValue(parsed.value, parsed.params, calendarTimeZone);
        break;
      case "RRULE":
        currentEvent.rrule = normalizeRRuleValue(parsed.value);
        break;
      case "EXDATE":
        currentEvent.exdates.push(
          ...parseTemporalList(parsed.value, parsed.params, calendarTimeZone)
        );
        break;
      case "RDATE":
        currentEvent.rdates.push(
          ...parseTemporalList(parsed.value, parsed.params, calendarTimeZone)
        );
        break;
      case "RECURRENCE-ID":
        currentEvent.recurrenceId = parseTemporalValue(
          parsed.value,
          parsed.params,
          calendarTimeZone
        );
        break;
      case "STATUS":
        currentEvent.status = parsed.value.trim().toUpperCase();
        break;
      case "RELATED-TO":
        currentEvent.relatedTo = parsed.value.trim();
        break;
      case "X-TADOI-TASK-ID":
        currentEvent.xTaskId = parsed.value.trim();
        break;
      case "X-TADOI-SERIES-ID":
        currentEvent.xSeriesId = parsed.value.trim();
        break;
      case "X-TADOI-INSTANCE-OF":
        currentEvent.xInstanceOf = parsed.value.trim();
        break;
      default:
        break;
    }
  }

  return {
    ...(calendarTimeZone ? { calendarTimeZone } : {}),
    events
  };
}
