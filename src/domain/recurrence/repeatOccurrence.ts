import { formatDateToLocalIso, parseLocalIsoToDate } from "./rruleAdapter";

function normalizeOccurrenceIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = parseLocalIsoToDate(value);
  return parsed ? formatDateToLocalIso(parsed) : undefined;
}

export function isRepeatOccurrenceAfterSeriesStart(
  seriesDtstartIso: string | undefined,
  occurrenceIso: string
): boolean {
  const normalizedStartIso = normalizeOccurrenceIso(seriesDtstartIso);
  const normalizedOccurrenceIso = normalizeOccurrenceIso(occurrenceIso);
  if (!normalizedStartIso || !normalizedOccurrenceIso) return false;

  const startDate = parseLocalIsoToDate(normalizedStartIso);
  const occurrenceDate = parseLocalIsoToDate(normalizedOccurrenceIso);
  if (!startDate || !occurrenceDate) {
    return normalizedOccurrenceIso > normalizedStartIso;
  }

  return occurrenceDate.getTime() > startDate.getTime();
}
