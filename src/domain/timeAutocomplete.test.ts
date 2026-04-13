import { describe, expect, it } from "bun:test";
import {
  applyAutocomplete,
  getAutocompleteStep,
  getSuggestedTime,
} from "./timeAutocomplete";

describe("time autocomplete", () => {
  it("suggests one hour ahead preserving minutes", () => {
    const result = getSuggestedTime(new Date(2026, 1, 9, 12, 45, 0));
    expect(result).toEqual({ hh: "13", mm: "45" });
  });

  it("rolls over past midnight", () => {
    const result = getSuggestedTime(new Date(2026, 1, 9, 23, 30, 0));
    expect(result).toEqual({ hh: "00", mm: "30" });
  });

  it("autocompletes hour then minutes", () => {
    const suggested = { hh: "13", mm: "45" };
    expect(getAutocompleteStep("", suggested)).toBe("hour");
    expect(applyAutocomplete("", suggested, "hour")).toBe("13");
    expect(getAutocompleteStep("13", suggested)).toBe("minute");
    expect(applyAutocomplete("13", suggested, "minute")).toBe("13:45");
  });

  it("autocompletes partial hour", () => {
    const suggested = { hh: "13", mm: "45" };
    expect(getAutocompleteStep("1", suggested)).toBe("hour");
    expect(applyAutocomplete("1", suggested, "hour")).toBe("13");
  });

  it("autocompletes minutes for hour with colon", () => {
    const suggested = { hh: "13", mm: "45" };
    expect(getAutocompleteStep("13:", suggested)).toBe("minute");
    expect(applyAutocomplete("13:", suggested, "minute")).toBe("13:45");
    expect(getAutocompleteStep("13:4", suggested)).toBe("minute");
    expect(applyAutocomplete("13:4", suggested, "minute")).toBe("13:45");
  });

  it("does nothing for complete valid time", () => {
    const suggested = { hh: "13", mm: "45" };
    expect(getAutocompleteStep("09:15", suggested)).toBe("none");
  });

  it("no-ops for invalid input", () => {
    const suggested = { hh: "13", mm: "45" };
    expect(getAutocompleteStep("29", suggested)).toBe("invalid");
    expect(getAutocompleteStep("13:99", suggested)).toBe("invalid");
  });
});
