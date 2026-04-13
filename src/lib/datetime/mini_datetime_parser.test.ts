import { describe, expect, it } from "bun:test";
import { parseMiniDateTime } from "./mini_datetime_parser";

const CHICAGO_TZ = "America/Chicago";
const NOW_2026_03_02_10 = Date.parse("2026-03-02T10:00:00-06:00");
const NOW_2026_03_02_16 = Date.parse("2026-03-02T16:00:00-06:00");

describe("parseMiniDateTime", () => {
  it('parses "today" as date only', () => {
    expect(parseMiniDateTime("today", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-02",
      time24: null,
      precision: "date",
      source: "mini",
    });
  });

  it('parses "tomorrow" as date only', () => {
    expect(
      parseMiniDateTime("tomorrow", NOW_2026_03_02_10, CHICAGO_TZ),
    ).toEqual({
      ok: true,
      dateISO: "2026-03-03",
      time24: null,
      precision: "date",
      source: "mini",
    });
  });

  it("parses weekday tokens with include-today behavior", () => {
    expect(parseMiniDateTime("mon", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-02",
      time24: null,
      precision: "date",
      source: "mini",
    });

    expect(parseMiniDateTime("tue", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-03",
      time24: null,
      precision: "date",
      source: "mini",
    });
  });

  it('parses offsets like "+3d"', () => {
    expect(parseMiniDateTime("+3d", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-05",
      time24: null,
      precision: "date",
      source: "mini",
    });
  });

  it('parses "3pm" as today when still in the future', () => {
    expect(parseMiniDateTime("3pm", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-02",
      time24: "15:00",
      precision: "datetime",
      source: "mini",
    });
  });

  it('parses "3pm" as tomorrow when already passed today', () => {
    expect(parseMiniDateTime("3pm", NOW_2026_03_02_16, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-03",
      time24: "15:00",
      precision: "datetime",
      source: "mini",
    });
  });

  it('parses "mon 3pm" as today or next week based on now', () => {
    expect(parseMiniDateTime("mon 3pm", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual(
      {
        ok: true,
        dateISO: "2026-03-02",
        time24: "15:00",
        precision: "datetime",
        source: "mini",
      },
    );

    expect(parseMiniDateTime("mon 3pm", NOW_2026_03_02_16, CHICAGO_TZ)).toEqual(
      {
        ok: true,
        dateISO: "2026-03-09",
        time24: "15:00",
        precision: "datetime",
        source: "mini",
      },
    );
  });

  it('parses 24h tokens like "15:30"', () => {
    expect(parseMiniDateTime("15:30", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: true,
      dateISO: "2026-03-02",
      time24: "15:30",
      precision: "datetime",
      source: "mini",
    });
  });

  it('returns AMBIGUOUS_TIME for "3"', () => {
    expect(parseMiniDateTime("3", NOW_2026_03_02_10, CHICAGO_TZ)).toEqual({
      ok: false,
      code: "AMBIGUOUS_TIME",
      message: 'Ambiguous time token "3"',
    });
  });

  it('returns UNKNOWN_TOKEN for "next mon"', () => {
    expect(
      parseMiniDateTime("next mon", NOW_2026_03_02_10, CHICAGO_TZ),
    ).toEqual({
      ok: false,
      code: "UNKNOWN_TOKEN",
      message: 'Unknown token "next"',
    });
  });
});
