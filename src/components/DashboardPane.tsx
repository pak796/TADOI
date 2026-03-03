import React from "react";
import { colorForTag, themeForObject } from "../app/theme";
import {
  computeBacklogTrendWindow,
  computeCreatedCompletedWindow,
  computeDueBuckets8,
  computeOverdueAgingBuckets,
  type CreatedCompleted7d,
  type OverdueAgingBucket,
  type TopTagCount
} from "../domain/dashboard";
import { computeDashboardKpisWindowed } from "../domain/dashboardKpis";
import { Filters, Task } from "../domain/models";
import { formatTagFilterBooleanSummary } from "../domain/tagFilter";
import {
  formatPriorityForDisplay,
  formatTagForReadOnlyDisplay
} from "../domain/priorityTags";

const DUE_BUCKET_LABELS = ["OVD", "TOD", "+1", "+2", "+3", "+4", "+5", "+6"] as const;
const KPI_ORDER = ["OVERDUE", "TODAY", "NEXT7", "OPEN", "DONE7D"] as const;
const KPI_SHORT_LABELS = ["OVD", "TOD", "N7", "OPN", "D7"] as const;
const BLOCK_FRACTIONS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const;

const DASHBOARD_GUTTER = 2;
const DASHBOARD_LEFT_RATIO = 2;
const DASHBOARD_RIGHT_RATIO = 1;
const TAG_LABEL_COL_WIDTH = 12;
const BAR_COL_WIDTH = 14;
const MIN_RIGHT_PANEL_WIDTH = 28;
const MIN_DUE_BUCKET_CHART_WIDTH = 48;
const PANEL_HORIZONTAL_OVERHEAD = 4;
const MIN_CHART_BAR_SLOTS = 8;
const KPI_GAP = 2;
const KPI_MIN_CELL_WIDTH = 14;
const KPI_MIN_METER_WIDTH = 4;
const MIN_DASHBOARD_TWO_COL_W = 58;
const MIN_PANEL_W = 28;
const LABEL_W = 6;
const BAR_W = 16;
const THROUGHPUT_CELL_W = 3;
const BACKLOG_CELL_W = 3;

const OVERDUE_AGING_HINT = "(Switch STATUS to ALL/OPEN to view overdue aging)";

type DashboardPaneProps = {
  tasks: Task[];
  filters: Filters;
  topTags: TopTagCount[];
  selectedTopTagIndex: number;
  selectedDueBucketIndex?: number;
  selectedPriorityIndex?: number;
  selectedAssigneeIndex?: number;
  selectedProjectIndex?: number;
  selectedWorkflowStageIndex?: number;
  analyticsWindowDays?: number;
  prioritySlices?: Array<{ value: string; count: number }>;
  assigneeSlices?: Array<{ value: string; count: number }>;
  projectSlices?: Array<{ value: string; count: number }>;
  workflowStageSlices?: Array<{ value: string; count: number }>;
  activeFocusGroup?: DashboardFocusGroup;
  selectedTaskTitle?: string;
  selectedTaskNotePath?: string;
  selectedTaskLinkedNoteCount?: number;
  captureHint?: string;
  now: number;
  width: number;
  height: number;
  onTopTagClick?: (index: number) => void;
  onDueBucketClick?: (index: number) => void;
  onPriorityClick?: (index: number) => void;
  onAssigneeClick?: (index: number) => void;
  onProjectClick?: (index: number) => void;
  onWorkflowStageClick?: (index: number) => void;
};

export type DashboardFocusGroup =
  | "top_tags"
  | "due_buckets"
  | "priority"
  | "assignee"
  | "project"
  | "workflow_stage";

export type DashboardLayout = {
  stacked: boolean;
  chartPanelWidth: number;
  rightPanelWidth: number;
};

export type PanelRowLayout = {
  stacked: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
};

export type TopTagRow = {
  tag: string;
  label: string;
  labelPad: number;
  bar: string;
  countText: string;
};

export type KpiItem = {
  label: string;
  shortLabel: string;
  value: number;
};

export type DashboardSectionDensity = "full" | "summary" | "hidden";

export type DashboardHeightPolicy = {
  showFilterSummary: boolean;
  dueTop: "full" | "summary";
  priority: DashboardSectionDensity;
  bottom: DashboardSectionDensity;
};

