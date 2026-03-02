import { describe, expect, it } from "bun:test";
import { fitHintLine } from "../components/WhichKeyHintBar";
import { fitLeftRailHintLine } from "../components/LeftRail";
import { buildWhichKeyPopupLines } from "../components/WhichKeyPopup";
import { fitLineToWidth, pickHelpCloseButtonLabel } from "./renderingComposition";

const BASELINE_VIEWPORTS = [
  { width: 104, height: 24 },
  { width: 120, height: 30 },
  { width: 150, height: 44 }
] as const;

const RAIL_WIDTH = 36;
const HELP_PANEL_MIN_WIDTH = 96;
const HELP_PANEL_MAX_WIDTH = 124;
const HELP_PANEL_HORIZONTAL_MARGIN = 4;
const HELP_PANEL_BORDER_COLS = 2;

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return max;
  return Math.max(min, Math.min(value, max));
}

function computeHelpFooterHintWidth(terminalWidth: number): number {
  const helpPanelMaxWidth = Math.max(20, terminalWidth - HELP_PANEL_HORIZONTAL_MARGIN * 2);
  const helpPanelWidthMin = Math.min(HELP_PANEL_MIN_WIDTH, helpPanelMaxWidth);
  const helpPanelWidthMax = Math.min(HELP_PANEL_MAX_WIDTH, helpPanelMaxWidth);
  const helpPanelWidth = clamp(
    Math.floor(terminalWidth * 0.9),
    helpPanelWidthMin,
    helpPanelWidthMax
  );
  const helpPanelInnerWidth = Math.max(1, helpPanelWidth - HELP_PANEL_BORDER_COLS);
  const helpFooterWidth = Math.max(1, helpPanelInnerWidth - 2);
  const helpCloseButtonLabel = pickHelpCloseButtonLabel(Math.max(0, helpFooterWidth - 1));
  const helpCloseButtonWidth = helpCloseButtonLabel ? helpCloseButtonLabel.length + 2 : 0;
  return Math.max(
    1,
    helpFooterWidth - helpCloseButtonWidth - (helpCloseButtonWidth > 0 ? 1 : 0)
  );
}

describe("hint viewport fit contracts", () => {
  it("keeps left-rail hint lines fixed-width and ellipsized", () => {
    for (const viewport of BASELINE_VIEWPORTS) {
      const line = fitLeftRailHintLine("Ctrl+Shift+Meta+K: VERY LONG HINT LABEL", 18);
      expect(line.length).toBe(18);
      expect(line.includes("...")).toBe(true);
      expect(viewport.width).toBeGreaterThanOrEqual(104);
    }
  });

  it("fits KEYS hint bar line across baseline widths", () => {
    const items = [
      { key: "Ctrl+Shift+G", label: "jump to overdue tasks bucket" },
      { key: "Ctrl+Shift+P", label: "open priority inspector" },
      { key: "Ctrl+Shift+Y", label: "open productivity analyzer" }
    ];

    for (const viewport of BASELINE_VIEWPORTS) {
      const bottomBarWidth = Math.max(0, viewport.width - RAIL_WIDTH);
      const hintWidth = Math.max(8, bottomBarWidth - 2);
      const line = fitHintLine(items, hintWidth);
      expect(line.length).toBeLessThanOrEqual(hintWidth);
    }
  });

  it("fits prefix popup title and rows across baseline widths", () => {
    const model = {
      title: "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y",
      hints: [
        { key: "Ctrl+Shift+G", label: "jump to very first task in full list" },
        { key: "Ctrl+Shift+J", label: "jump to very last task in full list" },
        { key: "Esc", label: "cancel prefix" }
      ]
    };

    for (const viewport of BASELINE_VIEWPORTS) {
      const bottomBarWidth = Math.max(0, viewport.width - RAIL_WIDTH);
      const popupLineWidth = Math.max(18, Math.min(40, bottomBarWidth - 12));
      const lines = buildWhichKeyPopupLines(model, popupLineWidth);
      expect(lines.title.length).toBeLessThanOrEqual(popupLineWidth);
      for (const hintLine of lines.hints) {
        expect(hintLine.length).toBeLessThanOrEqual(popupLineWidth);
      }
    }
  });

  it("fits Help footer hint line across baseline widths", () => {
    const footerRaw =
      "1 Backup Center | Enter/Right on Settings opens Settings pages | Up/Down focus | Enter/Space expand | Left collapse | Esc close | Scroll";

    for (const viewport of BASELINE_VIEWPORTS) {
      const footerHintWidth = computeHelpFooterHintWidth(viewport.width);
      const line = fitLineToWidth(footerRaw, footerHintWidth);
      expect(line.length).toBe(footerHintWidth);
    }
  });
});
