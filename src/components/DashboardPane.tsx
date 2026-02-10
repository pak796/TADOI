import React from "react";
import { colorForTag, theme } from "../app/theme";
import {
  computeDueBuckets8,
  type TopTagCount
} from "../domain/dashboard";
import { computeDashboardKpis } from "../domain/dashboardKpis";
import { Filters, Task } from "../domain/models";
import { formatTagForDisplay } from "../domain/tagIndex";

const DUE_BUCKET_LABELS = ["OVD", "TOD", "+1", "+2", "+3", "+4", "+5", "+6"] as const;
const KPI_ORDER = ["OVERDUE", "TODAY", "NEXT7", "OPEN", "DONE7D"] as const;
const KPI_SHORT_LABELS = ["OVD", "TOD", "N7", "OPN", "D7"] as const;
const KPI_BLOCKS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const;

const DASHBOARD_GUTTER = 2;
const DASHBOARD_LEFT_RATIO = 2;
const DASHBOARD_RIGHT_RATIO = 1;
const TAG_LABEL_COL_WIDTH = 12;
const BAR_COL_WIDTH = 14;
// Width required for top-tag rows to remain legible/aligned.
const MIN_RIGHT_PANEL_WIDTH = 28;
const MIN_DUE_BUCKET_CHART_WIDTH = 48;
const PANEL_HORIZONTAL_OVERHEAD = 4;
const MIN_CHART_BAR_SLOTS = 8;
const KPI_GAP = 2;
const KPI_MIN_CELL_WIDTH = 14;
const KPI_MIN_METER_WIDTH = 4;

type DashboardPaneProps = {
  tasks: Task[];
  filters: Filters;
  topTags: TopTagCount[];
  selectedTopTagIndex: number;
  now: number;
  width: number;
  height: number;
};

type DashboardLayout = {
  stacked: boolean;
  chartPanelWidth: number;
  rightPanelWidth: number;
};

type TopTagRow = {
  tag: string;
  label: string;
  labelPad: number;
  bar: string;
  countText: string;
};

