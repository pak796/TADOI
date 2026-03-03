import { parseStrictLocalDate, parseStrictTime } from "../../commands/validate";
import {
  MINI_DEFAULT_TIMEZONE,
  parseMiniDateTime,
  type MiniParseErr,
  type MiniParseErrCode
} from "./mini_datetime_parser";

export { MINI_DEFAULT_TIMEZONE } from "./mini_datetime_parser";

export type DueAtCanonicalErrCode =
  | "INVALID_DUE"
  | "INVALID_TIME"
  | "AMBIGUOUS_TIME"
  | "DUPLICATE_TIME";

export type DueAtCanonicalOk = {
  ok: true;
  dueDate: string;
  atTime?: string;
};

export type DueAtCanonicalErr = {
  ok: false;
  code: DueAtCanonicalErrCode;
  message: string;
};

export type TimeOnlyCanonicalOk = {
  ok: true;
  time24: string;
};

export type TimeOnlyCanonicalErr = {
  ok: false;
  code: Exclude<DueAtCanonicalErrCode, "INVALID_DUE" | "DUPLICATE_TIME">;
  message: string;
};

type CanonicalizeOptions = {
  now: number;
  tz?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

function formatTime(hours: number, minutes: number): string {
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function invalidDue(input: string): {
  ok: false;
  code: "INVALID_DUE";
  message: string;
} {
  return {
    ok: false,
    code: "INVALID_DUE",
    message: `Error: invalid due date "${input}"`
  };
}

function invalidTime(input: string): TimeOnlyCanonicalErr {
  return {
    ok: false,
    code: "INVALID_TIME",
    message: `Error: invalid time "${input}"`
  };
}

function ambiguousTime(input: string): TimeOnlyCanonicalErr {
  return {
    ok: false,
    code: "AMBIGUOUS_TIME",
    message: `Error: ambiguous time "${input}"`
  };
}

function mapMiniTimeError(error: MiniParseErr, rawInput: string): TimeOnlyCanonicalErr {
  if (error.code === "AMBIGUOUS_TIME") {
    return ambiguousTime(rawInput);
  }
  return invalidTime(rawInput);
}

function parseDueCore(
  dueInput: string,
  options: CanonicalizeOptions
):
  | { ok: true; dueDate: string; dueTime?: string }
  | { ok: false; code: "INVALID_DUE" | "INVALID_TIME" | "AMBIGUOUS_TIME"; message: string } {
  const normalizedInput = dueInput.trim();
  const tz = options.tz ?? MINI_DEFAULT_TIMEZONE;
  const mini = parseMiniDateTime(normalizedInput, options.now, tz);
  if (mini.ok) {
    return {
      ok: true,
      dueDate: mini.dateISO,
      ...(mini.precision === "datetime" && mini.time24 ? { dueTime: mini.time24 } : {})
    };
  }

  if (mini.code === "UNKNOWN_TOKEN") {
    const strictDate = parseStrictLocalDate(normalizedInput);
    if (!strictDate) {
      return invalidDue(normalizedInput);
    }
    return {
      ok: true,
      dueDate: formatDate(strictDate.year, strictDate.month, strictDate.day)
    };
  }

  if (mini.code === "AMBIGUOUS_TIME") {
    return ambiguousTime(normalizedInput);
  }

  if (mini.code === "INVALID_TIME") {
    return invalidTime(normalizedInput);
  }

  return invalidDue(normalizedInput);
}

export function canonicalizeTimeOnlyInput(
  timeInput: string,
  options: CanonicalizeOptions
): TimeOnlyCanonicalOk | TimeOnlyCanonicalErr {
  const normalizedInput = timeInput.trim();
  const tz = options.tz ?? MINI_DEFAULT_TIMEZONE;
  const mini = parseMiniDateTime(normalizedInput, options.now, tz);

  if (mini.ok) {
    if (mini.precision !== "datetime" || !mini.time24 || /\s/.test(normalizedInput)) {
      return invalidTime(normalizedInput);
    }
    return {
      ok: true,
      time24: mini.time24
    };
  }

  if (mini.code === "UNKNOWN_TOKEN") {
    const strict = parseStrictTime(normalizedInput);
    if (!strict) {
      return invalidTime(normalizedInput);
    }
    return {
      ok: true,
      time24: formatTime(strict.hours, strict.minutes)
    };
  }

  return mapMiniTimeError(mini, normalizedInput);
}

export function canonicalizeDueAtInput(
  dueInput: string,
  atInput: string | undefined,
  options: CanonicalizeOptions
): DueAtCanonicalOk | DueAtCanonicalErr {
  const normalizedDue = dueInput.trim();
  if (!normalizedDue) {
    return invalidDue(dueInput);
  }

  const parsedDue = parseDueCore(normalizedDue, options);
  if (!parsedDue.ok) {
    return parsedDue;
  }

  const normalizedAt = atInput?.trim();
  if (parsedDue.dueTime && normalizedAt) {
    return {
      ok: false,
      code: "DUPLICATE_TIME",
      message: 'Error: due value already includes time; omit "at:"'
    };
  }

  if (normalizedAt) {
    const parsedTime = canonicalizeTimeOnlyInput(normalizedAt, options);
    if (!parsedTime.ok) {
      return parsedTime;
    }

    return {
      ok: true,
      dueDate: parsedDue.dueDate,
      atTime: parsedTime.time24
    };
  }

  return {
    ok: true,
    dueDate: parsedDue.dueDate,
    ...(parsedDue.dueTime ? { atTime: parsedDue.dueTime } : {})
  };
}

export function shouldFallbackStrictForMiniError(code: MiniParseErrCode): boolean {
  return code === "UNKNOWN_TOKEN";
}
