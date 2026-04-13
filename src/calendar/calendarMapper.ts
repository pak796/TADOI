import { Task } from "../domain/models";
import {
  formatDateToLocalIso,
  parseLocalIsoToDate,
} from "../domain/recurrence/rruleAdapter";
import {
  formatRecurrenceExdates,
  localIsoToIcsDate,
  localIsoToIcsDateTime,
  toRRuleLine,
} from "./rrule";

const DEFAULT_TIMED_DURATION_MS = 30 * 60 * 1000;

export type CalendarTimeMode = "tzid" | "utc";
export type CalendarEventPrivacyMode = "minimal" | "full";

export type CalendarTimeContext = {
  mode: CalendarTimeMode;
  timeZone: string;
};

export type CalendarDateValue = {
  kind: "date";
  value: string; // YYYYMMDD
};

export type CalendarDateTimeValue = {
  kind: "date-time";
  value: string; // YYYYMMDDTHHMMSS(+optional Z)
  tzid?: string;
  utc?: boolean;
};

export type CalendarTemporalValue = CalendarDateValue | CalendarDateTimeValue;

export type CalendarExdates = {
  kind: "date" | "date-time";
  values: string[];
  tzid?: string;
  utc?: boolean;
};

export type CalendarVEvent = {
  uid: string;
  xTaskId?: string;
  xSeriesId?: string;
  xInstanceOf?: string;
  dtstampUtc: string;
  summary: string;
  description?: string;
  categories: string[];
  transp: "TRANSPARENT";
  url?: string;
  dtstart: CalendarTemporalValue;
  dtend: CalendarTemporalValue;
  rrule?: string;
  exdates?: CalendarExdates;
  relatedTo?: string;
  sortKey: string;
};

type ZonedDateParts = {
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

function formatIcsDate(
  parts: Pick<ZonedDateParts, "year" | "month" | "day">,
): string {
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}`;
}

function formatIcsDateTime(parts: ZonedDateParts): string {
  return `${formatIcsDate(parts)}T${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}`;
}

function formatUtcDateTime(date: Date): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function toSortKey(dtstart: CalendarTemporalValue): string {
  if (dtstart.kind === "date") {
    return `${dtstart.value}T000000`;
  }
  return dtstart.value;
}

function addDaysToIcsDate(icsDate: string, days: number): string {
  const yyyy = Number(icsDate.slice(0, 4));
  const mm = Number(icsDate.slice(4, 6));
  const dd = Number(icsDate.slice(6, 8));
  const value = new Date(Date.UTC(yyyy, mm - 1, dd + days));
  return `${value.getUTCFullYear()}${pad2(value.getUTCMonth() + 1)}${pad2(value.getUTCDate())}`;
}

function stripTagPrefix(tag: string): string {
  return tag.trim().replace(/^#+/, "");
}

function buildCategories(tags: string[]): string[] {
  return tags.map(stripTagPrefix).filter((tag) => tag.length > 0);
}

function buildDescription(task: Task): string | undefined {
  const lines: string[] = [];
  const notes = task.notes?.trim();
  if (notes) {
    lines.push(notes);
  }

  const normalizedTags = buildCategories(task.tags);
  if (normalizedTags.length > 0) {
    lines.push(`Tags: ${normalizedTags.join(", ")}`);
  }

  for (const link of task.links ?? []) {
    const label = link.label?.trim() || "link";
    lines.push(`${label}: ${link.target}`);
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function findFirstHttpUrl(task: Task): string | undefined {
  for (const link of task.links ?? []) {
    if (/^https?:\/\//i.test(link.target)) {
      return link.target;
    }
  }
  return undefined;
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

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const value = parts.find((part) => part.type === type)?.value;
  return Number(value ?? "0");
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

function buildTemporalFromEpoch(
  dueAt: number,
  hasExplicitTime: boolean,
  timeContext: CalendarTimeContext,
): { dtstart: CalendarTemporalValue; dtend: CalendarTemporalValue } {
  if (!hasExplicitTime) {
    if (timeContext.mode === "tzid") {
      const parts = getZonedParts(new Date(dueAt), timeContext.timeZone);
      const startDate = formatIcsDate(parts);
      return {
        dtstart: { kind: "date", value: startDate },
        dtend: { kind: "date", value: addDaysToIcsDate(startDate, 1) },
      };
    }

    const date = new Date(dueAt);
    const startDate = `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
    return {
      dtstart: { kind: "date", value: startDate },
      dtend: { kind: "date", value: addDaysToIcsDate(startDate, 1) },
    };
  }

  if (timeContext.mode === "tzid") {
    const start = getZonedParts(new Date(dueAt), timeContext.timeZone);
    const end = getZonedParts(
      new Date(dueAt + DEFAULT_TIMED_DURATION_MS),
      timeContext.timeZone,
    );
    return {
      dtstart: {
        kind: "date-time",
        value: formatIcsDateTime(start),
        tzid: timeContext.timeZone,
      },
      dtend: {
        kind: "date-time",
        value: formatIcsDateTime(end),
        tzid: timeContext.timeZone,
      },
    };
  }

  return {
    dtstart: {
      kind: "date-time",
      value: formatUtcDateTime(new Date(dueAt)),
      utc: true,
    },
    dtend: {
      kind: "date-time",
      value: formatUtcDateTime(new Date(dueAt + DEFAULT_TIMED_DURATION_MS)),
      utc: true,
    },
  };
}

