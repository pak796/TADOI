import { RRule } from "rrule";
import { RecurrenceFrequency, TaskRecurrence } from "../models";

const WEEKDAY_TOKENS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

const WEEKDAY_BY_TOKEN: Record<string, unknown> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU
};

type ParsedUntil = {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  ss: number;
  zulu: boolean;
};

export type ParsedRuleSubset = {
  freq: RecurrenceFrequency;
  interval: number;
  byday: string[];
  bymonthday: number[];
  count?: number;
  untilIso?: string;
};

export type FormatRRuleOptions = {
  freq: RecurrenceFrequency;
  interval?: number;
  byday?: string[];
  bymonthday?: number[];
  count?: number;
  untilIso?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidLocalDateTime(date: Date, y: number, m: number, d: number, hh: number, mm: number, ss: number): boolean {
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    date.getHours() === hh &&
    date.getMinutes() === mm &&
    date.getSeconds() === ss
  );
}

function parseUntilToken(token: string): ParsedUntil | undefined {
  const compactDate = /^(\d{4})(\d{2})(\d{2})$/;
  const compactDateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;
  const dateMatch = compactDate.exec(token);
  if (dateMatch) {
    return {
      y: Number(dateMatch[1]),
      m: Number(dateMatch[2]),
      d: Number(dateMatch[3]),
      hh: 0,
      mm: 0,
      ss: 0,
      zulu: false
    };
  }

  const dateTimeMatch = compactDateTime.exec(token);
  if (!dateTimeMatch) return undefined;
  return {
    y: Number(dateTimeMatch[1]),
    m: Number(dateTimeMatch[2]),
    d: Number(dateTimeMatch[3]),
    hh: Number(dateTimeMatch[4]),
    mm: Number(dateTimeMatch[5]),
    ss: Number(dateTimeMatch[6]),
    zulu: dateTimeMatch[7] === "Z"
  };
}

function formatUntilToken(localIso: string): string | undefined {
  const date = parseLocalIsoToDate(localIso);
  if (!date) return undefined;
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function normalizeRRule(rrule: string): string {
  const trimmed = rrule.trim();
  if (!trimmed) return "";
  return trimmed.toUpperCase().startsWith("RRULE:")
    ? trimmed.slice("RRULE:".length).trim()
    : trimmed;
}

function parseFrequency(value: string | undefined): RecurrenceFrequency {
  if (
    value === "DAILY" ||
    value === "WEEKLY" ||
    value === "MONTHLY" ||
    value === "YEARLY"
  ) {
    return value;
  }
  return "DAILY";
}

function toRRuleFreq(freq: RecurrenceFrequency): number {
  switch (freq) {
    case "WEEKLY":
      return RRule.WEEKLY;
    case "MONTHLY":
      return RRule.MONTHLY;
    case "YEARLY":
      return RRule.YEARLY;
    default:
      return RRule.DAILY;
  }
}

function sanitizeInterval(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function sanitizeByDay(tokens: string[] | undefined): string[] {
  if (!tokens || tokens.length === 0) return [];
  return Array.from(
    new Set(
      tokens
        .map((token) => token.trim().toUpperCase())
        .filter((token) => WEEKDAY_TOKENS.includes(token as (typeof WEEKDAY_TOKENS)[number]))
    )
  );
}

function sanitizeByMonthDay(values: number[] | undefined): number[] {
  if (!values || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => Math.floor(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 31)
    )
  );
}

export function parseLocalIsoToDate(iso: string): Date | undefined {
  const trimmed = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return undefined;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  const ss = match[6] !== undefined ? Number(match[6]) : 0;
  if ([y, m, d, hh, mm, ss].some((value) => !Number.isFinite(value))) return undefined;
  const date = new Date(y, m - 1, d, hh, mm, ss);
  if (!isValidLocalDateTime(date, y, m, d, hh, mm, ss)) return undefined;
  return date;
}

export function formatDateToLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export function toFloatingUtcDate(localDate: Date): Date {
  return new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds(),
      localDate.getMilliseconds()
    )
  );
}

