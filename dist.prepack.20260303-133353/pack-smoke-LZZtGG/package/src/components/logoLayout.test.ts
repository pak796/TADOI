import { describe, expect, it } from "bun:test";
import { LOGO_MAX_WIDTH, LOGO_VARIANTS } from "../brand/brand";
import { centerLogoInBox } from "./logoLayout";

describe("centerLogoInBox", () => {
  it("trims only top/bottom empty rows before centering vertically", () => {
    const centered = centerLogoInBox(["   ", " AA ", " BB ", "   "], 6, 6);

    expect(centered).toEqual([
      "      ",
      "      ",
      "  AA  ",
      "  BB  ",
      "      ",
      "      "
    ]);
  });

  it("centers content horizontally within the box", () => {
    const centered = centerLogoInBox(["XX"], 7, 3);

    expect(centered).toEqual(["       ", "  XX   ", "       "]);
  });

  it("preserves blank rows inside content bounds", () => {
    const centered = centerLogoInBox(["", "AAA", "   ", "BBB", ""], 7, 7);

    expect(centered).toEqual([
      "       ",
      "       ",
      "  AAA  ",
      "       ",
      "  BBB  ",
      "       ",
      "       "
    ]);
  });

  it("truncates overflow lines to box width", () => {
    const centered = centerLogoInBox(["ABCDEFGHI"], 5, 1);

    expect(centered).toEqual(["ABCDE"]);
  });

  it("returns exact box dimensions and fixed line widths", () => {
    const centered = centerLogoInBox(["X"], 4, 3);

    expect(centered).toHaveLength(3);
    for (const line of centered) {
      expect(line).toHaveLength(4);
    }
  });

  it("returns a blank box when source has no non-space content", () => {
    const centered = centerLogoInBox(["", "   ", ""], 4, 2);

    expect(centered).toEqual(["    ", "    "]);
  });

  it("keeps all centered logo variants within fixed width/height constraints", () => {
    const boxHeight = Math.max(...Object.values(LOGO_VARIANTS).map((lines) => lines.length));

    for (const lines of Object.values(LOGO_VARIANTS)) {
      const centered = centerLogoInBox(lines, LOGO_MAX_WIDTH, boxHeight);
      expect(centered).toHaveLength(boxHeight);
      for (const line of centered) {
        expect(line).toHaveLength(LOGO_MAX_WIDTH);
      }
    }
  });
});
