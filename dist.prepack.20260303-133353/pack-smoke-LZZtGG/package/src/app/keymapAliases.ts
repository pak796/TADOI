export type AliasContext = "list" | "dashboard" | "backup" | "help";

export type ActionAliasId =
  | "list_open_add"
  | "list_open_edit"
  | "list_toggle_selected"
  | "list_open_search"
  | "list_cycle_status"
  | "list_cycle_sort"
  | "list_cycle_due"
  | "list_cycle_priority"
  | "list_cycle_tag"
  | "list_open_tag_panel"
  | "list_toggle_dashboard"
  | "list_open_backup_center"
  | "list_move_up"
  | "list_move_down"
  | "list_page_up"
  | "list_page_down"
  | "list_jump_top"
  | "list_jump_bottom"
  | "dashboard_move_up"
  | "dashboard_move_down"
  | "dashboard_apply_selection"
  | "dashboard_cycle_status"
  | "dashboard_cycle_due"
  | "dashboard_cycle_priority"
  | "dashboard_cycle_tag"
  | "dashboard_open_tag_panel"
  | "dashboard_cycle_window"
  | "dashboard_next_focus"
  | "dashboard_prev_focus"
  | "dashboard_toggle_dashboard"
  | "dashboard_open_help"
  | "dashboard_open_backup_center"
  | "backup_primary"
  | "backup_back"
  | "backup_move_up"
  | "backup_move_down"
  | "backup_page_up"
  | "backup_page_down"
  | "backup_jump_start"
  | "backup_jump_end"
  | "backup_open_manual_path"
  | "backup_menu_option_1"
  | "backup_menu_option_2"
  | "backup_menu_option_3"
  | "backup_menu_option_4"
  | "help_move_up"
  | "help_move_down"
  | "help_page_up"
  | "help_page_down"
  | "help_nav_back"
  | "help_nav_forward"
  | "help_toggle_focused_section"
  | "help_close"
  | "help_open_backup_center";

export type KeymapAliasConfig = Partial<Record<ActionAliasId, string[]>>;
export type KeymapAliases = Partial<Record<AliasContext, KeymapAliasConfig>>;

export type ContextAliasResolution = {
  tokenToAction: Partial<Record<string, ActionAliasId>>;
  actionToTokens: Partial<Record<ActionAliasId, string[]>>;
};

export type ResolvedKeymapAliases = {
  byContext: Partial<Record<AliasContext, ContextAliasResolution>>;
  warnings: string[];
};

export type KeyLikeInput = {
  name: string;
  sequence: string;
  ctrl: boolean;
  shift: boolean;
};

const LIST_ACTIONS: ActionAliasId[] = [
  "list_open_add",
  "list_open_edit",
  "list_toggle_selected",
  "list_open_search",
  "list_cycle_status",
  "list_cycle_sort",
  "list_cycle_due",
  "list_cycle_priority",
  "list_cycle_tag",
  "list_open_tag_panel",
  "list_toggle_dashboard",
  "list_open_backup_center",
  "list_move_up",
  "list_move_down",
  "list_page_up",
  "list_page_down",
  "list_jump_top",
  "list_jump_bottom"
];

const DASHBOARD_ACTIONS: ActionAliasId[] = [
  "dashboard_move_up",
  "dashboard_move_down",
  "dashboard_apply_selection",
  "dashboard_cycle_status",
  "dashboard_cycle_due",
  "dashboard_cycle_priority",
  "dashboard_cycle_tag",
  "dashboard_open_tag_panel",
  "dashboard_cycle_window",
  "dashboard_next_focus",
  "dashboard_prev_focus",
  "dashboard_toggle_dashboard",
  "dashboard_open_help",
  "dashboard_open_backup_center"
];

const BACKUP_ACTIONS: ActionAliasId[] = [
  "backup_primary",
  "backup_back",
  "backup_move_up",
  "backup_move_down",
  "backup_page_up",
  "backup_page_down",
  "backup_jump_start",
  "backup_jump_end",
  "backup_open_manual_path",
  "backup_menu_option_1",
  "backup_menu_option_2",
  "backup_menu_option_3",
  "backup_menu_option_4"
];

const HELP_ACTIONS: ActionAliasId[] = [
  "help_move_up",
  "help_move_down",
  "help_page_up",
  "help_page_down",
  "help_nav_back",
  "help_nav_forward",
  "help_toggle_focused_section",
  "help_close",
  "help_open_backup_center"
];

const ACTIONS_BY_CONTEXT: Record<AliasContext, readonly ActionAliasId[]> = {
  list: LIST_ACTIONS,
  dashboard: DASHBOARD_ACTIONS,
  backup: BACKUP_ACTIONS,
  help: HELP_ACTIONS
};

const NAMED_KEY_NORMALIZATION: Record<string, string> = {
  escape: "Esc",
  esc: "Esc",
  return: "Enter",
  enter: "Enter",
  space: "Space",
  tab: "Tab",
  backspace: "backspace",
  up: "ArrowUp",
  arrowup: "ArrowUp",
  down: "ArrowDown",
  arrowdown: "ArrowDown",
  left: "ArrowLeft",
  arrowleft: "ArrowLeft",
  right: "ArrowRight",
  arrowright: "ArrowRight",
  pageup: "PageUp",
  page_up: "PageUp",
  prior: "PageUp",
  pagedown: "PageDown",
  page_down: "PageDown",
  next: "PageDown",
  home: "home",
  end: "end"
};