export function resolveDashboardHeightPolicy(height: number): DashboardHeightPolicy {
  const safeHeight = Math.max(6, height);
  if (safeHeight >= 50) {
    return {
      showFilterSummary: true,
      dueTop: "full",
      priority: "full",
      bottom: "full"
    };
  }
  if (safeHeight >= 40) {
    return {
      showFilterSummary: true,
      dueTop: "full",
      priority: "full",
      bottom: "summary"
    };
  }
  if (safeHeight >= 34) {
    return {
      showFilterSummary: true,
      dueTop: "full",
      priority: "summary",
      bottom: "summary"
    };
  }
  if (safeHeight >= 28) {
    return {
      showFilterSummary: true,
      dueTop: "full",
      priority: "summary",
      bottom: "hidden"
    };
  }
  if (safeHeight >= 22) {
    return {
      showFilterSummary: true,
      dueTop: "summary",
      priority: "summary",
      bottom: "hidden"
    };
  }
  if (safeHeight >= 16) {
    return {
      showFilterSummary: false,
      dueTop: "full",
      priority: "summary",
      bottom: "hidden"
    };
  }
  if (safeHeight >= 10) {
    return {
      showFilterSummary: false,
      dueTop: "summary",
      priority: "summary",
      bottom: "hidden"
    };
  }
  return {
    showFilterSummary: false,
    dueTop: "summary",
    priority: "hidden",
    bottom: "hidden"
  };
}

function getFilterLine(filters: Filters): string {
  const status = filters.status.toUpperCase();
  const due = filters.due === "next7" ? "NEXT7" : filters.due.toUpperCase();
  const analyticsWindow = (filters.analyticsWindow ?? "7d").toUpperCase();
  const dueOffset = filters.dueDayOffset ? `+${filters.dueDayOffset}` : "(none)";
  const priority = formatPriorityForDisplay(filters.priority) ?? "(any)";
  const booleanTagSummary = formatTagFilterBooleanSummary(filters.tagFilter);
  const tag = booleanTagSummary
    ? booleanTagSummary
    : filters.tag
      ? formatTagForReadOnlyDisplay(filters.tag)
      : "(none)";
  const search = filters.searchText?.trim() ? filters.searchText.trim() : "(none)";
  const assignee = filters.assignee?.trim() ? filters.assignee.trim() : "(any)";
  const project = filters.project?.trim() ? filters.project.trim() : "(any)";
  const stage = filters.workflowStage ?? "(any)";
  return `STATUS=${status} DUE=${due} DUE+N=${dueOffset} WIN=${analyticsWindow} PRIORITY=${priority} TAG=${tag} ASSIGNEE=${assignee} PROJECT=${project} STAGE=${stage} SEARCH=${search}`;
}

export function truncateLine(value: string, width: number): string {
  const safeWidth = Math.max(4, width);
  if (value.length <= safeWidth) return value;
  if (safeWidth <= 3) return ".".repeat(safeWidth);
  return `${value.slice(0, safeWidth - 3)}...`;
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function renderBlockBar(value: number, max: number, width: number): string {
  if (width <= 0) return "";
  if (max <= 0 || value <= 0) return " ".repeat(width);

  const clampedValue = Math.max(0, value);
  const maxEighths = width * 8;
  let totalEighths = Math.round((clampedValue / max) * maxEighths);
  if (clampedValue > 0 && totalEighths <= 0) {
    totalEighths = 1;
  }
  totalEighths = Math.max(0, Math.min(maxEighths, totalEighths));

  const fullBlocks = Math.floor(totalEighths / 8);
  const partial = totalEighths % 8;
  const partialChar = partial === 0 ? "" : BLOCK_FRACTIONS[partial];
  const consumed = fullBlocks + (partialChar ? 1 : 0);
  const spaces = Math.max(0, width - consumed);

  return `${"█".repeat(fullBlocks)}${partialChar}${" ".repeat(spaces)}`;
}

export function resolveDashboardLayout(width: number): DashboardLayout {
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

export function resolveBottomRowLayout(width: number): PanelRowLayout {
  const usableWidth = Math.max(20, width);
  const splitWidth = usableWidth - DASHBOARD_GUTTER;

  if (usableWidth < MIN_DASHBOARD_TWO_COL_W || splitWidth <= 0) {
    return {
      stacked: true,
      leftPanelWidth: usableWidth,
      rightPanelWidth: usableWidth
    };
  }

  const leftPanelWidth = Math.floor(splitWidth / 2);
  const rightPanelWidth = splitWidth - leftPanelWidth;

  if (leftPanelWidth < MIN_PANEL_W || rightPanelWidth < MIN_PANEL_W) {
    return {
      stacked: true,
      leftPanelWidth: usableWidth,
      rightPanelWidth: usableWidth
    };
  }

  return {
    stacked: false,
    leftPanelWidth,
    rightPanelWidth
  };
}

export function buildDueBucketLines(
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
    const bar = renderBlockBar(value, maxBucket, barWidth);
    const line = `${label.padEnd(labelWidth, " ")} ${bar} ${String(value).padStart(countWidth, " ")}`;
    return truncateLine(line, chartInnerWidth);
  });
}

