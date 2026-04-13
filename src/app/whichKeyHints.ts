import { FocusTarget, Mode } from "../domain/models";
import type { BackupCenterScreen } from "../state/backupCenterFlow";
import {
  getAliasTokensForAction,
  type ActionAliasId,
  type AliasContext,
  type ResolvedKeymapAliases,
} from "./keymapAliases";

export type WhichKeyContext =
  | AliasContext
  | "search"
  | "editor"
  | "modal"
  | "tag_filter"
  | "notes"
  | "notes_view"
  | "notes_edit";

export type WhichKeyHintItem = {
  key: string;
  label: string;
  actionId?: ActionAliasId;
};

export type WhichKeyPrefixPopup = {
  title: string;
  hints: WhichKeyHintItem[];
};

type HintSpec = {
  key: string;
  label: string;
  actionId?: ActionAliasId;
};

const LIST_HINTS: HintSpec[] = [
  { key: "a", label: "add", actionId: "list_open_add" },
  { key: "`", label: "TITS" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "e", label: "edit", actionId: "list_open_edit" },
  { key: "Space", label: "toggle", actionId: "list_toggle_selected" },
  { key: "/", label: "search", actionId: "list_open_search" },
  { key: "f", label: "status", actionId: "list_cycle_status" },
  { key: "g", label: "due", actionId: "list_cycle_due" },
  { key: "r", label: "priority", actionId: "list_cycle_priority" },
  { key: "p", label: "tag panel", actionId: "list_open_tag_panel" },
  { key: "b", label: "dashboard", actionId: "list_toggle_dashboard" },
  { key: "u", label: "backup", actionId: "list_open_backup_center" },
];

const DASHBOARD_HINTS: HintSpec[] = [
  { key: "Enter", label: "apply", actionId: "dashboard_apply_selection" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "f", label: "status", actionId: "dashboard_cycle_status" },
  { key: "g", label: "due", actionId: "dashboard_cycle_due" },
  { key: "r", label: "priority", actionId: "dashboard_cycle_priority" },
  { key: "w", label: "window", actionId: "dashboard_cycle_window" },
  { key: "p", label: "tag panel", actionId: "dashboard_open_tag_panel" },
  { key: "u", label: "backup", actionId: "dashboard_open_backup_center" },
  { key: "?", label: "help", actionId: "dashboard_open_help" },
  { key: "b", label: "list", actionId: "dashboard_toggle_dashboard" },
];

const BACKUP_HINTS: HintSpec[] = [
  { key: "Enter", label: "select", actionId: "backup_primary" },
  { key: "Esc", label: "back", actionId: "backup_back" },
  { key: "j/k", label: "move", actionId: "backup_move_down" },
  { key: "PgUp/PgDn", label: "page", actionId: "backup_page_down" },
  { key: "Home/End", label: "jump", actionId: "backup_jump_end" },
  { key: "m", label: "manual path", actionId: "backup_open_manual_path" },
  { key: "1..4", label: "menu", actionId: "backup_menu_option_1" },
];

const HELP_HINTS: HintSpec[] = [
  { key: "↑/↓", label: "move", actionId: "help_move_down" },
  { key: "Enter", label: "toggle", actionId: "help_toggle_focused_section" },
  { key: "←/→", label: "nav", actionId: "help_nav_forward" },
  { key: "PgUp/PgDn", label: "page", actionId: "help_page_down" },
  { key: "1", label: "backup", actionId: "help_open_backup_center" },
  { key: "Esc", label: "close", actionId: "help_close" },
];

const SEARCH_HINTS: HintSpec[] = [
  { key: "type", label: "query" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "Tab", label: "results" },
  { key: "Enter", label: "close/open" },
  { key: "Esc", label: "cancel" },
];

const EDITOR_HINTS: HintSpec[] = [
  { key: "Tab", label: "next field" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "Ctrl+S", label: "save" },
  { key: "Esc", label: "cancel" },
  { key: "PgUp/PgDn", label: "scroll" },
];

const MODAL_HINTS: HintSpec[] = [
  { key: "y", label: "confirm" },
  { key: "n", label: "cancel" },
  { key: "Esc", label: "close" },
];

const TAG_FILTER_HINTS: HintSpec[] = [
  { key: "Tab", label: "bucket" },
  { key: "Enter", label: "add tag" },
  { key: "Ctrl+Enter", label: "apply" },
  { key: "Esc", label: "close" },
];

const NOTES_HINTS: HintSpec[] = [
  { key: "Enter", label: "open" },
  { key: "a", label: "new tome" },
  { key: "r/R", label: "rename tome" },
  { key: "d", label: "delete tome" },
  { key: "e", label: "edit" },
  { key: "/", label: "search" },
  { key: "p", label: "tag filter" },
  { key: "i", label: "reindex" },
  { key: "o", label: "tome root" },
  { key: "Esc", label: "back" },
];

const NOTES_VIEW_HINTS: HintSpec[] = [
  { key: "j/k", label: "select link" },
  { key: "Enter", label: "follow link" },
  { key: "d", label: "delete note" },
  { key: "e", label: "edit note" },
  { key: "Esc", label: "back" },
];

