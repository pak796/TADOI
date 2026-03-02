export const MINI_DEFAULT_TIMEZONE = "America/Chicago";

export type MiniParsePrecision = "date" | "datetime";

export type MiniParseOk = {
  ok: true;
  dateISO: string;
  time24?: string | null;
  precision: MiniParsePrecision;
  source: "mini";
};

export type MiniParseErrCode =
  | "EMPTY_INPUT"
  | "UNKNOWN_TOKEN"
  | "INVALID_OFFSET"
  | "AMBIGUOUS_TIME"
  | "INVALID_TIME"
  | "INVALID_NOW"
  | "INVALID_TZ";

export type MiniParseErr = {
  ok: false;
  code: MiniParseErrCode;
  message: string;
};

type DateToken =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "weekday"; weekday: number }
  | { kind: "offset_days"; days: number };

type TimeToken = {
  hours: number;
  minutes: number;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type DateTimeParts = DateParts & {
  hour: number;
  minute: number;
  second: number;
};

const WEEKDAY_INDEX_BY_TOKEN: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6
};

const ZONED_DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function okDate(dateISO: string): MiniParseOk {
  return {
    ok: true,
    dateISO,
    time24: null,
    precision: "date",
    source: "mini"
  };
}

function okDateTime(dateISO: string, time24: string): MiniParseOk {
  return {
    ok: true,
    dateISO,
    time24,
    precision: "datetime",
    source: "mini"
  };
}