function formatTagLabel(tag: string, width: number): string {
  const formatted = formatTagForReadOnlyDisplay(tag);
  if (formatted.length <= width) return formatted;
  if (width <= 3) {
    return ".".repeat(width);
  }
  return `${formatted.slice(0, width - 3)}...`;
}

export function buildTopTagRows(topTags: TopTagCount[], panelWidth: number): TopTagRow[] {
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
    const bar = renderBlockBar(count, maxCount, barWidth);
    return {
      tag,
      label,
      labelPad,
      bar,
      countText: String(count).padStart(countWidth, " ")
    };
  });
}

function buildOverdueAgingLines(buckets: OverdueAgingBucket[], panelWidth: number): string[] {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const maxCount = Math.max(0, ...buckets.map((bucket) => bucket.count));
  const countWidth = Math.max(1, String(maxCount).length);

  const availableBarWidth = innerWidth - LABEL_W - 1 - 1 - countWidth;
  if (availableBarWidth < 1) {
    return ["(widen to view chart)"];
  }

  const barWidth = Math.max(1, Math.min(BAR_W, availableBarWidth));
  const barRightSlack = Math.max(0, availableBarWidth - barWidth);

  return buckets.map(({ label, count }) => {
    const bar = renderBlockBar(count, maxCount, barWidth);
    const line =
      `${label.padEnd(LABEL_W, " ")} ${bar}` +
      `${" ".repeat(barRightSlack)} ${String(count).padStart(countWidth, " ")}`;
    return truncateLine(line, innerWidth);
  });
}


function renderDayGrid(labels: string[], cellWidth: number): string {
  const safeCellWidth = Math.max(2, cellWidth);
  return labels.map((label) => label.padStart(safeCellWidth, " ")).join("");
}

function renderMagnitudeRow(values: number[], max: number, cellWidth: number): string {
  const safeCellWidth = Math.max(2, cellWidth);
  return values
    .map((value) => renderBlockBar(value, max, safeCellWidth))
    .join("");
}

export function buildThroughputLines(data: CreatedCompleted7d, panelWidth: number): string[] {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const sharedMax = Math.max(
    0,
    ...data.created,
    ...data.completed
  );
  const dayGrid = renderDayGrid(data.labels, THROUGHPUT_CELL_W);
  const createdGrid = renderMagnitudeRow(data.created, sharedMax, THROUGHPUT_CELL_W);
  const completedGrid = renderMagnitudeRow(data.completed, sharedMax, THROUGHPUT_CELL_W);

  return [
    truncateLine(`DAYS: ${dayGrid}`, innerWidth),
    truncateLine(`CRE: ${createdGrid}`, innerWidth),
    truncateLine(`DON: ${completedGrid}`, innerWidth),
    truncateLine(
      `CRE 7D: ${data.totals.created}   DON 7D: ${data.totals.completed}   NET: ${formatSigned(data.totals.net)}`,
      innerWidth
    )
  ];
}

export function gateThroughputByStatus(
  throughput: CreatedCompleted7d,
  status: Filters["status"]
): CreatedCompleted7d {
  if (status === "all") {
    return throughput;
  }

  const labels = [...throughput.labels];

  if (status === "open") {
    const created = [...throughput.created];
    const completed = new Array<number>(throughput.completed.length).fill(0);
    const createdTotal = created.reduce((sum, value) => sum + value, 0);
    return {
      labels,
      created,
      completed,
      totals: {
        created: createdTotal,
        completed: 0,
        net: createdTotal
      }
    };
  }

  const created = new Array<number>(throughput.created.length).fill(0);
  const completed = [...throughput.completed];
  const completedTotal = completed.reduce((sum, value) => sum + value, 0);

  return {
    labels,
    created,
    completed,
    totals: {
      created: 0,
      completed: completedTotal,
      net: -completedTotal
    }
  };
}