type KpiItem = {
  label: (typeof KPI_ORDER)[number];
  shortLabel: string;
  value: number;
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
  const minSplitWidth = MIN_DUE_BUCKET_CHART_WIDTH + MIN_RIGHT_PANEL_WIDTH + DASHBOARD_GUTTER;

  if (usableWidth < minSplitWidth) {
    return {
      stacked: true,
      chartPanelWidth: usableWidth,
      rightPanelWidth: usableWidth
    };
  }

  const splitWidth = usableWidth - DASHBOARD_GUTTER;
  const ratioTotal = DASHBOARD_LEFT_RATIO + DASHBOARD_RIGHT_RATIO;
  let chartPanelWidth = Math.floor((splitWidth * DASHBOARD_LEFT_RATIO) / ratioTotal);
  let rightPanelWidth = splitWidth - chartPanelWidth;

  if (chartPanelWidth < MIN_DUE_BUCKET_CHART_WIDTH) {
    chartPanelWidth = MIN_DUE_BUCKET_CHART_WIDTH;
    rightPanelWidth = splitWidth - chartPanelWidth;
  }
  if (rightPanelWidth < MIN_RIGHT_PANEL_WIDTH) {
    rightPanelWidth = MIN_RIGHT_PANEL_WIDTH;
    chartPanelWidth = splitWidth - rightPanelWidth;
  }

  if (chartPanelWidth < MIN_DUE_BUCKET_CHART_WIDTH || rightPanelWidth < MIN_RIGHT_PANEL_WIDTH) {
    return {
      stacked: true,
      chartPanelWidth: usableWidth,
      rightPanelWidth: usableWidth
    };
  }

  return {
    stacked: false,
    chartPanelWidth,
    rightPanelWidth
  };
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

function formatTagLabel(tag: string, width: number): string {
  const formatted = formatTagForDisplay(tag);
  if (formatted.length <= width) return formatted;
  if (width <= 3) {
    return ".".repeat(width);
  }
  return `${formatted.slice(0, width - 3)}...`;
}

function buildTopTagRows(topTags: TopTagCount[], panelWidth: number): TopTagRow[] {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const maxCount = Math.max(0, ...topTags.map((entry) => entry.count));
  const countWidth = Math.max(2, String(maxCount).length);
  const maxBarWidth = innerWidth - TAG_LABEL_COL_WIDTH - 1 - 1 - countWidth;

  if (maxBarWidth < 1) {
    return [];
  }

  const barWidth = Math.max(1, Math.min(BAR_COL_WIDTH, maxBarWidth));

  return topTags.map(({ tag, count }) => {
    const label = formatTagLabel(tag, TAG_LABEL_COL_WIDTH);
    const labelPad = Math.max(0, TAG_LABEL_COL_WIDTH - label.length);
    const rawLen = maxCount <= 0 ? 0 : Math.round((count / maxCount) * barWidth);
    const barLen = count > 0 ? Math.max(1, rawLen) : 0;
    const clampedBarLen = Math.max(0, Math.min(barWidth, barLen));
    const bar = `${"#".repeat(clampedBarLen)}${" ".repeat(barWidth - clampedBarLen)}`;
    return {
      tag,
      label,
      labelPad,
      bar,
      countText: String(count).padStart(countWidth, " ")
    };
  });
}

function renderMeter(value: number, max: number, width: number): string {
  if (width <= 0) return "";
  if (max <= 0 || value <= 0) return " ".repeat(width);

  const clampedValue = Math.max(0, value);
  const totalEighths = Math.max(
    1,
    Math.min(width * 8, Math.round((clampedValue / max) * width * 8))
  );
  const fullBlocks = Math.floor(totalEighths / 8);
  const partial = totalEighths % 8;
  const partialChar = partial === 0 ? "" : KPI_BLOCKS[partial];
  const consumed = fullBlocks + (partialChar ? 1 : 0);
  const spaces = Math.max(0, width - consumed);

  return `${"█".repeat(fullBlocks)}${partialChar}${" ".repeat(spaces)}`;
}

function buildKpiItems(
  tasks: Task[],
  now: number
): KpiItem[] {
  const kpis = computeDashboardKpis(tasks, now);
  return [
    { label: KPI_ORDER[0], shortLabel: KPI_SHORT_LABELS[0], value: kpis.overdue },
    { label: KPI_ORDER[1], shortLabel: KPI_SHORT_LABELS[1], value: kpis.today },
    { label: KPI_ORDER[2], shortLabel: KPI_SHORT_LABELS[2], value: kpis.next7 },
    { label: KPI_ORDER[3], shortLabel: KPI_SHORT_LABELS[3], value: kpis.open },
    { label: KPI_ORDER[4], shortLabel: KPI_SHORT_LABELS[4], value: kpis.done7d }
  ];
}

function getKpiColor(label: KpiItem["label"]): string {
  return label === "DONE7D" ? theme.ok : theme.accentBlue;
}

function buildKpiCompactLine(items: KpiItem[], width: number): string {
  const parts = items.map((item) => `${item.shortLabel}:${item.value}`);
  const compact = parts.join("  ");
  return truncateLine(compact, Math.max(10, width));
}

export function DashboardPane({
  tasks,
  filters,
  topTags,
  selectedTopTagIndex,
  now,
  width,
  height
}: DashboardPaneProps) {
  const dueBuckets = React.useMemo(() => computeDueBuckets8(tasks, now), [tasks, now]);
  const kpiItems = React.useMemo(() => buildKpiItems(tasks, now), [tasks, now]);
  const layout = React.useMemo(() => resolveDashboardLayout(width), [width]);
  const maxBucket = Math.max(0, ...dueBuckets);
  const headerWidth = Math.max(20, width - 2);
  const showFilterSummary = height >= 14;
  const openOnlyUnavailable =
    filters.status === "done" || filters.status === "archived";
  const clampedTagIndex =
    topTags.length === 0
      ? 0
      : Math.max(0, Math.min(selectedTopTagIndex, topTags.length - 1));

  const dueLines = React.useMemo(
    () => buildDueBucketLines(dueBuckets, maxBucket, layout.chartPanelWidth),
    [dueBuckets, maxBucket, layout.chartPanelWidth]
  );
  const topTagRows = React.useMemo(
    () => buildTopTagRows(topTags, layout.rightPanelWidth),
    [topTags, layout.rightPanelWidth]
  );
  const dashboardContentWidth = layout.stacked
    ? layout.chartPanelWidth
    : layout.chartPanelWidth + DASHBOARD_GUTTER + layout.rightPanelWidth;
  const kpiMax = Math.max(0, ...kpiItems.map((item) => item.value));
  const kpiStripInnerWidth = Math.max(10, dashboardContentWidth - PANEL_HORIZONTAL_OVERHEAD);
  const kpiFullMode =
    kpiStripInnerWidth >= KPI_ORDER.length * KPI_MIN_CELL_WIDTH + (KPI_ORDER.length - 1) * KPI_GAP;
  const kpiCellWidths = React.useMemo(() => {
    if (!kpiFullMode) {
      return [];
    }
    const totalGap = (KPI_ORDER.length - 1) * KPI_GAP;
    const usableWidth = Math.max(KPI_ORDER.length, kpiStripInnerWidth - totalGap);
    const baseWidth = Math.floor(usableWidth / KPI_ORDER.length);
    const remainder = usableWidth - baseWidth * KPI_ORDER.length;
    return KPI_ORDER.map((_, index) => baseWidth + (index < remainder ? 1 : 0));
  }, [kpiFullMode, kpiStripInnerWidth]);
  const kpiValueWidth = Math.max(2, String(kpiMax).length);
  const kpiCompactLine = React.useMemo(
    () =>
      buildKpiCompactLine(
        kpiItems,
        kpiStripInnerWidth
      ),
    [kpiItems, kpiStripInnerWidth]
  );
  const kpiCompactFits = React.useMemo(() => {
    const compact = kpiItems.map((item) => `${item.shortLabel}:${item.value}`).join("  ");
    return compact.length <= kpiStripInnerWidth;
  }, [kpiItems, kpiStripInnerWidth]);

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

      <box
        style={{
          ...panelStyle,
          width: dashboardContentWidth,
          marginTop: showFilterSummary ? 1 : 0
        }}
      >
        <text style={{ color: theme.text, fontWeight: "bold" }}>KPI STRIP</text>
        {kpiFullMode ? (
          <box style={{ flexDirection: "row", gap: KPI_GAP }}>
            {kpiItems.map((item, index) => {
              const cellWidth = kpiCellWidths[index] ?? KPI_MIN_CELL_WIDTH;
              const cellColor = getKpiColor(item.label);
              const meterWidth = Math.max(KPI_MIN_METER_WIDTH, cellWidth - (kpiValueWidth + 1));
              return (
                <box key={`kpi-${item.label}`} style={{ flexDirection: "column", width: cellWidth }}>
                  <text style={{ color: cellColor }}>
                    {truncateLine(item.label, cellWidth)}
                  </text>
                  <box style={{ flexDirection: "row" }}>
                    <text style={{ color: cellColor }}>
                      {String(item.value).padStart(kpiValueWidth, " ")}
                    </text>
                    <text style={{ color: theme.text }}> </text>
                    <text style={{ color: cellColor }}>
                      {renderMeter(item.value, kpiMax, meterWidth)}
                    </text>
                  </box>
                </box>
              );
            })}
          </box>
        ) : (
          kpiCompactFits ? (
            <box style={{ flexDirection: "row" }}>
              {kpiItems.map((item, index) => (
                <React.Fragment key={`kpi-compact-${item.label}`}>
                  <text style={{ color: getKpiColor(item.label) }}>
                    {`${item.shortLabel}:${item.value}`}
                  </text>
                  {index < kpiItems.length - 1 ? (
                    <text style={{ color: theme.text }}>  </text>
                  ) : null}
                </React.Fragment>
              ))}
            </box>
          ) : (
            <text style={{ color: theme.text }}>
              {kpiCompactLine}
            </text>
          )
        )}
      </box>

      {layout.stacked ? (
        <box style={{ flexDirection: "column", width: dashboardContentWidth, marginTop: 1, gap: 1 }}>
          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>
              DUE BUCKETS (OVD, TODAY, +1..+6)
            </text>
            {dueLines.map((line, index) => (
              <text key={`due-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>TOP TAGS (OPEN)</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>(Top tags available for OPEN tasks only)</text>
            ) : topTags.length === 0 ? (
              <text style={{ color: theme.muted }}>(No tagged open tasks)</text>
            ) : topTagRows.length === 0 ? (
              <text style={{ color: theme.muted }}>(widen to view chart)</text>
            ) : (
              topTagRows.map((row, index) => {
                const selected = index === clampedTagIndex;
                return (
                  <box key={`top-tag-${index}`} style={{ flexDirection: "row" }}>
                    <box style={{ backgroundColor: colorForTag(row.tag) }}>
                      <text
                        style={{
                          color: theme.bg,
                          fontWeight: selected ? "bold" : "normal"
                        }}
                      >
                        {row.label}
                      </text>
                    </box>
                    {row.labelPad > 0 ? (
                      <text style={{ color: theme.text }}>{" ".repeat(row.labelPad)}</text>
                    ) : null}
                    <text style={{ color: theme.text }}> </text>
                    <text style={{ color: theme.text }}>{row.bar}</text>
                    <text style={{ color: theme.text }}> </text>
                    <text style={{ color: theme.muted }}>{row.countText}</text>
                  </box>
                );
              })
            )}
          </box>
        </box>
      ) : (
        <box style={{ flexDirection: "row", marginTop: 1, width: dashboardContentWidth }}>
          <box style={{ ...panelStyle, width: layout.chartPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>
              DUE BUCKETS (OVD, TODAY, +1..+6)
            </text>
            {dueLines.map((line, index) => (
              <text key={`due-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ width: DASHBOARD_GUTTER }} />

          <box style={{ ...panelStyle, width: layout.rightPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>TOP TAGS (OPEN)</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>(Top tags available for OPEN tasks only)</text>
            ) : topTags.length === 0 ? (
              <text style={{ color: theme.muted }}>(No tagged open tasks)</text>
            ) : topTagRows.length === 0 ? (
              <text style={{ color: theme.muted }}>(widen to view chart)</text>
            ) : (
              topTagRows.map((row, index) => {
                const selected = index === clampedTagIndex;
                return (
                  <box key={`top-tag-${index}`} style={{ flexDirection: "row" }}>
                    <box style={{ backgroundColor: colorForTag(row.tag) }}>
                      <text
                        style={{
                          color: theme.bg,
                          fontWeight: selected ? "bold" : "normal"
                        }}
                      >
                        {row.label}
                      </text>
                    </box>
                    {row.labelPad > 0 ? (
                      <text style={{ color: theme.text }}>{" ".repeat(row.labelPad)}</text>
                    ) : null}
                    <text style={{ color: theme.text }}> </text>
                    <text style={{ color: theme.text }}>{row.bar}</text>
                    <text style={{ color: theme.text }}> </text>
                    <text style={{ color: theme.muted }}>{row.countText}</text>
                  </box>
                );
              })
            )}
          </box>
        </box>
      )}
    </box>
  );
}