export function fromFloatingUtcDate(floatingDate: Date): Date {
  return new Date(
    floatingDate.getUTCFullYear(),
    floatingDate.getUTCMonth(),
    floatingDate.getUTCDate(),
    floatingDate.getUTCHours(),
    floatingDate.getUTCMinutes(),
    floatingDate.getUTCSeconds(),
    floatingDate.getUTCMilliseconds()
  );
}

export function parseRRule(rrule: string): ParsedRuleSubset {
  const normalized = normalizeRRule(rrule);
  const fields = normalized
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const values = new Map<string, string>();
  for (const field of fields) {
    const [rawKey, ...rest] = field.split("=");
    if (!rawKey || rest.length === 0) continue;
    values.set(rawKey.toUpperCase(), rest.join("="));
  }

  const freq = parseFrequency(values.get("FREQ"));
  const interval = sanitizeInterval(Number(values.get("INTERVAL") ?? "1"));
  const byday = sanitizeByDay(
    values.get("BYDAY")?.split(",").map((token) => token.trim()) ?? []
  );
  const bymonthday = sanitizeByMonthDay(
    values
      .get("BYMONTHDAY")
      ?.split(",")
      .map((value) => Number(value.trim())) ?? []
  );
  const countValue = Number(values.get("COUNT"));
  const count =
    Number.isFinite(countValue) && countValue > 0 ? Math.floor(countValue) : undefined;

  const untilToken = values.get("UNTIL");
  let untilIso: string | undefined;
  if (untilToken) {
    const parsed = parseUntilToken(untilToken);
    if (parsed) {
      if (parsed.zulu) {
        const utcDate = new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.hh, parsed.mm, parsed.ss)
        );
        untilIso = formatDateToLocalIso(utcDate);
      } else {
        const localDate = new Date(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.hh,
          parsed.mm,
          parsed.ss
        );
        if (
          isValidLocalDateTime(
            localDate,
            parsed.y,
            parsed.m,
            parsed.d,
            parsed.hh,
            parsed.mm,
            parsed.ss
          )
        ) {
          untilIso = formatDateToLocalIso(localDate);
        }
      }
    }
  }

  return { freq, interval, byday, bymonthday, count, untilIso };
}

export function formatRRule(options: FormatRRuleOptions): string {
  const parts: string[] = [];
  const freq = parseFrequency(options.freq);
  parts.push(`FREQ=${freq}`);
  parts.push(`INTERVAL=${sanitizeInterval(options.interval)}`);

  const byday = sanitizeByDay(options.byday);
  if (byday.length > 0) {
    parts.push(`BYDAY=${byday.join(",")}`);
  }

  const bymonthday = sanitizeByMonthDay(options.bymonthday);
  if (bymonthday.length > 0) {
    parts.push(`BYMONTHDAY=${bymonthday.join(",")}`);
  }

  if (options.count !== undefined && Number.isFinite(options.count) && options.count > 0) {
    parts.push(`COUNT=${Math.floor(options.count)}`);
  } else if (options.untilIso) {
    const until = formatUntilToken(options.untilIso);
    if (until) {
      parts.push(`UNTIL=${until}`);
    }
  }

  return parts.join(";");
}

export function buildRule(recurrence: TaskRecurrence): RRule {
  const parsed = parseRRule(recurrence.rrule);
  const dtstartLocal = parseLocalIsoToDate(recurrence.dtstart);
  if (!dtstartLocal) {
    throw new Error(`Invalid recurrence.dtstart: ${recurrence.dtstart}`);
  }

  const options: ConstructorParameters<typeof RRule>[0] = {
    freq: toRRuleFreq(parsed.freq),
    interval: sanitizeInterval(parsed.interval),
    dtstart: toFloatingUtcDate(dtstartLocal)
  };

  if (parsed.byday.length > 0) {
    options.byweekday = parsed.byday
      .map((token) => WEEKDAY_BY_TOKEN[token])
      .filter(Boolean) as any;
  }
  if (parsed.bymonthday.length > 0) {
    options.bymonthday = parsed.bymonthday;
  }
  if (parsed.count !== undefined) {
    options.count = parsed.count;
  } else if (parsed.untilIso) {
    const untilLocal = parseLocalIsoToDate(parsed.untilIso);
    if (untilLocal) {
      options.until = toFloatingUtcDate(untilLocal);
    }
  }

  return new RRule(options);
}