function buildDueBucketSummaryLine(dueBuckets: number[], panelWidth: number): string {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const futureTotal = dueBuckets.slice(2).reduce((sum, value) => sum + value, 0);
  return truncateLine(
    `OVD:${dueBuckets[0] ?? 0} TOD:${dueBuckets[1] ?? 0} +1..+6:${futureTotal}`,
    innerWidth
  );
}

function buildTopTagSummaryLine(topTags: TopTagCount[], panelWidth: number): string {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  if (topTags.length === 0) {
    return "(No tagged open tasks)";
  }
  const summary = topTags
    .slice(0, 3)
    .map((entry) => `${formatTagForReadOnlyDisplay(entry.tag)}:${entry.count}`)
    .join("  ");
  return truncateLine(summary, innerWidth);
}

function buildBottomSummaryLine(
  overdueAgingBuckets: OverdueAgingBucket[],
  throughput: CreatedCompleted7d,
  panelWidth: number
): string {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const totalOverdue = overdueAgingBuckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return truncateLine(
    `AGING:${totalOverdue}  CRE:${throughput.totals.created}  DON:${throughput.totals.completed}  NET:${formatSigned(throughput.totals.net)}`,
    innerWidth
  );
}

function buildBacklogTrendLines(
  trend: number[],
  panelWidth: number
): string[] {
  const innerWidth = Math.max(10, panelWidth - PANEL_HORIZONTAL_OVERHEAD);
  const offsets = trend.map((_, index) => String(index - (trend.length - 1)));
  const max = Math.max(0, ...trend);
  const daysRow = renderDayGrid(offsets, BACKLOG_CELL_W);
  const valuesRow = renderMagnitudeRow(trend, max, BACKLOG_CELL_W);
  const delta = trend.length > 0 ? (trend[trend.length - 1] ?? 0) - (trend[0] ?? 0) : 0;

  return [
    truncateLine(`DAYS: ${daysRow}`, innerWidth),
    truncateLine(`OPEN: ${valuesRow}`, innerWidth),
    truncateLine(
      `NOW: ${trend[trend.length - 1] ?? 0}  START: ${trend[0] ?? 0}  DELTA: ${formatSigned(delta)}`,
      innerWidth
    )
  ];
}

function formatSliceValue(value: string): string {
  if (value.includes("_")) {
    return value.replace(/_/g, " ").toUpperCase();
  }
  return value;
}

function renderMeter(value: number, max: number, width: number): string {
  return renderBlockBar(value, max, width);
}

function buildKpiItems(
  tasks: Task[],
  now: number,
  analyticsWindow: "7d" | "14d" | "30d"
): KpiItem[] {
  const kpis = computeDashboardKpisWindowed(tasks, now, analyticsWindow);
  const windowDays = analyticsWindow === "14d" ? 14 : analyticsWindow === "30d" ? 30 : 7;
  return [
    { label: "OVERDUE", shortLabel: KPI_SHORT_LABELS[0], value: kpis.overdue },
    { label: "TODAY", shortLabel: KPI_SHORT_LABELS[1], value: kpis.today },
    { label: `NEXT${windowDays}`, shortLabel: `N${windowDays}`, value: kpis.next7 },
    { label: "OPEN", shortLabel: KPI_SHORT_LABELS[3], value: kpis.open },
    { label: `DONE${windowDays}D`, shortLabel: `D${windowDays}`, value: kpis.done7d }
  ];
}

function getKpiColor(label: KpiItem["label"]): string {
  const theme = themeForObject("dashboard");
  return label.startsWith("DONE") ? theme.ok : theme.accentBlue;
}

export function buildKpiCompactLine(items: KpiItem[], width: number): string {
  const parts = items.map((item) => `${item.shortLabel}:${item.value}`);
  const compact = parts.join("  ");
  return truncateLine(compact, Math.max(10, width));
}

