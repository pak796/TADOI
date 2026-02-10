import React from "react";
import { theme } from "../app/theme";
import { computeBacklogTrend7, computeDueBuckets8 } from "../domain/dashboard";
import { Filters, Task } from "../domain/models";
import { formatTagForDisplay } from "../domain/tagIndex";

const DUE_BUCKET_LABELS = ["OVD", "TOD", "+1", "+2", "+3", "+4", "+5", "+6"] as const;
const SPARKLINE_LEVELS = ["_", ".", ":", "-", "=", "+", "*", "#"] as const;

type DashboardPaneProps = {
  tasks: Task[];
  filters: Filters;
  now: number;
  width: number;
  height: number;
};

function getFilterLine(filters: Filters): string {
  const status = filters.status.toUpperCase();
  const due = filters.due === "next7" ? "NEXT7" : filters.due.toUpperCase();
  const tag = filters.tag ? formatTagForDisplay(filters.tag) : "(none)";
  const search = filters.searchText?.trim() ? filters.searchText.trim() : "(none)";
  return `STATUS=${status} DUE=${due} TAG=${tag} SEARCH=${search}`;
}

function buildBar(label: string, value: number, maxValue: number, width: number): string {
  const clampedWidth = Math.max(4, width);
  const filled =
    maxValue <= 0
      ? 0
      : Math.max(0, Math.min(clampedWidth, Math.round((value / maxValue) * clampedWidth)));
  const bar = `${"#".repeat(filled)}${" ".repeat(clampedWidth - filled)}`;
  return `${label.padEnd(3, " ")} |${bar}| ${value}`;
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

export function DashboardPane({ tasks, filters, now, width, height }: DashboardPaneProps) {
  const dueBuckets = React.useMemo(() => computeDueBuckets8(tasks, now), [tasks, now]);
  const backlogTrend = React.useMemo(() => computeBacklogTrend7(tasks, now), [tasks, now]);
  const maxBucket = Math.max(0, ...dueBuckets);
  const minTrend = Math.min(...backlogTrend);
  const maxTrend = Math.max(...backlogTrend);
  const deltaTrend = backlogTrend[backlogTrend.length - 1] - backlogTrend[0];

  const barChartWidth = Math.max(8, Math.min(28, width - 24));
  const bars = DUE_BUCKET_LABELS.map((label, index) =>
    buildBar(label, dueBuckets[index], maxBucket, barChartWidth)
  );
  const sparkline = buildSparkline(backlogTrend);

  return (
    <box
      style={{
        flexDirection: "column",
        gap: 0,
        width: "100%",
        height: "100%"
      }}
    >
      <text style={{ color: theme.text, fontWeight: "bold" }}>DASHBOARD</text>
      <text style={{ color: theme.muted }}>Filtered tasks: {tasks.length}</text>
      <text style={{ color: theme.muted }}>{getFilterLine(filters)}</text>

      <text style={{ color: theme.text, marginTop: 1 }}>DUE BUCKETS (OVD, TODAY, +1..+6)</text>
      {bars.map((line) => (
        <text key={line} style={{ color: theme.text }}>
          {line}
        </text>
      ))}

      <text style={{ color: theme.text, marginTop: 1 }}>
        BACKLOG TREND (OPEN EOD, LAST 7 DAYS)
      </text>
      <text style={{ color: theme.muted }}>DAYS:  -6 -5 -4 -3 -2 -1  0</text>
      <text style={{ color: theme.text }}>VALS: {formatTrendValues(backlogTrend)}</text>
      <text style={{ color: theme.text }}>PLOT: {sparkline}</text>
      <text style={{ color: theme.muted }}>
        MIN {minTrend}  MAX {maxTrend}  DELTA {deltaTrend >= 0 ? `+${deltaTrend}` : `${deltaTrend}`}
      </text>
      <text style={{ color: theme.muted }}>
        Press b to return to list. Use f/g/t to change filters.
      </text>
      <text style={{ color: theme.muted }}>
        Viewport: {Math.max(0, width)}x{Math.max(0, height)}
      </text>
    </box>
  );
}