function err(code: MiniParseErrCode, message: string): MiniParseErr {
  return { ok: false, code, message };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateIso(parts: DateParts): string {
  return `${String(parts.year).padStart(4, "0")}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function formatTime24(hours: number, minutes: number): string {
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function addDays(parts: DateParts, days: number): DateParts {
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate()
  };
}

function localWeekday(parts: DateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function isSameDate(left: DateParts, right: DateParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
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

function getZonedParts(epochMs: number, timeZone: string): DateTimeParts {
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

function toComparableUtc(parts: DateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function epochFromZonedParts(parts: DateTimeParts, timeZone: string): number | null {
  const desired = toComparableUtc(parts);
  let guess = desired;

  for (let index = 0; index < 6; index += 1) {
    const zoned = getZonedParts(guess, timeZone);
    const zonedComparable = toComparableUtc(zoned);
    const diff = desired - zonedComparable;
    if (diff === 0) {
      return guess;
    }
    guess += diff;
  }

  const finalParts = getZonedParts(guess, timeZone);
  if (
    finalParts.year !== parts.year ||
    finalParts.month !== parts.month ||
    finalParts.day !== parts.day ||
    finalParts.hour !== parts.hour ||
    finalParts.minute !== parts.minute ||
    finalParts.second !== parts.second
  ) {
    return null;
  }

  return guess;
}

function resolveDateToken(token: string): DateToken | MiniParseErr {
  if (token === "today") return { kind: "today" };
  if (token === "tomorrow") return { kind: "tomorrow" };

  const weekday = WEEKDAY_INDEX_BY_TOKEN[token];
  if (weekday !== undefined) {
    return { kind: "weekday", weekday };
  }

  const offsetMatch = /^\+(\d+)([dw])$/.exec(token);
  if (offsetMatch) {
    const amount = Number.parseInt(offsetMatch[1] ?? "", 10);
    if (!Number.isFinite(amount) || amount < 0) {
      return err("INVALID_OFFSET", `Invalid offset token "${token}"`);
    }
    const unit = offsetMatch[2] ?? "d";
    const days = unit === "w" ? amount * 7 : amount;
    return { kind: "offset_days", days };
  }

  if (token.startsWith("+")) {
    return err("INVALID_OFFSET", `Invalid offset token "${token}"`);
  }

  return err("UNKNOWN_TOKEN", `Unknown token "${token}"`);
}

function resolveTimeToken(token: string): TimeToken | MiniParseErr {
  if (token === "noon") {
    return { hours: 12, minutes: 0 };
  }
  if (token === "midnight") {
    return { hours: 0, minutes: 0 };
  }

  if (/^\d+$/.test(token)) {
    return err("AMBIGUOUS_TIME", `Ambiguous time token "${token}"`);
  }

  const amPmMatch = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(token);
  if (amPmMatch) {
    const hour12 = Number.parseInt(amPmMatch[1] ?? "", 10);
    const minuteValue = amPmMatch[2] ?? "00";
    const minutes = Number.parseInt(minuteValue, 10);
    const meridiem = amPmMatch[3] ?? "am";

    if (!Number.isFinite(hour12) || !Number.isFinite(minutes)) {
      return err("INVALID_TIME", `Invalid time token "${token}"`);
    }
    if (hour12 < 1 || hour12 > 12 || minutes < 0 || minutes > 59) {
      return err("INVALID_TIME", `Invalid time token "${token}"`);
    }

    const hours =
      meridiem === "am"
        ? hour12 % 12
        : (hour12 % 12) + 12;

    return { hours, minutes };
  }

  const time24Match = /^(\d{2}):(\d{2})$/.exec(token);
  if (time24Match) {
    const hours = Number.parseInt(time24Match[1] ?? "", 10);
    const minutes = Number.parseInt(time24Match[2] ?? "", 10);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return err("INVALID_TIME", `Invalid time token "${token}"`);
    }
    return { hours, minutes };
  }

  if (/[0-9]/.test(token) && (token.includes(":") || /[ap]m?$/i.test(token))) {
    return err("INVALID_TIME", `Invalid time token "${token}"`);
  }

  return err("UNKNOWN_TOKEN", `Unknown token "${token}"`);
}

function resolveDate(token: DateToken, today: DateParts): DateParts {
  if (token.kind === "today") return today;
  if (token.kind === "tomorrow") return addDays(today, 1);
  if (token.kind === "offset_days") return addDays(today, token.days);

  const todayWeekday = localWeekday(today);
  const delta = (token.weekday - todayWeekday + 7) % 7;
  return addDays(today, delta);
}

function buildEpochForDateTime(date: DateParts, time: TimeToken, timeZone: string): number | null {
  return epochFromZonedParts(
    {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hours,
      minute: time.minutes,
      second: 0
    },
    timeZone
  );
}

export function parseMiniDateTime(input: string, now: number, tz: string): MiniParseOk | MiniParseErr {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return err("EMPTY_INPUT", "Input is empty");
  }

  if (!Number.isFinite(now)) {
    return err("INVALID_NOW", "now must be a finite epoch millisecond value");
  }

  let nowParts: DateTimeParts;
  try {
    nowParts = getZonedParts(now, tz);
  } catch {
    return err("INVALID_TZ", `Invalid timezone "${tz}"`);
  }

  const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length > 2) {
    const leftover = tokens[2] ?? tokens[tokens.length - 1] ?? "";
    return err("UNKNOWN_TOKEN", `Unknown token "${leftover}"`);
  }

  const today: DateParts = {
    year: nowParts.year,
    month: nowParts.month,
    day: nowParts.day
  };

  if (tokens.length === 1) {
    const token = tokens[0] ?? "";
    const dateToken = resolveDateToken(token);
    if (!("ok" in dateToken)) {
      const resolvedDate = resolveDate(dateToken, today);
      return okDate(formatDateIso(resolvedDate));
    }
    if (dateToken.code !== "UNKNOWN_TOKEN") {
      return dateToken;
    }

    const timeToken = resolveTimeToken(token);
    if ("ok" in timeToken) {
      return timeToken;
    }

    const todayEpoch = buildEpochForDateTime(today, timeToken, tz);
    if (todayEpoch === null) {
      return err("INVALID_TIME", `Invalid time token "${token}"`);
    }

    const resolvedDate = todayEpoch > now ? today : addDays(today, 1);
    return okDateTime(formatDateIso(resolvedDate), formatTime24(timeToken.hours, timeToken.minutes));
  }

  const first = tokens[0] ?? "";
  const second = tokens[1] ?? "";

  const dateToken = resolveDateToken(first);
  if ("ok" in dateToken) {
    return dateToken;
  }

  const timeToken = resolveTimeToken(second);
  if ("ok" in timeToken) {
    return timeToken;
  }

  let resolvedDate = resolveDate(dateToken, today);
  if (dateToken.kind === "weekday" && isSameDate(resolvedDate, today)) {
    const candidateEpoch = buildEpochForDateTime(resolvedDate, timeToken, tz);
    if (candidateEpoch === null) {
      return err("INVALID_TIME", `Invalid time token "${second}"`);
    }
    if (candidateEpoch <= now) {
      resolvedDate = addDays(resolvedDate, 7);
    }
  }

  const finalEpoch = buildEpochForDateTime(resolvedDate, timeToken, tz);
  if (finalEpoch === null) {
    return err("INVALID_TIME", `Invalid time token "${second}"`);
  }

  return okDateTime(formatDateIso(resolvedDate), formatTime24(timeToken.hours, timeToken.minutes));
}
