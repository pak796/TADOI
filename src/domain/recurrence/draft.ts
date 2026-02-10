import { parseDateToLocalMidnight, startOfLocalDayMs } from "../dates";
import { EditorDraft, Task, TaskRecurrence } from "../models";
import { nextOccurrence } from "./engine";
import {
  formatDateToLocalIso,
  formatRRule,
  parseLocalIsoToDate,
  parseRRule
} from "./rruleAdapter";

export const WEEKDAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export type BuildRecurrenceResult = {
  recurrence?: TaskRecurrence;
  error?: string;
};

const DAY_TOKEN_BY_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function sanitizeByDayTokens(values: string[]): string[] {
  const tokens = values
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is (typeof WEEKDAY_ORDER)[number] =>
      WEEKDAY_ORDER.includes(value as (typeof WEEKDAY_ORDER)[number])
    );
  return Array.from(new Set(tokens));
}

function buildUntilIso(
  untilDateText: string,
  dueDate: Date
): string | undefined {
  const untilDay = parseDateToLocalMidnight(untilDateText);
  if (!untilDay) return undefined;
  const untilDate = new Date(
    untilDay.getFullYear(),
    untilDay.getMonth(),
    untilDay.getDate(),
    dueDate.getHours(),
    dueDate.getMinutes(),
    dueDate.getSeconds()
  );
  return formatDateToLocalIso(untilDate);
}

function buildPresetRRule(draft: EditorDraft, dueDate: Date): BuildRecurrenceResult {
  const interval = parsePositiveInt(draft.repeatIntervalText, 1);
  const endMode = draft.repeatEndMode;

  const common: {
    interval: number;
    count?: number;
    untilIso?: string;
  } = {
    interval
  };

  if (endMode === "count") {
    const count = Number.parseInt(draft.repeatCountText.trim(), 10);
    if (!Number.isFinite(count) || count <= 0) {
      return { error: "Repeat count must be a positive number." };
    }
    common.count = Math.floor(count);
  } else if (endMode === "until") {
    const untilIso = buildUntilIso(draft.repeatUntilText.trim(), dueDate);
    if (!untilIso) {
      return { error: "Repeat-until date must be YYYY-MM-DD." };
    }
    common.untilIso = untilIso;
  }

  if (draft.repeatMode === "daily") {
    return {
      recurrence: {
        dtstart: formatDateToLocalIso(dueDate),
        rrule: formatRRule({
          freq: "DAILY",
          interval: common.interval,
          count: common.count,
          untilIso: common.untilIso
        }),
        series_id: ""
      }
    };
  }

  if (draft.repeatMode === "weekly") {
    const byday = sanitizeByDayTokens(draft.repeatWeekdays);
    const fallbackDay = DAY_TOKEN_BY_INDEX[dueDate.getDay()];
    const finalByday = byday.length > 0 ? byday : [fallbackDay];
    return {
      recurrence: {
        dtstart: formatDateToLocalIso(dueDate),
        rrule: formatRRule({
          freq: "WEEKLY",
          interval: common.interval,
          byday: finalByday,
          count: common.count,
          untilIso: common.untilIso
        }),
        series_id: ""
      }
    };
  }

  if (draft.repeatMode === "monthly") {
    const rawMonthday = draft.repeatMonthdayText.trim();
    const fallback = dueDate.getDate();
    const monthday = rawMonthday ? Number.parseInt(rawMonthday, 10) : fallback;

    if (!Number.isFinite(monthday) || monthday < 1 || monthday > 31) {
      return { error: "Monthly day must be between 1 and 31." };
    }

    return {
      recurrence: {
        dtstart: formatDateToLocalIso(dueDate),
        rrule: formatRRule({
          freq: "MONTHLY",
          interval: common.interval,
          bymonthday: [monthday],
          count: common.count,
          untilIso: common.untilIso
        }),
        series_id: ""
      }
    };
  }

  return { error: "Unsupported repeat mode." };
}

function buildCustomRRule(draft: EditorDraft, dueDate: Date): BuildRecurrenceResult {
  const raw = draft.repeatCustomRRuleText.trim();
  if (!raw) {
    return { error: "Custom RRULE is required." };
  }

  const parsed = parseRRule(raw);
  if (!parsed.freq || !raw.toUpperCase().includes("FREQ=")) {
    return { error: "Custom RRULE must include FREQ." };
  }

  return {
    recurrence: {
      dtstart: formatDateToLocalIso(dueDate),
      rrule: raw,
      series_id: ""
    }
  };
}

export function buildRecurrenceFromDraft(
  draft: EditorDraft,
  dueAt: number | undefined,
  seriesId: string
): BuildRecurrenceResult {
  if (draft.repeatMode === "off") {
    return {};
  }

  if (dueAt === undefined) {
    return { error: "Recurring tasks require a due date." };
  }

  const dueDate = new Date(dueAt);
  const built =
    draft.repeatMode === "custom"
      ? buildCustomRRule(draft, dueDate)
      : buildPresetRRule(draft, dueDate);

  if (!built.recurrence || built.error) {
    return built;
  }

  return {
    recurrence: {
      ...built.recurrence,
      series_id: seriesId
    }
  };
}

export function buildRecurrencePreviewFromDraft(
  draft: EditorDraft,
  dueAt: number | undefined,
  hasExplicitTime: boolean,
  nowMs: number,
  count = 3
): string[] {
  if (count <= 0) return [];

  const built = buildRecurrenceFromDraft(draft, dueAt, "series:preview");
  if (!built.recurrence) {
    return [];
  }

  const seriesTask: Task = {
    id: "preview-series",
    title: "preview",
    status: "open",
    createdAt: nowMs,
    updatedAt: nowMs,
    dueAt,
    hasExplicitTime,
    tags: [],
    recurrence: built.recurrence
  };

  const results: string[] = [];
  let afterMs = hasExplicitTime ? nowMs - 1 : startOfLocalDayMs(nowMs) - 1;

  for (let index = 0; index < count; index += 1) {
    const nextIso = nextOccurrence(seriesTask, afterMs);
    if (!nextIso) {
      break;
    }
    results.push(nextIso);
    const nextDate = parseLocalIsoToDate(nextIso);
    if (!nextDate) {
      break;
    }
    afterMs = nextDate.getTime() + 1000;
  }

  return results;
}

export function getRecurrenceSummary(recurrence: TaskRecurrence | undefined): string | undefined {
  if (!recurrence) return undefined;
  const parsed = parseRRule(recurrence.rrule);

  const base =
    parsed.freq === "DAILY"
      ? "Daily"
      : parsed.freq === "WEEKLY"
        ? "Weekly"
        : parsed.freq === "MONTHLY"
          ? "Monthly"
          : "Yearly";

  const segments: string[] = [base];

  if (parsed.interval > 1) {
    segments.push(`every ${parsed.interval}`);
  }

  if (parsed.byday.length > 0) {
    segments.push(parsed.byday.join(","));
  }

  if (parsed.bymonthday.length > 0) {
    segments.push(`day ${parsed.bymonthday.join(",")}`);
  }

  if (parsed.count) {
    segments.push(`x${parsed.count}`);
  } else if (parsed.untilIso) {
    segments.push(`until ${parsed.untilIso.slice(0, 10)}`);
  }

  return segments.join(" ");
}
