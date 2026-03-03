import { RRule } from "rrule";
import { parseLocalIsoToDate } from "../domain/recurrence/rruleAdapter";

type ExdateValueKind = "date" | "date-time";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateToIcsDate(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  return `${yyyy}${mm}${dd}`;
}

function formatDateToIcsDateTime(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}`;
}

export function normalizeRRuleFragment(rrule: string): string {
  const trimmed = rrule.trim();
  if (!trimmed) return "";
  if (trimmed.toUpperCase().startsWith("RRULE:")) {
    return trimmed.slice("RRULE:".length).trim();
  }
  return trimmed;
}

export function isValidRRuleFragment(rrule: string): boolean {
  const normalized = normalizeRRuleFragment(rrule);
  if (!normalized) return false;
  if (!/(^|;)FREQ=/.test(normalized.toUpperCase())) {
    return false;
  }
  try {
    RRule.fromString(normalized);
    return true;
  } catch {
    return false;
  }
}

export function toRRuleLine(rrule: string): string {
  const normalized = normalizeRRuleFragment(rrule);
  return `RRULE:${normalized}`;
}

export function localIsoToIcsDate(localIso: string): string | undefined {
  const parsed = parseLocalIsoToDate(localIso);
  if (!parsed) return undefined;
  return formatDateToIcsDate(parsed);
}

export function localIsoToIcsDateTime(localIso: string): string | undefined {
  const parsed = parseLocalIsoToDate(localIso);
  if (!parsed) return undefined;
  return formatDateToIcsDateTime(parsed);
}

export function formatRecurrenceExdates(
  exdates: string[] | undefined,
  kind: ExdateValueKind
): string[] {
  if (!exdates || exdates.length === 0) return [];
  const mapped = exdates
    .map((value) =>
      kind === "date" ? localIsoToIcsDate(value) : localIsoToIcsDateTime(value)
    )
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  return Array.from(new Set(mapped)).sort();
}
