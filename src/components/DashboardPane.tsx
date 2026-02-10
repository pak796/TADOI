import React from "react";
import { theme } from "../app/theme";
import { computeBacklogTrend7, computeDueBuckets8 } from "../domain/dashboard";
import { Filters, Task } from "../domain/models";
import { formatTagForDisplay } from "../domain/tagIndex";

const DUE_BUCKET_LABELS = ["OVD", "TOD", "+1", "+2", "+3", "+4", "+5", "+6"] as const;
const SPARKLINE_LEVELS = ["_", ".", ":", "-", "=", "+", "*", "#"] as const;

const DASHBOARD_GUTTER = 2;
const DASHBOARD_LEFT_RATIO = 2;
const DASHBOARD_RIGHT_RATIO = 1;
// Width required for chart slots, labels, and counts to remain legible/aligned.
const MIN_DUE_BUCKET_CHART_WIDTH = 48;
const MIN_TREND_PANEL_WIDTH = 24;
const PANEL_HORIZONTAL_OVERHEAD = 4;
const MIN_CHART_BAR_SLOTS = 8;

type DashboardPaneProps = {
  tasks: Task[];
  filters: Filters;
  now: number;
  width: number;
  height: number;
};

type DashboardLayout = {
  stacked: boolean;
  chartPanelWidth: number;
  trendPanelWidth: number;
};

function getFilterLine(filters: Filters): string {
  const status = filters.status.toUpperCase();
  const due = filters.due === "next7" ? "NEXT7" : filters.due.toUpperCase();
  const tag = filters.tag ? formatTagForDisplay(filters.tag) : "(none)";
  const search = filters.searchText?.trim() ? filters.searchText.trim() : "(none)";
  return `STATUS=${status} DUE=${due} TAG=${tag} SEARCH=${search}`;
}

function truncateLine(value: string, width: number): string {
  const safeWidth = Math.max(4, width);
  if (value.length <= safeWidth) return value;
  if (safeWidth <= 3) return ".".repeat(safeWidth);
  return `${value.slice(0, safeWidth - 3)}...`;
}

function resolveDashboardLayout(width: number): DashboardLayout {
  const usableWidth = Math.max(20, width - 6);
  const minSplitWidth = MIN_DUE_BUCKET_CHART_WIDTH + MIN_TREND_PANEL_WIDTH + DASHBOARD_GUTTER;

  if (usableWidth < minSplitWidth) {
    return {
      stacked: true,
      chartPanelWidth: usableWidth,
      trendPanelWidth: usableWidth
    };
  }

  const splitWidth = usableWidth - DASHBOARD_GUTTER;
  const ratioTotal = DASHBOARD_LEFT_RATIO + DASHBOARD_RIGHT_RATIO;
  let chartPanelWidth = Math.floor((splitWidth * DASHBOARD_LEFT_RATIO) / ratioTotal);
  let trendPanelWidth = splitWidth - chartPanelWidth;

  if (chartPanelWidth < MIN_DUE_BUCKET_CHART_WIDTH) {
    chartPanelWidth = MIN_DUE_BUCKET_CHART_WIDTH;
    trendPanelWidth = splitWidth - chartPanelWidth;
  }
  if (trendPanelWidth < MIN_TREND_PANEL_WIDTH) {
    trendPanelWidth = MIN_TREND_PANEL_WIDTH;
    chartPanelWidth = splitWidth - trendPanelWidth;
  }

  if (chartPanelWidth < MIN_DUE_BUCKET_CHART_WIDTH || trendPanelWidth < MIN_TREND_PANEL_WIDTH) {
    return {
      stacked: true,
      chartPanelWidth: usableWidth,
      trendPanelWidth: usableWidth
    };
  }

  return {
    stacked: false,
    chartPanelWidth,
    trendPanelWidth
  };
}

function buildSparkline(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return SPARKLINE_LEVELS[0].repeat(values.length);
  }

  return values
    .map((value) => {
      const ratio = (value - min) / (max - min);
      const index = Math.max(
        0,
        Math.min(SPARKLINE_LEVELS.length - 1, Math.round(ratio * (SPARKLINE_LEVELS.length - 1)))
      );
      return SPARKLINE_LEVELS[index];
    })
    .join("");
}

function formatTrendValues(values: number[]): string {
  return values.map((value) => String(value).padStart(2, " ")).join(" ");
}

