import { FocusTarget, Mode } from "../domain/models";
import type { BackupCenterScreen } from "../state/backupCenterFlow";
import {
  getAliasTokensForAction,
  type ActionAliasId,
  type AliasContext,
  type ResolvedKeymapAliases
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
  { key: "u", label: "backup", actionId: "list_open_backup_center" }
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
  { key: "b", label: "list", actionId: "dashboard_toggle_dashboard" }
];

const BACKUP_HINTS: HintSpec[] = [
  { key: "Enter", label: "select", actionId: "backup_primary" },
  { key: "Esc", label: "back", actionId: "backup_back" },
  { key: "j/k", label: "move", actionId: "backup_move_down" },
  { key: "PgUp/PgDn", label: "page", actionId: "backup_page_down" },
  { key: "Home/End", label: "jump", actionId: "backup_jump_end" },
  { key: "m", label: "manual path", actionId: "backup_open_manual_path" },
  { key: "1..4", label: "menu", actionId: "backup_menu_option_1" }
];

const HELP_HINTS: HintSpec[] = [
  { key: "↑/↓", label: "move", actionId: "help_move_down" },
  { key: "Enter", label: "toggle", actionId: "help_toggle_focused_section" },
  { key: "←/→", label: "nav", actionId: "help_nav_forward" },
  { key: "PgUp/PgDn", label: "page", actionId: "help_page_down" },
  { key: "1", label: "backup", actionId: "help_open_backup_center" },
  { key: "Esc", label: "close", actionId: "help_close" }
];

const SEARCH_HINTS: HintSpec[] = [
  { key: "type", label: "query" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "Tab", label: "results" },
  { key: "Enter", label: "close/open" },
  { key: "Esc", label: "cancel" }
];

const EDITOR_HINTS: HintSpec[] = [
  { key: "Tab", label: "next field" },
  { key: "Ctrl+N", label: "quick capture" },
  { key: "Ctrl+S", label: "save" },
  { key: "Esc", label: "cancel" },
  { key: "PgUp/PgDn", label: "scroll" }
];

const MODAL_HINTS: HintSpec[] = [
  { key: "y", label: "confirm" },
  { key: "n", label: "cancel" },
  { key: "Esc", label: "close" }
];

const TAG_FILTER_HINTS: HintSpec[] = [
  { key: "Tab", label: "bucket" },
  { key: "Enter", label: "add tag" },
  { key: "Ctrl+Enter", label: "apply" },
  { key: "Esc", label: "close" }
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
  { key: "Esc", label: "back" }
];

const NOTES_VIEW_HINTS: HintSpec[] = [
  { key: "j/k", label: "select link" },
  { key: "Enter", label: "follow link" },
  { key: "d", label: "delete note" },
  { key: "e", label: "edit note" },
  { key: "Esc", label: "back" }
];

const NOTES_EDIT_HINTS: HintSpec[] = [
  { key: "Ctrl+S", label: "save" },
  { key: "Esc", label: "cancel" }
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
  notes_edit: NOTES_EDIT_HINTS
};

function resolveAliasBackedKey(
  context: WhichKeyContext,
  actionId: ActionAliasId | undefined,
  fallback: string,
  resolvedAliases: ResolvedKeymapAliases | null | undefined
): string {
  if (!actionId) return fallback;
  if (context !== "list" && context !== "dashboard" && context !== "backup" && context !== "help") {
    return fallback;
  }
  const tokens = getAliasTokensForAction(context, actionId, resolvedAliases);
  return tokens[0] ?? fallback;
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
  if (mode === Mode.NOTES_LIST || mode === Mode.NOTES_SEARCH || mode === Mode.NOTES_TAG_FILTER) {
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
    key: resolveAliasBackedKey(context, hint.actionId, hint.key, resolvedAliases),
    label: hint.label,
    actionId: hint.actionId
  }));
}

