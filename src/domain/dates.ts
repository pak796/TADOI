const DAY_MS = 24 * 60 * 60 * 1000;

export function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseDateToLocalMidnight(input: string): Date | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getLocalYMD(date: Date): { y: number; m: number; d: number } {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalTimeHHmm(epochMs: number): string {
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function normalizeTimeTextInput(input: string): string {
  const trimmed = input.trim();
  if (/^\d:/.test(trimmed)) {
    return `0${trimmed}`;
  }
  return trimmed;
}

export function parseTimeToMinutes(input: string): number | undefined {
  const normalized = normalizeTimeTextInput(input);
  if (!normalized) return undefined;
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }
  return hours * 60 + minutes;
}

export function combineLocalDateAndTime(
  date: Date,
  timeText: string,
): Date | undefined {
  const minutes = parseTimeToMinutes(timeText);
  if (minutes === undefined) return undefined;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    mins,
  );
}

export function diffMinutes(a: Date, b: Date): number {
  const diff = (b.getTime() - a.getTime()) / 60000;
  return diff < 0 ? Math.ceil(diff) : Math.floor(diff);
}

export function startOfLocalDayMs(now: number): number {
  return toLocalMidnight(new Date(now)).getTime();
}

export function addLocalDaysMs(startDayMs: number, days: number): number {
  const date = new Date(startDayMs);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  ).getTime();
}

export function getLocalDayNumber(epochMs: number): number {
  const date = new Date(epochMs);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

export function diffLocalDays(targetMs: number, referenceMs: number): number {
  return getLocalDayNumber(targetMs) - getLocalDayNumber(referenceMs);
}