function buildDueBucketLines(
  dueBuckets: number[],
  maxBucket: number,
  chartPanelWidth: number
): string[] {
  if (chartPanelWidth < MIN_DUE_BUCKET_CHART_WIDTH) {
    return ["(widen to view chart)"];
  }

  const chartInnerWidth = Math.max(8, chartPanelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const labelWidth = 3;
  const countWidth = Math.max(2, String(maxBucket).length);
  const staticWidth = labelWidth + 1 + 1 + countWidth;
  const barWidth = chartInnerWidth - staticWidth;

  if (barWidth < MIN_CHART_BAR_SLOTS) {
    return ["(widen to view chart)"];
  }

  return DUE_BUCKET_LABELS.map((label, index) => {
    const value = dueBuckets[index];
    const filled =
      maxBucket <= 0
        ? 0
        : Math.max(0, Math.min(barWidth, Math.round((value / maxBucket) * barWidth)));
    const bar = `${"#".repeat(filled)}${" ".repeat(barWidth - filled)}`;
    const line = `${label.padEnd(labelWidth, " ")} ${bar} ${String(value).padStart(countWidth, " ")}`;
    return truncateLine(line, chartInnerWidth);
  });
}

function buildTrendLines(values: number[], panelWidth: number): string[] {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const delta = values[values.length - 1] - values[0];
  const sparkline = buildSparkline(values);

  if (innerWidth < 20) {
    return [
      truncateLine(`PLOT ${sparkline}`, innerWidth),
      truncateLine(`S:${values[0]} E:${values[values.length - 1]}`, innerWidth),
      truncateLine(`MIN:${min} MAX:${max}`, innerWidth),
      truncateLine(`DELTA ${delta >= 0 ? `+${delta}` : `${delta}`}`, innerWidth)
    ];
  }

  return [
    truncateLine("DAYS:  -6 -5 -4 -3 -2 -1  0", innerWidth),
    truncateLine(`VALS: ${formatTrendValues(values)}`, innerWidth),
    truncateLine(`PLOT: ${sparkline}`, innerWidth),
    truncateLine(`MIN ${min}  MAX ${max}  DELTA ${delta >= 0 ? `+${delta}` : `${delta}`}`, innerWidth)
  ];
}

export function DashboardPane({ tasks, filters, now, width, height }: DashboardPaneProps) {
  const dueBuckets = React.useMemo(() => computeDueBuckets8(tasks, now), [tasks, now]);
  const backlogTrend = React.useMemo(() => computeBacklogTrend7(tasks, now), [tasks, now]);
  const layout = React.useMemo(() => resolveDashboardLayout(width), [width]);
  const maxBucket = Math.max(0, ...dueBuckets);
  const headerWidth = Math.max(20, width - 2);
  const showFilterSummary = height >= 14;

  const dueLines = React.useMemo(
    () => buildDueBucketLines(dueBuckets, maxBucket, layout.chartPanelWidth),
    [dueBuckets, maxBucket, layout.chartPanelWidth]
  );
  const trendLines = React.useMemo(
    () => buildTrendLines(backlogTrend, layout.trendPanelWidth),
    [backlogTrend, layout.trendPanelWidth]
  );

  const panelStyle = {
    flexDirection: "column" as const,
    border: true,
    borderStyle: "single" as const,
    borderColor: theme.outline,
    paddingLeft: 1,
    paddingRight: 1
  };

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%"
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>
        {truncateLine(`DASHBOARD | FILTERED TASKS ${tasks.length}`, headerWidth)}
      </text>
      {showFilterSummary ? (
        <text style={{ color: theme.muted }}>{truncateLine(getFilterLine(filters), headerWidth)}</text>
      ) : null}

      {layout.stacked ? (
        <box style={{ flexDirection: "column", marginTop: showFilterSummary ? 1 : 0, gap: 1 }}>
          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>DUE BUCKETS (OVD, TODAY, +1..+6)</text>
            {dueLines.map((line, index) => (
              <text key={`due-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>BACKLOG TREND (LAST 7 DAYS)</text>
            {trendLines.map((line, index) => (
              <text key={`trend-${index}`} style={{ color: index === 2 ? theme.text : theme.muted }}>
                {line}
              </text>
            ))}
          </box>
        </box>
      ) : (
        <box style={{ flexDirection: "row", marginTop: showFilterSummary ? 1 : 0, width: "100%" }}>
          <box style={{ ...panelStyle, width: layout.chartPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>DUE BUCKETS (OVD, TODAY, +1..+6)</text>
            {dueLines.map((line, index) => (
              <text key={`due-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ width: DASHBOARD_GUTTER }} />

          <box style={{ ...panelStyle, width: layout.trendPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>BACKLOG TREND (LAST 7 DAYS)</text>
            {trendLines.map((line, index) => (
              <text key={`trend-${index}`} style={{ color: index === 2 ? theme.text : theme.muted }}>
                {line}
              </text>
            ))}
          </box>
        </box>
      )}
    </box>
  );
}