export function DashboardPane({
  tasks,
  filters,
  topTags,
  selectedTopTagIndex,
  selectedDueBucketIndex = 0,
  selectedPriorityIndex = 0,
  selectedAssigneeIndex = 0,
  selectedProjectIndex = 0,
  selectedWorkflowStageIndex = 0,
  analyticsWindowDays = 7,
  prioritySlices = [],
  assigneeSlices = [],
  projectSlices = [],
  workflowStageSlices = [],
  activeFocusGroup = "top_tags",
  selectedTaskTitle,
  selectedTaskNotePath,
  selectedTaskLinkedNoteCount = 0,
  captureHint,
  now,
  width,
  height,
  onTopTagClick,
  onDueBucketClick,
  onPriorityClick,
  onAssigneeClick,
  onProjectClick,
  onWorkflowStageClick
}: DashboardPaneProps) {
  const theme = themeForObject("dashboard");
  const dueBuckets = React.useMemo(() => computeDueBuckets8(tasks, now), [tasks, now]);
  const analyticsWindow = filters.analyticsWindow ?? "7d";
  const kpiItems = React.useMemo(
    () => buildKpiItems(tasks, now, analyticsWindow),
    [analyticsWindow, now, tasks]
  );
  const layout = React.useMemo(() => resolveDashboardLayout(width), [width]);
  const maxBucket = Math.max(0, ...dueBuckets);
  const headerWidth = Math.max(20, width - 2);
  const heightPolicy = React.useMemo(
    () => resolveDashboardHeightPolicy(height),
    [height]
  );
  const showFilterSummary = heightPolicy.showFilterSummary;
  const openOnlyUnavailable =
    filters.status === "done" || filters.status === "archived";
  const clampedTagIndex =
    topTags.length === 0
      ? 0
      : Math.max(0, Math.min(selectedTopTagIndex, topTags.length - 1));
  const clampedDueBucketIndex = Math.max(0, Math.min(selectedDueBucketIndex, DUE_BUCKET_LABELS.length - 1));
  const clampedPriorityIndex =
    prioritySlices.length === 0
      ? 0
      : Math.max(0, Math.min(selectedPriorityIndex, prioritySlices.length - 1));
  const clampedAssigneeIndex =
    assigneeSlices.length === 0
      ? 0
      : Math.max(0, Math.min(selectedAssigneeIndex, assigneeSlices.length - 1));
  const clampedProjectIndex =
    projectSlices.length === 0
      ? 0
      : Math.max(0, Math.min(selectedProjectIndex, projectSlices.length - 1));
  const clampedWorkflowStageIndex =
    workflowStageSlices.length === 0
      ? 0
      : Math.max(0, Math.min(selectedWorkflowStageIndex, workflowStageSlices.length - 1));

  const dueLines = React.useMemo(
    () => buildDueBucketLines(dueBuckets, maxBucket, layout.chartPanelWidth),
    [dueBuckets, maxBucket, layout.chartPanelWidth]
  );
  const dueSummaryLine = React.useMemo(
    () => buildDueBucketSummaryLine(dueBuckets, layout.chartPanelWidth),
    [dueBuckets, layout.chartPanelWidth]
  );
  const topTagRows = React.useMemo(
    () => buildTopTagRows(topTags, layout.rightPanelWidth),
    [topTags, layout.rightPanelWidth]
  );
  const topTagSummaryLine = React.useMemo(
    () => buildTopTagSummaryLine(topTags, layout.rightPanelWidth),
    [topTags, layout.rightPanelWidth]
  );
  const dashboardContentWidth = layout.stacked
    ? layout.chartPanelWidth
    : layout.chartPanelWidth + DASHBOARD_GUTTER + layout.rightPanelWidth;
  const bottomRowLayout = React.useMemo(
    () => resolveBottomRowLayout(dashboardContentWidth),
    [dashboardContentWidth]
  );

  const overdueAgingBuckets = React.useMemo(
    () => computeOverdueAgingBuckets(tasks, new Date(now)),
    [tasks, now]
  );
  const overdueAgingDisplayBuckets = React.useMemo(
    () =>
      openOnlyUnavailable
        ? overdueAgingBuckets.map((bucket) => ({ ...bucket, count: 0 }))
        : overdueAgingBuckets,
    [openOnlyUnavailable, overdueAgingBuckets]
  );
  const overdueAgingLines = React.useMemo(
    () => buildOverdueAgingLines(overdueAgingDisplayBuckets, bottomRowLayout.leftPanelWidth),
    [overdueAgingDisplayBuckets, bottomRowLayout.leftPanelWidth]
  );

  const throughputBase = React.useMemo(
    () => computeCreatedCompletedWindow(tasks, new Date(now), analyticsWindowDays),
    [analyticsWindowDays, tasks, now]
  );
  const throughputDisplay = React.useMemo(
    () => gateThroughputByStatus(throughputBase, filters.status),
    [throughputBase, filters.status]
  );
  const throughputLines = React.useMemo(
    () => buildThroughputLines(throughputDisplay, bottomRowLayout.rightPanelWidth),
    [throughputDisplay, bottomRowLayout.rightPanelWidth]
  );
  const prioritySummaryLine = React.useMemo(
    () =>
      truncateLine(
        prioritySlices.length === 0
          ? "(No prioritized tasks in current view)"
          : prioritySlices.map((slice) => `${slice.value}:${slice.count}`).join("  "),
        Math.max(10, dashboardContentWidth - PANEL_HORIZONTAL_OVERHEAD)
      ),
    [prioritySlices, dashboardContentWidth]
  );
  const backlogTrend = React.useMemo(
    () => computeBacklogTrendWindow(tasks, now, analyticsWindowDays),
    [analyticsWindowDays, now, tasks]
  );
  const backlogTrendLines = React.useMemo(
    () => buildBacklogTrendLines(backlogTrend, dashboardContentWidth),
    [backlogTrend, dashboardContentWidth]
  );
  const bottomSummaryLine = React.useMemo(
    () =>
      buildBottomSummaryLine(
        overdueAgingDisplayBuckets,
        throughputDisplay,
        dashboardContentWidth
      ),
    [dashboardContentWidth, overdueAgingDisplayBuckets, throughputDisplay]
  );

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
  const linkedTaskCount = React.useMemo(
    () => tasks.filter((task) => Boolean(task.noteRef)).length,
    [tasks]
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
      <box
        style={{
          ...panelStyle,
          width: dashboardContentWidth,
          marginTop: showFilterSummary ? 1 : 0
        }}
      >
        <text style={{ color: theme.text, fontWeight: "bold" }}>
          TOME COVERAGE
        </text>
        <text style={{ color: theme.text }}>
          {`Linked tasks: ${String(linkedTaskCount)}/${String(tasks.length)}`}
        </text>
        {selectedTaskTitle ? (
          <text style={{ color: theme.muted }}>
            {`Selected task: ${selectedTaskTitle} · primary note: ${selectedTaskNotePath ?? "(none)"} · backlinks: ${String(selectedTaskLinkedNoteCount)}`}
          </text>
        ) : null}
        {captureHint ? (
          <text style={{ color: theme.muted }}>{captureHint}</text>
        ) : null}
      </box>

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
            {heightPolicy.dueTop === "summary" ? (
              <text style={{ color: theme.text }}>{dueSummaryLine}</text>
            ) : (
              dueLines.map((line, index) => (
                <box
                  key={`due-${index}`}
                  style={{ flexDirection: "row" }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    onDueBucketClick?.(index);
                  }}
                >
                  <text
                    style={{
                      color:
                        activeFocusGroup === "due_buckets" && index === clampedDueBucketIndex
                          ? theme.accentBlue
                          : theme.text,
                      fontWeight:
                        activeFocusGroup === "due_buckets" && index === clampedDueBucketIndex
                          ? "bold"
                          : "normal"
                    }}
                  >
                    {line}
                  </text>
                </box>
              ))
            )}
          </box>

          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>TOP TAGS (OPEN)</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>(Top tags available for OPEN tasks only)</text>
            ) : heightPolicy.dueTop === "summary" ? (
              <text style={{ color: theme.text }}>{topTagSummaryLine}</text>
            ) : topTags.length === 0 ? (
              <text style={{ color: theme.muted }}>(No tagged open tasks)</text>
            ) : topTagRows.length === 0 ? (
              <text style={{ color: theme.muted }}>(widen to view chart)</text>
            ) : (
              topTagRows.map((row, index) => {
                const selected = index === clampedTagIndex;
                return (
                  <box
                    key={`top-tag-${index}`}
                    style={{ flexDirection: "row" }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      onTopTagClick?.(index);
                    }}
                  >
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
            {heightPolicy.dueTop === "summary" ? (
              <text style={{ color: theme.text }}>{dueSummaryLine}</text>
            ) : (
              dueLines.map((line, index) => (
                <box
                  key={`due-${index}`}
                  style={{ flexDirection: "row" }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    onDueBucketClick?.(index);
                  }}
                >
                  <text
                    style={{
                      color:
                        activeFocusGroup === "due_buckets" && index === clampedDueBucketIndex
                          ? theme.accentBlue
                          : theme.text,
                      fontWeight:
                        activeFocusGroup === "due_buckets" && index === clampedDueBucketIndex
                          ? "bold"
                          : "normal"
                    }}
                  >
                    {line}
                  </text>
                </box>
              ))
            )}
          </box>

          <box style={{ width: DASHBOARD_GUTTER }} />

          <box style={{ ...panelStyle, width: layout.rightPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>TOP TAGS (OPEN)</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>(Top tags available for OPEN tasks only)</text>
            ) : heightPolicy.dueTop === "summary" ? (
              <text style={{ color: theme.text }}>{topTagSummaryLine}</text>
            ) : topTags.length === 0 ? (
              <text style={{ color: theme.muted }}>(No tagged open tasks)</text>
            ) : topTagRows.length === 0 ? (
              <text style={{ color: theme.muted }}>(widen to view chart)</text>
            ) : (
              topTagRows.map((row, index) => {
                const selected = index === clampedTagIndex;
                return (
                  <box
                    key={`top-tag-${index}`}
                    style={{ flexDirection: "row" }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      onTopTagClick?.(index);
                    }}
                  >
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

      {heightPolicy.priority === "hidden" ? null : (
        heightPolicy.priority === "summary" ? (
          <box style={{ ...panelStyle, width: dashboardContentWidth, marginTop: 1 }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>PRIORITY + SLICES</text>
            <text style={{ color: theme.text }}>{prioritySummaryLine}</text>
          </box>
        ) : (
          <box style={{ flexDirection: "column", width: dashboardContentWidth, marginTop: 1, gap: 1 }}>
            <box style={{ ...panelStyle, width: "100%" }}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                PRIORITY STRIP (DRILL-THROUGH)
              </text>
              {prioritySlices.length === 0 ? (
                <text style={{ color: theme.muted }}>(No prioritized tasks in current view)</text>
              ) : (
                <box style={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}>
                  {prioritySlices.map((slice, index) => (
                    <box
                      key={`priority-slice-${slice.value}`}
                      style={{ flexDirection: "row" }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        onPriorityClick?.(index);
                      }}
                    >
                      <text
                        style={{
                          color:
                            activeFocusGroup === "priority" && index === clampedPriorityIndex
                              ? theme.accentBlue
                              : theme.text,
                          fontWeight:
                            activeFocusGroup === "priority" && index === clampedPriorityIndex
                              ? "bold"
                              : "normal"
                        }}
                      >
                        {`${slice.value}:${slice.count}`}
                      </text>
                    </box>
                  ))}
                </box>
              )}
            </box>

            <box style={{ ...panelStyle, width: "100%" }}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                DIMENSION SLICES (ASSIGNEE / PROJECT / STAGE)
              </text>

              <box style={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}>
                <text style={{ color: theme.muted }}>ASSIGNEE:</text>
                {assigneeSlices.length === 0 ? (
                  <text style={{ color: theme.muted }}>(none)</text>
                ) : (
                  assigneeSlices.map((slice, index) => (
                    <box
                      key={`assignee-slice-${slice.value}`}
                      style={{ flexDirection: "row" }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        onAssigneeClick?.(index);
                      }}
                    >
                      <text
                        style={{
                          color:
                            activeFocusGroup === "assignee" && index === clampedAssigneeIndex
                              ? theme.accentBlue
                              : theme.text,
                          fontWeight:
                            activeFocusGroup === "assignee" && index === clampedAssigneeIndex
                              ? "bold"
                              : "normal"
                        }}
                      >
                        {`${slice.value}:${slice.count}`}
                      </text>
                    </box>
                  ))
                )}
              </box>

              <box style={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}>
                <text style={{ color: theme.muted }}>PROJECT:</text>
                {projectSlices.length === 0 ? (
                  <text style={{ color: theme.muted }}>(none)</text>
                ) : (
                  projectSlices.map((slice, index) => (
                    <box
                      key={`project-slice-${slice.value}`}
                      style={{ flexDirection: "row" }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        onProjectClick?.(index);
                      }}
                    >
                      <text
                        style={{
                          color:
                            activeFocusGroup === "project" && index === clampedProjectIndex
                              ? theme.accentBlue
                              : theme.text,
                          fontWeight:
                            activeFocusGroup === "project" && index === clampedProjectIndex
                              ? "bold"
                              : "normal"
                        }}
                      >
                        {`${slice.value}:${slice.count}`}
                      </text>
                    </box>
                  ))
                )}
              </box>

              <box style={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}>
                <text style={{ color: theme.muted }}>STAGE:</text>
                {workflowStageSlices.length === 0 ? (
                  <text style={{ color: theme.muted }}>(none)</text>
                ) : (
                  workflowStageSlices.map((slice, index) => (
                    <box
                      key={`stage-slice-${slice.value}`}
                      style={{ flexDirection: "row" }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        onWorkflowStageClick?.(index);
                      }}
                    >
                      <text
                        style={{
                          color:
                            activeFocusGroup === "workflow_stage" &&
                            index === clampedWorkflowStageIndex
                              ? theme.accentBlue
                              : theme.text,
                          fontWeight:
                            activeFocusGroup === "workflow_stage" &&
                            index === clampedWorkflowStageIndex
                              ? "bold"
                              : "normal"
                        }}
                      >
                        {`${formatSliceValue(slice.value)}:${slice.count}`}
                      </text>
                    </box>
                  ))
                )}
              </box>
            </box>

            <box style={{ ...panelStyle, width: "100%" }}>
              <text style={{ color: theme.text, fontWeight: "bold" }}>
                {`BACKLOG TREND (${analyticsWindowDays}D)`}
              </text>
              {backlogTrendLines.map((line, index) => (
                <text key={`backlog-${index}`} style={{ color: theme.text }}>
                  {line}
                </text>
              ))}
            </box>
          </box>
        )
      )}

      {heightPolicy.bottom === "hidden" ? null : heightPolicy.bottom === "summary" ? (
        <box style={{ ...panelStyle, width: dashboardContentWidth, marginTop: 1 }}>
          <text style={{ color: theme.text, fontWeight: "bold" }}>OVERDUE + THROUGHPUT</text>
          <text style={{ color: theme.text }}>{bottomSummaryLine}</text>
        </box>
      ) : bottomRowLayout.stacked ? (
        <box style={{ flexDirection: "column", width: dashboardContentWidth, marginTop: 1, gap: 1 }}>
          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>OVERDUE AGING</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>
                {truncateLine(
                  OVERDUE_AGING_HINT,
                  Math.max(10, bottomRowLayout.leftPanelWidth - PANEL_HORIZONTAL_OVERHEAD)
                )}
              </text>
            ) : null}
            {overdueAgingLines.map((line, index) => (
              <text key={`aging-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ ...panelStyle, width: "100%" }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>
              {`THROUGHPUT (${analyticsWindowDays}D)`}
            </text>
            {throughputLines.map((line, index) => (
              <text
                key={`throughput-${index}`}
                style={{
                  color:
                    index === 1
                      ? theme.accentBlue
                      : index === 2
                        ? theme.ok
                        : index === 3
                          ? theme.muted
                          : theme.text
                }}
              >
                {line}
              </text>
            ))}
          </box>
        </box>
      ) : (
        <box style={{ flexDirection: "row", marginTop: 1, width: dashboardContentWidth }}>
          <box style={{ ...panelStyle, width: bottomRowLayout.leftPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>OVERDUE AGING</text>
            {openOnlyUnavailable ? (
              <text style={{ color: theme.muted }}>
                {truncateLine(
                  OVERDUE_AGING_HINT,
                  Math.max(10, bottomRowLayout.leftPanelWidth - PANEL_HORIZONTAL_OVERHEAD)
                )}
              </text>
            ) : null}
            {overdueAgingLines.map((line, index) => (
              <text key={`aging-${index}`} style={{ color: theme.text }}>
                {line}
              </text>
            ))}
          </box>

          <box style={{ width: DASHBOARD_GUTTER }} />

          <box style={{ ...panelStyle, width: bottomRowLayout.rightPanelWidth }}>
            <text style={{ color: theme.text, fontWeight: "bold" }}>
              {`THROUGHPUT (${analyticsWindowDays}D)`}
            </text>
            {throughputLines.map((line, index) => (
              <text
                key={`throughput-${index}`}
                style={{
                  color:
                    index === 1
                      ? theme.accentBlue
                      : index === 2
                        ? theme.ok
                        : index === 3
                          ? theme.muted
                          : theme.text
                }}
              >
                {line}
              </text>
            ))}
          </box>
        </box>
      )}
    </box>
  );
}
