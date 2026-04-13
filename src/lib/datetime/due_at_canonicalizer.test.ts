import { describe, expect, it } from "bun:test";
import {
  canonicalizeDueAtInput,
  canonicalizeTimeOnlyInput,
} from "./due_at_canonicalizer";

const CHICAGO_TZ = "America/Chicago";
const NOW_2026_03_02_10 = Date.parse("2026-03-02T10:00:00-06:00");
const NOW_2026_03_02_16 = Date.parse("2026-03-02T16:00:00-06:00");

describe("canonicalizeDueAtInput", () => {
  it("canonicalizes mini due-only date", () => {
    expect(
      canonicalizeDueAtInput("today", undefined, {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-02",
    });
  });

  it("canonicalizes due datetime from a single mini expression", () => {
    expect(
      canonicalizeDueAtInput("tomorrow 3pm", undefined, {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-03",
      atTime: "15:00",
    });
  });

  it("canonicalizes time-only due based on now", () => {
    expect(
      canonicalizeDueAtInput("3pm", undefined, {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-02",
      atTime: "15:00",
    });

    expect(
      canonicalizeDueAtInput("3pm", undefined, {
        now: NOW_2026_03_02_16,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-03",
      atTime: "15:00",
    });
  });

  it("falls back to strict ISO date when mini parser returns UNKNOWN_TOKEN", () => {
    expect(
      canonicalizeDueAtInput("2026-03-05", undefined, {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-05",
    });
  });

  it("accepts mini time in explicit at field", () => {
    expect(
      canonicalizeDueAtInput("2026-03-05", "3pm", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: true,
      dueDate: "2026-03-05",
      atTime: "15:00",
    });
  });

  it("rejects duplicate time when due already includes time", () => {
    expect(
      canonicalizeDueAtInput("tomorrow 3pm", "09:00", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: false,
      code: "DUPLICATE_TIME",
      message: 'Error: due value already includes time; omit "at:"',
    });
  });

  it("rejects unknown tokens without fallback parsing", () => {
    expect(
      canonicalizeDueAtInput("next mon", undefined, {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_DUE",
      message: 'Error: invalid due date "next mon"',
    });
  });
});

describe("canonicalizeTimeOnlyInput", () => {
  it("accepts mini and strict time tokens", () => {
    expect(
      canonicalizeTimeOnlyInput("3pm", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({ ok: true, time24: "15:00" });

    expect(
      canonicalizeTimeOnlyInput("09:15", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({ ok: true, time24: "09:15" });
  });

  it("rejects date-only expressions for time-only fields", () => {
    expect(
      canonicalizeTimeOnlyInput("today", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_TIME",
      message: 'Error: invalid time "today"',
    });
  });

  it("rejects ambiguous times", () => {
    expect(
      canonicalizeTimeOnlyInput("3", {
        now: NOW_2026_03_02_10,
        tz: CHICAGO_TZ,
      }),
    ).toEqual({
      ok: false,
      code: "AMBIGUOUS_TIME",
      message: 'Error: ambiguous time "3"',
    });
  });
});
