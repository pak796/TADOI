import { describe, expect, it } from "bun:test";
import type { CreatedCompleted7d } from "../domain/dashboard";
import {
  buildDueBucketLines,
  buildKpiCompactLine,
  buildThroughputLines,
  buildTopTagRows,
  gateThroughputByStatus,
  renderBlockBar,
  resolveDashboardHeightPolicy,
  resolveBottomRowLayout,
  resolveDashboardLayout,
  truncateLine,
  type KpiItem,
} from "./DashboardPane";

describe("DashboardPane helpers", () => {
  it("truncates long lines with ellipsis", () => {
    expect(truncateLine("abcdef", 4)).toBe("a...");
    expect(truncateLine("abc", 10)).toBe("abc");
  });

  it("renders block bars with fixed width", () => {
    const bar = renderBlockBar(1, 10, 8);
    expect(bar.length).toBe(8);
    expect(bar.trim().length).toBeGreaterThan(0);
    expect(renderBlockBar(0, 10, 5)).toBe(" ".repeat(5));
  });

  it("resolves dashboard layout based on width", () => {
    const narrow = resolveDashboardLayout(50);
    expect(narrow.stacked).toBe(true);
    const wide = resolveDashboardLayout(140);
    expect(wide.stacked).toBe(false);
    expect(wide.chartPanelWidth).toBeGreaterThanOrEqual(48);
    expect(wide.rightPanelWidth).toBeGreaterThanOrEqual(28);
  });

  it("resolves bottom panel layout based on width", () => {
    expect(resolveBottomRowLayout(50).stacked).toBe(true);
    expect(resolveBottomRowLayout(100).stacked).toBe(false);
  });

  it("builds due-bucket chart lines and falls back on narrow widths", () => {
    expect(buildDueBucketLines([1, 2, 0, 0, 0, 0, 0, 0], 2, 30)).toEqual([
      "(widen to view chart)",
    ]);
    const lines = buildDueBucketLines([1, 2, 3, 0, 0, 0, 0, 0], 3, 64);
    expect(lines.length).toBe(8);
    expect(lines[0]?.startsWith("OVD")).toBe(true);
  });

  it("builds top-tag rows and truncates label width", () => {
    const rows = buildTopTagRows(
      [{ tag: "verylongtagnamefortruncation", count: 3 }],
      30,
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.label.length).toBeLessThanOrEqual(12);
    expect(rows[0]?.bar.length).toBeGreaterThan(0);
  });

  it("gates throughput by filter status", () => {
    const throughput: CreatedCompleted7d = {
      labels: ["M", "T", "W", "T", "F", "S", "S"],
      created: [1, 0, 2, 0, 1, 0, 0],
      completed: [0, 1, 0, 2, 0, 1, 0],
      totals: { created: 4, completed: 4, net: 0 },
    };

    const openOnly = gateThroughputByStatus(throughput, "open");
    expect(openOnly.completed.every((value) => value === 0)).toBe(true);
    expect(openOnly.totals.completed).toBe(0);
    expect(openOnly.totals.net).toBe(openOnly.totals.created);

    const doneOnly = gateThroughputByStatus(throughput, "done");
    expect(doneOnly.created.every((value) => value === 0)).toBe(true);
    expect(doneOnly.totals.created).toBe(0);
    expect(doneOnly.totals.net).toBe(-doneOnly.totals.completed);
  });

  it("renders throughput lines with totals", () => {
    const throughput: CreatedCompleted7d = {
      labels: ["M", "T", "W", "T", "F", "S", "S"],
      created: [1, 0, 0, 0, 0, 0, 0],
      completed: [0, 0, 0, 0, 0, 0, 0],
      totals: { created: 1, completed: 0, net: 1 },
    };
    const lines = buildThroughputLines(throughput, 48);
    expect(lines.length).toBe(4);
    expect(lines[3]).toContain("NET: +1");
  });

  it("renders throughput magnitude with shared per-day scaling", () => {
    const throughput: CreatedCompleted7d = {
      labels: ["M", "T", "W", "T", "F", "S", "S"],
      created: [1, 20, 0, 0, 0, 0, 0],
      completed: [0, 0, 0, 0, 0, 0, 0],
      totals: { created: 21, completed: 0, net: 21 },
    };
    const lines = buildThroughputLines(throughput, 56);
    const createdGrid = lines[1].replace("CRE: ", "");
    const lowCell = createdGrid.slice(0, 3);
    const highCell = createdGrid.slice(3, 6);
    expect(highCell.trim().length).toBeGreaterThan(lowCell.trim().length);
  });

  it("resolves deterministic height collapse policy", () => {
    expect(resolveDashboardHeightPolicy(24)).toEqual({
      showFilterSummary: true,
      dueTop: "summary",
      priority: "summary",
      bottom: "hidden",
    });
    expect(resolveDashboardHeightPolicy(17)).toEqual({
      showFilterSummary: false,
      dueTop: "full",
      priority: "summary",
      bottom: "hidden",
    });
    expect(resolveDashboardHeightPolicy(10)).toEqual({
      showFilterSummary: false,
      dueTop: "summary",
      priority: "summary",
      bottom: "hidden",
    });
  });

  it("builds compact KPI line constrained to width", () => {
    const items: KpiItem[] = [
      { label: "OVERDUE", shortLabel: "OVD", value: 12 },
      { label: "TODAY", shortLabel: "TOD", value: 5 },
      { label: "NEXT7", shortLabel: "N7", value: 20 },
      { label: "OPEN", shortLabel: "OPN", value: 30 },
      { label: "DONE7D", shortLabel: "D7", value: 9 },
    ];
    const compact = buildKpiCompactLine(items, 18);
    expect(compact.length).toBeLessThanOrEqual(18);
  });
});
