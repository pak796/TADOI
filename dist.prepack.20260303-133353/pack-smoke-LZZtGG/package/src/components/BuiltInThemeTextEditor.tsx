import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { InputRenderable, KeyEvent } from "@opentui/core";
import { themeForObject } from "../app/theme";
import {
  THEME_OBJECT_IDS,
  type ThemeObjectId,
  type ThemeTextTokenKey,
  type ThemeTextTokenOverrides
} from "../settings/settings";
import { formatThemeDisplayName, type RotatingThemeId, type ThemeTokens } from "../theme/themes";
import {
  THEME_TEXT_TOKEN_KEYS,
  formatRgbRow,
  hexToRgb,
  normalizeHexColor,
  rgbToHex,
  stepRgbChannel
} from "../theme/custom1ColorUtils";

type ScopeState =
  | { kind: "global" }
  | { kind: "object"; objectId: ThemeObjectId };

export type BuiltInThemeTextEditorFocusTarget =
  | "scope"
  | "tokenList"
  | "tokenJump"
  | "hex"
  | "rgbR"
  | "rgbG"
  | "rgbB"
  | "save"
  | "cancel";

const FOCUS_ORDER: BuiltInThemeTextEditorFocusTarget[] = [
  "scope",
  "tokenList",
  "tokenJump",
  "hex",
  "rgbR",
  "rgbG",
  "rgbB",
  "save",
  "cancel"
];

export type BuiltInThemeTextEditorHandle = {
  handleKey: (key: KeyEvent) => boolean;
};