export function buildLeftRailHintLines(params: {
  context: WhichKeyContext;
  resolvedAliases: ResolvedKeymapAliases | null | undefined;
}): string[] {
  const { context, resolvedAliases } = params;
  if (context === "dashboard") {
    return [
      `${resolveAliasBackedKey("dashboard", "dashboard_move_down", "j", resolvedAliases)}/${resolveAliasBackedKey("dashboard", "dashboard_move_up", "k", resolvedAliases)}: MOVE`,
      "Ctrl+N: CAPTURE",
      `${resolveAliasBackedKey("dashboard", "dashboard_open_tag_panel", "p", resolvedAliases)}: TAG PANEL`,
      `${resolveAliasBackedKey("dashboard", "dashboard_cycle_priority", "r", resolvedAliases)}: PRIORITY`,
      `${resolveAliasBackedKey("dashboard", "dashboard_apply_selection", "Enter", resolvedAliases)}: APPLY`,
      `${resolveAliasBackedKey("dashboard", "dashboard_toggle_dashboard", "b", resolvedAliases)}: LIST`
    ];
  }

  if (context === "backup") {
    return [
      `${resolveAliasBackedKey("backup", "backup_primary", "Enter", resolvedAliases)}: SELECT`,
      `${resolveAliasBackedKey("backup", "backup_back", "Esc", resolvedAliases)}: BACK`,
      `${resolveAliasBackedKey("backup", "backup_move_down", "j", resolvedAliases)}/${resolveAliasBackedKey("backup", "backup_move_up", "k", resolvedAliases)}: MOVE`,
      `${resolveAliasBackedKey("backup", "backup_page_down", "PgDn", resolvedAliases)}/${resolveAliasBackedKey("backup", "backup_page_up", "PgUp", resolvedAliases)}: PAGE`,
      `${resolveAliasBackedKey("backup", "backup_menu_option_1", "1", resolvedAliases)}..${resolveAliasBackedKey("backup", "backup_menu_option_4", "4", resolvedAliases)}: MENU`
    ];
  }

  if (context === "help") {
    return [
      `${resolveAliasBackedKey("help", "help_move_up", "↑", resolvedAliases)}/${resolveAliasBackedKey("help", "help_move_down", "↓", resolvedAliases)}: MOVE`,
      `${resolveAliasBackedKey("help", "help_nav_back", "←", resolvedAliases)}/${resolveAliasBackedKey("help", "help_nav_forward", "→", resolvedAliases)}: NAV`,
      `${resolveAliasBackedKey("help", "help_toggle_focused_section", "Enter", resolvedAliases)}: TOGGLE`,
      `${resolveAliasBackedKey("help", "help_open_backup_center", "1", resolvedAliases)}: BACKUP`,
      `${resolveAliasBackedKey("help", "help_close", "Esc", resolvedAliases)}: CLOSE`
    ];
  }

  if (context === "notes" || context === "notes_view" || context === "notes_edit") {
    if (context === "notes_view") {
      return ["j/k: LINKS", "Enter: FOLLOW", "d: DELETE TOME", "e: EDIT", "Esc: BACK"];
    }
    if (context === "notes_edit") {
      return ["Ctrl+S: SAVE", "Esc: CANCEL", "j/k: TYPE NAV", "i: REINDEX", "n: EXIT TOME"];
    }
    return [
      "j/k: MOVE",
      "Enter: OPEN",
      "a: NEW TOME",
      "r/R: RENAME TOME",
      "i: REINDEX",
      "o: ROOT SETTINGS",
      "d: DELETE TOME",
      "/: SEARCH"
    ];
  }

  return [
    `${resolveAliasBackedKey("list", "list_move_down", "j", resolvedAliases)}/${resolveAliasBackedKey("list", "list_move_up", "k", resolvedAliases)}: MOVE`,
    "Ctrl+N: CAPTURE",
    `${resolveAliasBackedKey("list", "list_open_tag_panel", "p", resolvedAliases)}: TAG PANEL`,
    `${resolveAliasBackedKey("list", "list_cycle_priority", "r", resolvedAliases)}: PRIORITY`,
    `${resolveAliasBackedKey("list", "list_open_search", "/", resolvedAliases)}: SEARCH`,
    `${resolveAliasBackedKey("list", "list_toggle_selected", "Space", resolvedAliases)}: TOGGLE`,
    "`: TITS"
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
    params.resolvedAliases
  );
  const jumpBottom = resolveAliasBackedKey(
    "list",
    "list_jump_bottom",
    "G",
    params.resolvedAliases
  );

  return {
    title: "PREFIX: Ctrl+g / Ctrl+p / Ctrl+y",
    hints: [
      { key: jumpTop, label: "jump top", actionId: "list_jump_top" },
      { key: jumpBottom, label: "jump bottom", actionId: "list_jump_bottom" },
      { key: "Esc", label: "cancel prefix" }
    ]
  };
}
