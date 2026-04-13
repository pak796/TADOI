export type SuggestedTime = { hh: string; mm: string };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getSuggestedTime(now: Date): SuggestedTime {
  const next = new Date(now.getTime());
  next.setHours(now.getHours() + 1);
  return { hh: pad2(next.getHours()), mm: pad2(next.getMinutes()) };
}

export function getAutocompleteStep(
  value: string,
  suggested: SuggestedTime,
): "hour" | "minute" | "none" | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return "hour";
  if (!/^\d{1,2}(:\d{0,2})?$/.test(trimmed)) return "invalid";

  const parts = trimmed.split(":");
  const hourPart = parts[0] ?? "";
  const minutePart = parts[1];

  if (minutePart === undefined) {
    if (hourPart.length === 1) {
      return suggested.hh.startsWith(hourPart) ? "hour" : "none";
    }
    if (hourPart.length === 2) {
      const hourNum = Number(hourPart);
      if (hourNum > 23) return "invalid";
      return hourPart === suggested.hh ? "minute" : "none";
    }
    return "invalid";
  }

  if (hourPart.length === 0) return "invalid";
  if (minutePart.length === 2) {
    const minuteNum = Number(minutePart);
    if (minuteNum > 59) return "invalid";
  }
  if (hourPart.length === 1) {
    return suggested.hh.startsWith(hourPart) ? "hour" : "none";
  }
  if (hourPart.length === 2) {
    const hourNum = Number(hourPart);
    if (hourNum > 23) return "invalid";
    if (hourPart !== suggested.hh) return "none";
    if (minutePart.length === 0) return "minute";
    if (minutePart.length === 1) {
      return suggested.mm.startsWith(minutePart) ? "minute" : "none";
    }
    if (minutePart.length === 2) {
      const minuteNum = Number(minutePart);
      if (minuteNum > 59) return "invalid";
      return "none";
    }
  }

  return "invalid";
}

export function applyAutocomplete(
  value: string,
  suggested: SuggestedTime,
  step: "hour" | "minute",
): string {
  const trimmed = value.trim();
  if (step === "hour") {
    if (trimmed.includes(":")) {
      const minutePart = trimmed.split(":")[1] ?? "";
      return `${suggested.hh}:${minutePart}`;
    }
    return suggested.hh;
  }

  if (trimmed.includes(":")) {
    const hourPart = trimmed.split(":")[0] ?? suggested.hh;
    return `${hourPart}:${suggested.mm}`;
  }
  return `${suggested.hh}:${suggested.mm}`;
}