type BuiltInThemeTextEditorProps = {
  themeId: RotatingThemeId;
  baseTokens: Pick<ThemeTokens, ThemeTextTokenKey>;
  draftGlobal: ThemeTextTokenOverrides;
  draftObjects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>;
  onChangeGlobal: (global: ThemeTextTokenOverrides) => void;
  onChangeObjects: (objects: Partial<Record<ThemeObjectId, ThemeTextTokenOverrides>>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function formatObjectLabel(objectId: ThemeObjectId): string {
  return objectId.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function normalizeTokenJumpValue(value: string): string {
  return value.trim().toLowerCase();
}

function nextFocus(
  current: BuiltInThemeTextEditorFocusTarget,
  direction: 1 | -1
): BuiltInThemeTextEditorFocusTarget {
  const index = FOCUS_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  return FOCUS_ORDER[(safeIndex + direction + FOCUS_ORDER.length) % FOCUS_ORDER.length];
}

export function tokenListTextEditorEntryFocusTarget(): BuiltInThemeTextEditorFocusTarget {
  return "hex";
}

export function resolveBuiltInTextEditorTabFocus(
  current: BuiltInThemeTextEditorFocusTarget,
  shiftPressed: boolean
): BuiltInThemeTextEditorFocusTarget {
  if (!shiftPressed && current === "tokenList") {
    return tokenListTextEditorEntryFocusTarget();
  }
  return nextFocus(current, shiftPressed ? -1 : 1);
}

export function resolveBuiltInTextEditorRightFocus(
  current: BuiltInThemeTextEditorFocusTarget
): BuiltInThemeTextEditorFocusTarget | null {
  if (current !== "tokenList") return null;
  return tokenListTextEditorEntryFocusTarget();
}

export function resolveBuiltInTextEditorLeftFocus(
  current: BuiltInThemeTextEditorFocusTarget
): BuiltInThemeTextEditorFocusTarget | null {
  if (current !== "hex") return null;
  return "tokenList";
}

export function resolveBuiltInTextEditorHexCommitFocus(
  commitSucceeded: boolean
): BuiltInThemeTextEditorFocusTarget | null {
  return commitSucceeded ? "tokenList" : null;
}

export function shouldExitBuiltInHexToTokenListOnLeft(params: {
  cursorOffset: number;
  hasSelection: boolean;
  leftBoundary: number;
}): boolean {
  if (params.hasSelection) return false;
  return params.cursorOffset <= params.leftBoundary;
}

function resolveTokenJumpTarget(query: string): ThemeTextTokenKey | null {
  const normalized = normalizeTokenJumpValue(query);
  if (!normalized) return null;
  const exact = THEME_TEXT_TOKEN_KEYS.find((token) => token.toLowerCase() === normalized);
  if (exact) return exact;
  return THEME_TEXT_TOKEN_KEYS.find((token) => token.toLowerCase().includes(normalized)) ?? null;
}

export const BuiltInThemeTextEditor = React.forwardRef<
  BuiltInThemeTextEditorHandle,
  BuiltInThemeTextEditorProps
>(function BuiltInThemeTextEditor(
  {
    themeId,
    baseTokens,
    draftGlobal,
    draftObjects,
    onChangeGlobal,
    onChangeObjects,
    onSave,
    onCancel
  },
  ref
) {
  const helpTheme = themeForObject("help");
  const inputsTheme = themeForObject("inputs");
  const [focusTarget, setFocusTarget] =
    useState<BuiltInThemeTextEditorFocusTarget>("tokenList");
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [scope, setScope] = useState<ScopeState>({ kind: "global" });
  const [tokenJumpInput, setTokenJumpInput] = useState("");
  const [hexInput, setHexInput] = useState(baseTokens.text);
  const [hexError, setHexError] = useState<string | null>(null);
  const hexInputRef = useRef<InputRenderable | null>(null);

  const selectedToken =
    THEME_TEXT_TOKEN_KEYS[selectedTokenIndex] ?? THEME_TEXT_TOKEN_KEYS[0];
  const currentColor = useMemo(() => {
    if (scope.kind === "global") {
      return draftGlobal[selectedToken] ?? baseTokens[selectedToken];
    }
    return (
      draftObjects[scope.objectId]?.[selectedToken] ??
      draftGlobal[selectedToken] ??
      baseTokens[selectedToken]
    );
  }, [baseTokens, draftGlobal, draftObjects, scope, selectedToken]);

  useEffect(() => {
    setHexInput(currentColor);
    setHexError(null);
  }, [currentColor, scope, selectedToken]);

  function applyScopeColor(nextHex: string): void {
    if (scope.kind === "global") {
      onChangeGlobal({
        ...draftGlobal,
        [selectedToken]: nextHex
      });
      return;
    }

    const objectId = scope.objectId;
    const nextForObject = {
      ...(draftObjects[objectId] ?? {}),
      [selectedToken]: nextHex
    };
    onChangeObjects({
      ...draftObjects,
      [objectId]: nextForObject
    });
  }

  function adjustRgbChannel(channel: "r" | "g" | "b", delta: number): void {
    const rgb = hexToRgb(currentColor);
    if (!rgb) return;
    const nextRgb = {
      ...rgb,
      [channel]: stepRgbChannel(rgb[channel], delta)
    };
    applyScopeColor(rgbToHex(nextRgb));
  }

  function resetSelectedToken(): void {
    if (scope.kind === "global") {
      const nextGlobal = { ...draftGlobal };
      delete nextGlobal[selectedToken];
      onChangeGlobal(nextGlobal);
      return;
    }

    const objectId = scope.objectId;
    const objectOverrides = { ...(draftObjects[objectId] ?? {}) };
    delete objectOverrides[selectedToken];

    const nextObjects = { ...draftObjects };
    if (Object.keys(objectOverrides).length === 0) {
      delete nextObjects[objectId];
    } else {
      nextObjects[objectId] = objectOverrides;
    }
    onChangeObjects(nextObjects);
  }

  function applyTokenJumpSelection(): void {
    const target = resolveTokenJumpTarget(tokenJumpInput);
    if (!target) return;
    const index = THEME_TEXT_TOKEN_KEYS.indexOf(target);
    if (index >= 0) {
      setSelectedTokenIndex(index);
    }
  }

  function commitHexInput(): boolean {
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setHexError("Hex must be #RRGGBB");
      return false;
    }
    setHexError(null);
    setHexInput(normalized);
    applyScopeColor(normalized);
    return true;
  }

  function moveScopeObject(delta: 1 | -1): void {
    if (scope.kind !== "object") return;
    const current = THEME_OBJECT_IDS.indexOf(scope.objectId);
    const safe = current === -1 ? 0 : current;
    const next =
      THEME_OBJECT_IDS[(safe + delta + THEME_OBJECT_IDS.length) % THEME_OBJECT_IDS.length];
    setScope({ kind: "object", objectId: next });
  }

  function focusTokenEditorForSelectedToken(): void {
    setFocusTarget(tokenListTextEditorEntryFocusTarget());
  }

  function exitTokenEditorToList(): void {
    setFocusTarget("tokenList");
  }

  useImperativeHandle(
    ref,
    () => ({
      handleKey(key: KeyEvent): boolean {
        const lowerName = (key.name ?? "").toLowerCase();
        const lowerSequence = (key.sequence ?? "").toLowerCase();
        const step = key.shift ? 10 : 1;

        if (lowerName === "escape" || lowerName === "c" || lowerSequence === "c") {
          onCancel();
          return true;
        }
        if (lowerName === "s" || lowerSequence === "s") {
          onSave();
          return true;
        }
        if (lowerName === "r" || lowerSequence === "r") {
          resetSelectedToken();
          return true;
        }

        if (key.name === "tab") {
          if (!key.shift && focusTarget === "tokenList") {
            focusTokenEditorForSelectedToken();
            return true;
          }
          setFocusTarget((current) =>
            resolveBuiltInTextEditorTabFocus(current, key.shift === true)
          );
          return true;
        }

        if (focusTarget === "scope") {
          if (key.name === "left") {
            setScope((current) => (current.kind === "object" ? { kind: "global" } : current));
            return true;
          }
          if (key.name === "right") {
            setScope((current) =>
              current.kind === "global"
                ? { kind: "object", objectId: THEME_OBJECT_IDS[0] }
                : current
            );
            return true;
          }
          if (key.name === "up") {
            moveScopeObject(-1);
            return true;
          }
          if (key.name === "down") {
            moveScopeObject(1);
            return true;
          }
        }

        if (focusTarget === "tokenList") {
          if (key.name === "up") {
            setSelectedTokenIndex(
              (current) =>
                (current - 1 + THEME_TEXT_TOKEN_KEYS.length) % THEME_TEXT_TOKEN_KEYS.length
            );
            return true;
          }
          if (key.name === "down") {
            setSelectedTokenIndex((current) => (current + 1) % THEME_TEXT_TOKEN_KEYS.length);
            return true;
          }
          if (key.name === "right") {
            const next = resolveBuiltInTextEditorRightFocus(focusTarget);
            if (next) {
              focusTokenEditorForSelectedToken();
              return true;
            }
          }
        }

        if (focusTarget === "tokenJump" && (key.name === "return" || key.name === "enter")) {
          applyTokenJumpSelection();
          return true;
        }

        if (focusTarget === "hex" && (key.name === "return" || key.name === "enter")) {
          const commitSucceeded = commitHexInput();
          const next = resolveBuiltInTextEditorHexCommitFocus(commitSucceeded);
          if (next) {
            exitTokenEditorToList();
          }
          return true;
        }

        if (focusTarget === "hex" && key.name === "left") {
          const inputRef = hexInputRef.current;
          if (!inputRef) return false;
          // Hex input keeps a leading "#" that remains editable, so left-boundary
          // exit uses cursor position 0 (before "#"), not 1.
          const shouldExit = shouldExitBuiltInHexToTokenListOnLeft({
            cursorOffset: inputRef.cursorOffset,
            hasSelection: inputRef.hasSelection(),
            leftBoundary: 0
          });
          if (!shouldExit) return false;
          const next = resolveBuiltInTextEditorLeftFocus(focusTarget);
          if (next) {
            setFocusTarget(next);
            return true;
          }
          return false;
        }

        if (focusTarget === "rgbR" || focusTarget === "rgbG" || focusTarget === "rgbB") {
          const channel = focusTarget === "rgbR" ? "r" : focusTarget === "rgbG" ? "g" : "b";
          if (key.name === "return" || key.name === "enter") {
            exitTokenEditorToList();
            return true;
          }
          if (key.name === "left") {
            adjustRgbChannel(channel, -step);
            return true;
          }
          if (key.name === "right") {
            adjustRgbChannel(channel, step);
            return true;
          }
          if (key.name === "up") {
            setFocusTarget(channel === "r" ? "rgbB" : channel === "g" ? "rgbR" : "rgbG");
            return true;
          }
          if (key.name === "down") {
            setFocusTarget(channel === "r" ? "rgbG" : channel === "g" ? "rgbB" : "rgbR");
            return true;
          }
        }

        if (
          (focusTarget === "save" || focusTarget === "cancel") &&
          (key.name === "return" || key.name === "enter")
        ) {
          if (focusTarget === "save") {
            onSave();
          } else {
            onCancel();
          }
          return true;
        }

        return false;
      }
    }),
    [
      baseTokens,
      currentColor,
      draftGlobal,
      draftObjects,
      focusTarget,
      hexInput,
      onCancel,
      onChangeGlobal,
      onChangeObjects,
      onSave,
      scope,
      selectedToken,
      tokenJumpInput
    ]
  );

  const currentRgb = hexToRgb(currentColor) ?? { r: 0, g: 0, b: 0 };

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <text style={{ color: helpTheme.text, fontWeight: "bold" }}>
        Built-in Text Editor ({formatThemeDisplayName(themeId)})
      </text>
      <box
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: focusTarget === "scope" ? helpTheme.accentBlue : "transparent",
          paddingLeft: 1,
          paddingRight: 1
        }}
      >
        <text style={{ color: focusTarget === "scope" ? helpTheme.bg : helpTheme.text }}>
          Scope: {scope.kind === "global" ? "Global" : `Object ${formatObjectLabel(scope.objectId)}`}
        </text>
      </box>
      <box style={{ flexDirection: "row", gap: 2 }}>
        <box style={{ flexDirection: "column", width: 18 }}>
          <text style={{ color: helpTheme.muted }}>TEXT TOKENS</text>
          {THEME_TEXT_TOKEN_KEYS.map((token, index) => {
            const selected = index === selectedTokenIndex;
            const focused = focusTarget === "tokenList" && selected;
            return (
              <box
                key={token}
                style={{
                  backgroundColor: focused ? helpTheme.accentBlue : "transparent",
                  paddingLeft: 1,
                  paddingRight: 1
                }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  setSelectedTokenIndex(index);
                  setFocusTarget("tokenList");
                }}
              >
                <text style={{ color: focused ? helpTheme.bg : helpTheme.text }}>
                  {selected ? "▶ " : "  "}
                  {token}
                </text>
              </box>
            );
          })}
        </box>
        <box style={{ flexDirection: "column", flexGrow: 1, gap: 1 }}>
          <text style={{ color: helpTheme.muted }}>Token jump</text>
          <input
            value={tokenJumpInput}
            onChange={setTokenJumpInput}
            focused={focusTarget === "tokenJump"}
            onKeyDown={(event) => {
              if (event.name === "return" || event.name === "enter") {
                event.preventDefault();
                event.stopPropagation();
                applyTokenJumpSelection();
              }
            }}
            style={{ backgroundColor: inputsTheme.bg, color: inputsTheme.text }}
          />
          <text style={{ color: helpTheme.muted }}>Hex</text>
          <input
            ref={hexInputRef}
            value={hexInput}
            onChange={setHexInput}
            focused={focusTarget === "hex"}
            onKeyDown={(event) => {
              if (event.name === "return" || event.name === "enter") {
                event.preventDefault();
                event.stopPropagation();
                const commitSucceeded = commitHexInput();
                if (commitSucceeded) {
                  exitTokenEditorToList();
                }
              }
            }}
            style={{ backgroundColor: inputsTheme.bg, color: inputsTheme.text }}
          />
          {hexError ? <text style={{ color: helpTheme.warn }}>{hexError}</text> : null}
          <text style={{ color: helpTheme.muted }}>RGB</text>
          {(["r", "g", "b"] as const).map((channel) => {
            const channelFocus =
              channel === "r" ? "rgbR" : channel === "g" ? "rgbG" : "rgbB";
            const focused = focusTarget === channelFocus;
            const value =
              channel === "r" ? currentRgb.r : channel === "g" ? currentRgb.g : currentRgb.b;
            return (
              <box
                key={channel}
                style={{
                  flexDirection: "row",
                  backgroundColor: focused ? helpTheme.accentBlue : "transparent",
                  paddingLeft: 1,
                  paddingRight: 1
                }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  setFocusTarget(channelFocus);
                }}
                onMouseScroll={(event) => {
                  const direction = event.scroll?.direction;
                  if (direction === "up") {
                    adjustRgbChannel(channel, 1);
                  } else if (direction === "down") {
                    adjustRgbChannel(channel, -1);
                  }
                }}
              >
                <text style={{ color: focused ? helpTheme.bg : helpTheme.text }}>
                  {formatRgbRow(channel.toUpperCase() as "R" | "G" | "B", value)}
                </text>
              </box>
            );
          })}
          <box style={{ flexDirection: "row", gap: 1 }}>
            <box
              style={{
                backgroundColor: focusTarget === "save" ? helpTheme.accentBlue : helpTheme.outline,
                paddingLeft: 1,
                paddingRight: 1
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                onSave();
              }}
            >
              <text style={{ color: helpTheme.bg, fontWeight: "bold" }}>SAVE [S]</text>
            </box>
            <box
              style={{
                backgroundColor: focusTarget === "cancel" ? helpTheme.warn : helpTheme.outline,
                paddingLeft: 1,
                paddingRight: 1
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                onCancel();
              }}
            >
              <text style={{ color: helpTheme.bg, fontWeight: "bold" }}>CANCEL [C/Esc]</text>
            </box>
            <box
              style={{ backgroundColor: helpTheme.outline, paddingLeft: 1, paddingRight: 1 }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                resetSelectedToken();
              }}
            >
              <text style={{ color: helpTheme.text, fontWeight: "bold" }}>RESET [R]</text>
            </box>
          </box>
        </box>
      </box>
    </box>
  );
});