function buildTemporalFromLocalIso(
  localIso: string,
  hasExplicitTime: boolean,
  timeContext: CalendarTimeContext,
): { dtstart: CalendarTemporalValue; dtend: CalendarTemporalValue } | null {
  if (!hasExplicitTime) {
    const startDate = localIsoToIcsDate(localIso);
    if (!startDate) return null;
    return {
      dtstart: { kind: "date", value: startDate },
      dtend: { kind: "date", value: addDaysToIcsDate(startDate, 1) },
    };
  }

  const startDate = parseLocalIsoToDate(localIso);
  if (!startDate) return null;
  const endDate = new Date(startDate.getTime() + DEFAULT_TIMED_DURATION_MS);

  if (timeContext.mode === "tzid") {
    const start = localIsoToIcsDateTime(localIso);
    const end = localIsoToIcsDateTime(formatDateToLocalIso(endDate));
    if (!start || !end) return null;
    return {
      dtstart: {
        kind: "date-time",
        value: start,
        tzid: timeContext.timeZone,
      },
      dtend: {
        kind: "date-time",
        value: end,
        tzid: timeContext.timeZone,
      },
    };
  }

  return {
    dtstart: {
      kind: "date-time",
      value: formatUtcDateTime(startDate),
      utc: true,
    },
    dtend: {
      kind: "date-time",
      value: formatUtcDateTime(endDate),
      utc: true,
    },
  };
}

function buildExdates(
  exdates: string[] | undefined,
  hasExplicitTime: boolean,
  timeContext: CalendarTimeContext,
): CalendarExdates | undefined {
  if (!exdates || exdates.length === 0) return undefined;

  if (!hasExplicitTime) {
    const values = formatRecurrenceExdates(exdates, "date");
    if (values.length === 0) return undefined;
    return { kind: "date", values };
  }

  if (timeContext.mode === "tzid") {
    const values = formatRecurrenceExdates(exdates, "date-time");
    if (values.length === 0) return undefined;
    return {
      kind: "date-time",
      values,
      tzid: timeContext.timeZone,
    };
  }

  const values = exdates
    .map((value) => parseLocalIsoToDate(value))
    .filter((value): value is Date => value instanceof Date)
    .map((value) => formatUtcDateTime(value))
    .sort();
  const deduped = Array.from(new Set(values));
  if (deduped.length === 0) return undefined;
  return {
    kind: "date-time",
    values: deduped,
    utc: true,
  };
}

function buildCommonFields(
  task: Task,
  privacyMode: CalendarEventPrivacyMode,
): Pick<
  CalendarVEvent,
  "summary" | "description" | "categories" | "transp" | "url"
> {
  if (privacyMode === "minimal") {
    return {
      summary: task.title,
      description: undefined,
      categories: [],
      transp: "TRANSPARENT",
      url: undefined,
    };
  }

  return {
    summary: task.title,
    description: buildDescription(task),
    categories: buildCategories(task.tags),
    transp: "TRANSPARENT",
    url: findFirstHttpUrl(task),
  };
}