const CONTEXTS: AliasContext[] = ["list", "dashboard", "backup", "help"];

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isAliasContext(value: string): value is AliasContext {
  return CONTEXTS.includes(value as AliasContext);
}

export function isActionAliasSupportedInContext(
  context: AliasContext,
  actionId: string
): actionId is ActionAliasId {
  return ACTIONS_BY_CONTEXT[context].includes(actionId as ActionAliasId);
}

export function normalizeAliasToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ctrlMatch = trimmed.match(/^ctrl\+([a-z0-9])$/i);
  if (ctrlMatch) {
    return `Ctrl+${ctrlMatch[1].toUpperCase()}`;
  }

  const lower = trimmed.toLowerCase();
  if (NAMED_KEY_NORMALIZATION[lower]) {
    return NAMED_KEY_NORMALIZATION[lower];
  }

  if (trimmed.length === 1) {
    return trimmed;
  }

  return null;
}

function normalizeAliasTokens(input: unknown): string[] {
  const rawTokens = Array.isArray(input)
    ? input.filter((value): value is string => typeof value === "string")
    : typeof input === "string"
      ? [input]
      : [];
  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const token of rawTokens) {
    const resolved = normalizeAliasToken(token);
    if (!resolved || unique.has(resolved)) continue;
    unique.add(resolved);
    normalized.push(resolved);
  }

  return normalized;
}

export function normalizeKeymapAliases(input: unknown): KeymapAliases | undefined {
  if (!isRecord(input)) return undefined;

  const normalized: KeymapAliases = {};

  for (const [contextKey, contextValue] of Object.entries(input)) {
    if (!isAliasContext(contextKey) || !isRecord(contextValue)) continue;
    const context = contextKey as AliasContext;
    const contextConfig: KeymapAliasConfig = {};

    for (const [actionKey, actionValue] of Object.entries(contextValue)) {
      if (!isActionAliasSupportedInContext(context, actionKey)) continue;
      const tokens = normalizeAliasTokens(actionValue);
      if (tokens.length === 0) continue;
      contextConfig[actionKey as ActionAliasId] = tokens;
    }

    if (Object.keys(contextConfig).length > 0) {
      normalized[context] = contextConfig;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function resolveKeymapAliases(
  aliases: KeymapAliases | undefined
): ResolvedKeymapAliases {
  const byContext: Partial<Record<AliasContext, ContextAliasResolution>> = {};
  const warnings: string[] = [];
  if (!aliases) {
    return { byContext, warnings };
  }

  for (const context of CONTEXTS) {
    const contextConfig = aliases[context];
    if (!contextConfig) continue;
    const tokenToAction: Partial<Record<string, ActionAliasId>> = {};
    const actionToTokens: Partial<Record<ActionAliasId, string[]>> = {};

    for (const [actionId, tokens] of Object.entries(contextConfig)) {
      if (!isActionAliasSupportedInContext(context, actionId)) continue;
      const keptTokens: string[] = [];
      for (const token of tokens ?? []) {
        if (tokenToAction[token] && tokenToAction[token] !== actionId) {
          warnings.push(
            `[${context}] token "${token}" kept for "${tokenToAction[token]}", ignored for "${actionId}".`
          );
          continue;
        }
        tokenToAction[token] = actionId as ActionAliasId;
        keptTokens.push(token);
      }
      if (keptTokens.length > 0) {
        actionToTokens[actionId as ActionAliasId] = keptTokens;
      }
    }

    if (Object.keys(tokenToAction).length > 0) {
      byContext[context] = { tokenToAction, actionToTokens };
    }
  }

  return { byContext, warnings };
}

export function keyInputToAliasTokens(input: KeyLikeInput): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  const add = (token: string | null) => {
    if (!token || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  if (input.ctrl) {
    const source = input.name || input.sequence;
    const ctrlToken = source.length === 1 ? normalizeAliasToken(`ctrl+${source}`) : null;
    add(ctrlToken);
    return tokens;
  }

  if (input.sequence.length === 1) {
    add(normalizeAliasToken(input.sequence));
  }
  add(normalizeAliasToken(input.name));
  return tokens;
}

export function resolveAliasActionIdForInput(
  context: AliasContext,
  input: KeyLikeInput,
  resolvedAliases: ResolvedKeymapAliases | null | undefined
): ActionAliasId | null {
  const contextMap = resolvedAliases?.byContext[context];
  if (!contextMap) return null;

  const tokens = keyInputToAliasTokens(input);
  for (const token of tokens) {
    const actionId = contextMap.tokenToAction[token];
    if (actionId) return actionId;
  }
  return null;
}

export function getAliasTokensForAction(
  context: AliasContext,
  actionId: ActionAliasId,
  resolvedAliases: ResolvedKeymapAliases | null | undefined
): string[] {
  const tokens = resolvedAliases?.byContext[context]?.actionToTokens[actionId];
  return tokens ? [...tokens] : [];
}