const NOTES_EDIT_HINTS: HintSpec[] = [
  { key: "Ctrl+S", label: "save" },
  { key: "Esc", label: "cancel" },
];

const HINTS_BY_CONTEXT: Record<WhichKeyContext, HintSpec[]> = {
  list: LIST_HINTS,
  dashboard: DASHBOARD_HINTS,
  backup: BACKUP_HINTS,
  help: HELP_HINTS,
  search: SEARCH_HINTS,
  editor: EDITOR_HINTS,
  modal: MODAL_HINTS,
  tag_filter: TAG_FILTER_HINTS,
  notes: NOTES_HINTS,
  notes_view: NOTES_VIEW_HINTS,
  notes_edit: NOTES_EDIT_HINTS,
};

function resolveAliasBackedKey(
  context: WhichKeyContext,
  actionId: ActionAliasId | undefined,
  fallback: string,
  resolvedAliases: ResolvedKeymapAliases | null | undefined,
): string {
  if (!actionId) return fallback;
  if (
    context !== "list" &&
    context !== "dashboard" &&
    context !== "backup" &&
    context !== "help"
  ) {
    return fallback;
  }
  const tokens = getAliasTokensForAction(context, actionId, resolvedAliases);
  return tokens[0] ?? fallback;
}

function buildActionHintLine(params: {
  context: AliasContext;
  actionId: ActionAliasId;
  fallback: string;
  label: string;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): string {
  const key = resolveAliasBackedKey(
    params.context,
    params.actionId,
    params.fallback,
    params.resolvedAliases,
  );
  return `${key}: ${params.label}`;
}

function buildPairedActionHintLine(params: {
  context: AliasContext;
  first: {
    actionId: ActionAliasId;
    fallback: string;
  };
  second: {
    actionId: ActionAliasId;
    fallback: string;
  };
  label: string;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): string {
  const firstKey = resolveAliasBackedKey(
    params.context,
    params.first.actionId,
    params.first.fallback,
    params.resolvedAliases,
  );
  const secondKey = resolveAliasBackedKey(
    params.context,
    params.second.actionId,
    params.second.fallback,
    params.resolvedAliases,
  );
  return `${firstKey}/${secondKey}: ${params.label}`;
}

function buildRangedActionHintLine(params: {
  context: AliasContext;
  start: {
    actionId: ActionAliasId;
    fallback: string;
  };
  end: {
    actionId: ActionAliasId;
    fallback: string;
  };
  label: string;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): string {
  const startKey = resolveAliasBackedKey(
    params.context,
    params.start.actionId,
    params.start.fallback,
    params.resolvedAliases,
  );
  const endKey = resolveAliasBackedKey(
    params.context,
    params.end.actionId,
    params.end.fallback,
    params.resolvedAliases,
  );
  return `${startKey}..${endKey}: ${params.label}`;
}

export function resolveWhichKeyContext(params: {
  mode: Mode;
  focus: FocusTarget;
  backupScreen: BackupCenterScreen | null;
}): WhichKeyContext {
  const { mode } = params;
  if (mode === Mode.DASHBOARD) return "dashboard";
  if (mode === Mode.BACKUP_CENTER) return "backup";
  if (mode === Mode.HELP) return "help";
  if (mode === Mode.SEARCH) return "search";
  if (mode === Mode.ADD || mode === Mode.EDIT) return "editor";
  if (
    mode === Mode.NOTES_LIST ||
    mode === Mode.NOTES_SEARCH ||
    mode === Mode.NOTES_TAG_FILTER
  ) {
    return "notes";
  }
  if (mode === Mode.NOTES_VIEW) return "notes_view";
  if (mode === Mode.NOTES_EDIT) return "notes_edit";
  if (mode === Mode.MODAL_CONFIRM) return "modal";
  if (mode === Mode.TAG_FILTER) return "tag_filter";
  return "list";
}

export function buildWhichKeyHintItems(params: {
  context: WhichKeyContext;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): WhichKeyHintItem[] {
  const { context, resolvedAliases } = params;
  return (HINTS_BY_CONTEXT[context] ?? []).map((hint) => ({
    key: resolveAliasBackedKey(
      context,
      hint.actionId,
      hint.key,
      resolvedAliases,
    ),
    label: hint.label,
    actionId: hint.actionId,
  }));
}

export function buildLeftRailHintLines(params: {
  context: WhichKeyContext;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): string[] {
  const { context, resolvedAliases } = params;
  if (context === "dashboard") {
    return [
      buildPairedActionHintLine({
        context: "dashboard",
        first: { actionId: "dashboard_move_down", fallback: "j" },
        second: { actionId: "dashboard_move_up", fallback: "k" },
        label: "MOVE",
        resolvedAliases,
      }),
      "Ctrl+N: CAPTURE",
      buildActionHintLine({
        context: "dashboard",
        actionId: "dashboard_open_tag_panel",
        fallback: "p",
        label: "TAG PANEL",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "dashboard",
        actionId: "dashboard_cycle_priority",
        fallback: "r",
        label: "PRIORITY",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "dashboard",
        actionId: "dashboard_apply_selection",
        fallback: "Enter",
        label: "APPLY",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "dashboard",
        actionId: "dashboard_toggle_dashboard",
        fallback: "b",
        label: "LIST",
        resolvedAliases,
      }),
    ];
  }

  if (context === "backup") {
    return [
      buildActionHintLine({
        context: "backup",
        actionId: "backup_primary",
        fallback: "Enter",
        label: "SELECT",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "backup",
        actionId: "backup_back",
        fallback: "Esc",
        label: "BACK",
        resolvedAliases,
      }),
      buildPairedActionHintLine({
        context: "backup",
        first: { actionId: "backup_move_down", fallback: "j" },
        second: { actionId: "backup_move_up", fallback: "k" },
        label: "MOVE",
        resolvedAliases,
      }),
      buildPairedActionHintLine({
        context: "backup",
        first: { actionId: "backup_page_down", fallback: "PgDn" },
        second: { actionId: "backup_page_up", fallback: "PgUp" },
        label: "PAGE",
        resolvedAliases,
      }),
      buildRangedActionHintLine({
        context: "backup",
        start: { actionId: "backup_menu_option_1", fallback: "1" },
        end: { actionId: "backup_menu_option_4", fallback: "4" },
        label: "MENU",
        resolvedAliases,
      }),
    ];
  }

  if (context === "help") {
    return [
      buildPairedActionHintLine({
        context: "help",
        first: { actionId: "help_move_up", fallback: "↑" },
        second: { actionId: "help_move_down", fallback: "↓" },
        label: "MOVE",
        resolvedAliases,
      }),
      buildPairedActionHintLine({
        context: "help",
        first: { actionId: "help_nav_back", fallback: "←" },
        second: { actionId: "help_nav_forward", fallback: "→" },
        label: "NAV",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "help",
        actionId: "help_toggle_focused_section",
        fallback: "Enter",
        label: "TOGGLE",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "help",
        actionId: "help_open_backup_center",
        fallback: "1",
        label: "BACKUP",
        resolvedAliases,
      }),
      buildActionHintLine({
        context: "help",
        actionId: "help_close",
        fallback: "Esc",
        label: "CLOSE",
        resolvedAliases,
      }),
    ];
  }

  if (
    context === "notes" ||
    context === "notes_view" ||
    context === "notes_edit"
  ) {
    if (context === "notes_view") {
      return [
        "j/k: LINKS",
        "Enter: FOLLOW",
        "d: DELETE TOME",
        "e: EDIT",
        "Esc: BACK",
      ];
    }
    if (context === "notes_edit") {
      return [
        "Ctrl+S: SAVE",
        "Esc: CANCEL",
        "j/k: TYPE NAV",
        "i: REINDEX",
        "n: EXIT TOME",
      ];
    }
    return [
      "j/k: MOVE",
      "Enter: OPEN",
      "a: NEW TOME",
      "r/R: RENAME TOME",
      "i: REINDEX",
      "o: ROOT SETTINGS",
      "d: DELETE TOME",
      "/: SEARCH",
    ];
  }

  return [
    buildPairedActionHintLine({
      context: "list",
      first: { actionId: "list_move_down", fallback: "j" },
      second: { actionId: "list_move_up", fallback: "k" },
      label: "MOVE",
      resolvedAliases,
    }),
    "Ctrl+N: CAPTURE",
    buildActionHintLine({
      context: "list",
      actionId: "list_open_tag_panel",
      fallback: "p",
      label: "TAG PANEL",
      resolvedAliases,
    }),
    buildActionHintLine({
      context: "list",
      actionId: "list_cycle_priority",
      fallback: "r",
      label: "PRIORITY",
      resolvedAliases,
    }),
    buildActionHintLine({
      context: "list",
      actionId: "list_open_search",
      fallback: "/",
      label: "SEARCH",
      resolvedAliases,
    }),
    buildActionHintLine({
      context: "list",
      actionId: "list_toggle_selected",
      fallback: "Space",
      label: "TOGGLE",
      resolvedAliases,
    }),
    "`: TITS",
  ];
}

export function buildWhichKeyPrefixPopup(params: {
  pendingGPrefix: boolean;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): WhichKeyPrefixPopup | null {
  if (!params.pendingGPrefix) return null;

  const jumpTop = resolveAliasBackedKey(
    "list",
    "list_jump_top",
    "g",
    params.resolvedAliases,
  );
  const jumpBottom = resolveAliasBackedKey(
    "list",
    "list_jump_bottom",
    "G",
    params.resolvedAliases,
  );

  return {
    title: "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y",
    hints: [
      { key: jumpTop, label: "jump top", actionId: "list_jump_top" },
      { key: jumpBottom, label: "jump bottom", actionId: "list_jump_bottom" },
      { key: "Esc", label: "cancel prefix" },
    ],
  };
}
