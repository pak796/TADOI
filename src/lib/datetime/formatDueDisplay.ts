import { diffLocalDays, startOfLocalDayMs } from "../../domain/dates";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

function formatTimeOfDay(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  if (minutes === 0) {
    return `${String(hours12)}${period}`;
  }
  return `${String(hours12)}:${String(minutes).padStart(2, "0")}${period}`;
}

function formatCalendarDate(date: Date, includeYear: boolean): string {
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  const day = String(date.getDate());
  const month = MONTHS_SHORT[date.getMonth()];
  const base = `${weekday} ${day} ${month}`;
  return includeYear ? `${base} ${String(date.getFullYear())}` : base;
}

/**
 * Render a due date in a friendly form for newcomer-readable list output.
 *
 * Examples (no explicit time):
 *   today, tomorrow, yesterday, in 3d, 2d overdue,
 *   Fri 15 May, Fri 15 May 2027, Fri 15 May (overdue)
 * Examples (with explicit time):
 *   today 2:30pm, tomorrow 9am, Fri 15 May 2:30pm
 *
 * For machine-readable contexts pass through epoch ms or ISO directly instead.
 */
export function formatDueDisplay(
  dueAt: number,
  now: number,
  hasExplicitTime: boolean
): string {
  const startToday = startOfLocalDayMs(now);
  const dayDiff = diffLocalDays(dueAt, startToday);
  const dueDate = new Date(dueAt);
  const timeSuffix = hasExplicitTime ? ` ${formatTimeOfDay(dueDate)}` : "";

  if (dayDiff === 0) {
    return `today${timeSuffix}`;
  }
  if (dayDiff === 1) {
    return `tomorrow${timeSuffix}`;
  }
  if (dayDiff === -1) {
    return `yesterday${timeSuffix}`;
  }

  const includeYear = dueDate.getFullYear() !== new Date(now).getFullYear();
  const calendar = formatCalendarDate(dueDate, includeYear);

  if (dayDiff > 1 && dayDiff < 7) {
    return `in ${String(dayDiff)}d${timeSuffix}`;
  }
  if (dayDiff < -1 && dayDiff > -7) {
    return `${String(-dayDiff)}d overdue${timeSuffix}`;
  }
  if (dayDiff < 0) {
    return `${calendar}${timeSuffix} (overdue)`;
  }
  return `${calendar}${timeSuffix}`;
}