function createBaseEvent(params: {
  uid: string;
  task: Task;
  temporal: { dtstart: CalendarTemporalValue; dtend: CalendarTemporalValue };
  generatedAt: Date;
  privacyMode: CalendarEventPrivacyMode;
  relatedTo?: string;
  rrule?: string;
  exdates?: CalendarExdates;
  xTaskId?: string;
  xSeriesId?: string;
  xInstanceOf?: string;
}): CalendarVEvent {
  const common = buildCommonFields(params.task, params.privacyMode);
  return {
    uid: params.uid,
    ...(params.xTaskId ? { xTaskId: params.xTaskId } : {}),
    ...(params.xSeriesId ? { xSeriesId: params.xSeriesId } : {}),
    ...(params.xInstanceOf ? { xInstanceOf: params.xInstanceOf } : {}),
    dtstampUtc: formatUtcDateTime(params.generatedAt),
    ...common,
    dtstart: params.temporal.dtstart,
    dtend: params.temporal.dtend,
    ...(params.rrule ? { rrule: params.rrule } : {}),
    ...(params.exdates ? { exdates: params.exdates } : {}),
    ...(params.relatedTo ? { relatedTo: params.relatedTo } : {}),
    sortKey: toSortKey(params.temporal.dtstart),
  };
}

export function mapNonRecurringTaskToEvent(
  task: Task,
  timeContext: CalendarTimeContext,
  generatedAt: Date,
  privacyMode: CalendarEventPrivacyMode = "full",
): CalendarVEvent | null {
  if (task.recurrence || task.instance_of) return null;
  if (task.dueAt === undefined) return null;

  return createBaseEvent({
    uid: `tadoi-${task.id}@local`,
    xTaskId: task.id,
    task,
    temporal: buildTemporalFromEpoch(
      task.dueAt,
      task.hasExplicitTime === true,
      timeContext,
    ),
    generatedAt,
    privacyMode,
  });
}

export function mapInstanceOverrideTaskToEvent(
  task: Task,
  timeContext: CalendarTimeContext,
  generatedAt: Date,
  relatedToSeriesUid?: string,
  privacyMode: CalendarEventPrivacyMode = "full",
): CalendarVEvent | null {
  if (!task.instance_of) return null;
  if (task.dueAt === undefined) return null;

  return createBaseEvent({
    uid: `tadoi-inst-${task.id}@local`,
    xTaskId: task.id,
    xInstanceOf: task.instance_of.series_id,
    task,
    temporal: buildTemporalFromEpoch(
      task.dueAt,
      task.hasExplicitTime === true,
      timeContext,
    ),
    generatedAt,
    privacyMode,
    relatedTo: relatedToSeriesUid,
  });
}

export function mapSeriesTaskToRecurringEvent(
  task: Task,
  timeContext: CalendarTimeContext,
  generatedAt: Date,
  privacyMode: CalendarEventPrivacyMode = "full",
): CalendarVEvent | null {
  if (!task.recurrence || task.instance_of) return null;

  const temporal = buildTemporalFromLocalIso(
    task.recurrence.dtstart,
    task.hasExplicitTime === true,
    timeContext,
  );
  if (!temporal) return null;

  const exdates = buildExdates(
    task.recurrence.exdates,
    task.hasExplicitTime === true,
    timeContext,
  );

  return createBaseEvent({
    uid: `tadoi-series-${task.id}@local`,
    xTaskId: task.id,
    xSeriesId: task.recurrence.series_id,
    task,
    temporal,
    generatedAt,
    privacyMode,
    rrule: toRRuleLine(task.recurrence.rrule),
    exdates,
  });
}

export function mapSeriesOccurrenceToEvent(
  task: Task,
  occurrenceIso: string,
  timeContext: CalendarTimeContext,
  generatedAt: Date,
  privacyMode: CalendarEventPrivacyMode = "full",
): CalendarVEvent | null {
  if (!task.recurrence || task.instance_of) return null;

  const temporal = buildTemporalFromLocalIso(
    occurrenceIso,
    task.hasExplicitTime === true,
    timeContext,
  );
  if (!temporal) return null;

  const compactOccurrence =
    task.hasExplicitTime === true
      ? (localIsoToIcsDateTime(occurrenceIso) ?? "").replace(/[^\d]/g, "")
      : (localIsoToIcsDate(occurrenceIso) ?? "");

  return createBaseEvent({
    uid: `tadoi-occ-${task.id}-${compactOccurrence}@local`,
    xTaskId: task.id,
    xSeriesId: task.recurrence.series_id,
    task,
    temporal,
    generatedAt,
    privacyMode,
    relatedTo: `tadoi-series-${task.id}@local`,
  });
}
