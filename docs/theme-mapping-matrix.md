# Theme Mapping Matrix (As of v0.3.5)

Stability: `Current Behavior (May Change)` for Simple UX labels, `Canonical` for internal token schema.

## Purpose

This file maps the internal theme token model to a proposed non-power-user "Simple Theme" editing model.
It is source-truth for Phase 0 of `DECISION_PACKET.md` and is intentionally additive: no token renames, no persistence migration.

Code sources:
- `src/theme/themes.ts:35`
- `src/theme/themes.ts:423`
- `src/settings/settings.ts:26`
- `src/app/theme.ts:34`

## 1) Internal Token Groups

| User-facing group (Simple UX) | Internal tokens | Primary meaning | Runtime aliases/consumers |
|---|---|---|---|
| Surface | `bg`, `panel`, `border` | App/background containers and outlines | `bg`, `panel`, `outline`, `border` in `src/app/theme.ts:36-53` |
| Text | `text`, `mutedText` | Default foreground + secondary text | `text`, `muted`, `mutedText` in `src/app/theme.ts:48-50` |
| Accent | `accent`, `accent2` | Primary + secondary brand accents | `accentOrange`, `accentBlue`, `accent`, `accent2`, `dueLater` in `src/app/theme.ts:38-43,47` |
| Status | `ok`, `warn`, `danger` | Success / warning / danger semantics | `ok`, `dueSoon`, `danger` in `src/app/theme.ts:43,45-47` |
| Selection | `selectionBg`, `selectionText` | Focus/selection highlight colors | `selectionBg`, `selectionText`, `accentPurple` in `src/app/theme.ts:39,53-54` |

## 2) Scope Model (Global + Object Overrides)

Internal scope contracts:
- Global palette is a full `ThemeTokens` object.
- Object-level overrides are sparse `Partial<ThemeTokens>` by `ThemeObjectId`.
- For `custom1`, resolved theme = global + object override merge.

Code sources:
- `src/settings/settings.ts:47-50`
- `src/theme/themes.ts:428-441`

Object IDs available for override (`src/settings/settings.ts:26-45`):
- `appChrome`
- `taskList`
- `taskRow`
- `modal`
- `help`
- `inputs`
- `dashboard`
- `notifications`

## 3) Built-in Theme Text-Tuning Exception

For non-`custom1` themes, only text tokens can be overridden (`text`, `mutedText`, `selectionText`) via `textByTheme`.

Code sources:
- `src/settings/settings.ts:52-67`
- `src/theme/themes.ts:444-463`

Implication for Simple UX:
- Keep this as an Advanced concern in the first pass.
- Do not merge text-tuning UX into the first Simple editor release.

## 4) Proposed Simple UX Control Mapping (No Internal Schema Change)

| Simple control | Writes to internal tokens |
|---|---|
| Canvas | `bg` |
| Panels | `panel`, `border` |
| Text | `text`, `mutedText` |
| Accent (Primary) | `accent` |
| Accent (Secondary) | `accent2` |
| Success | `ok` |
| Warning | `warn` |
| Danger | `danger` |
| Selection | `selectionBg`, `selectionText` |

Guard rails:
- Only write normalized `#RRGGBB` values (already enforced by existing normalizers).
- Keep one-way "Open Advanced" from Simple to avoid mode confusion in first release.

## 5) Invariants to Preserve

1. No migration required for existing `customThemes` payloads.
2. Existing advanced editor behavior remains unchanged.
3. `ThemeTokens` key set remains unchanged (`src/theme/themes.ts:35-48`).
4. Object-override merge behavior remains unchanged (`src/theme/themes.ts:435-441`).
5. Persisted values remain normalized hex colors (`src/settings/settings.ts`, token normalizers).

## 6) Known Gap to Track During Implementation

`RuntimeTheme.warn` currently maps to `tokens.danger` (`src/app/theme.ts:44-45`) while `dueSoon` maps to `tokens.warn` (`src/app/theme.ts:46`).

Action:
- Treat this as an explicit compatibility behavior in current cycle.
- Add a focused test before any future remapping to avoid unintended UI color regressions.

## 7) Validation Checklist (Phase 1/2)

- [ ] New-user flow: apply preset + adjust 3 controls in <2 minutes.
- [ ] Existing `custom1` global/object overrides round-trip unchanged.
- [ ] Advanced editor still exposes all 12 tokens and object scopes.
- [ ] No schema migration step required on startup.
- [ ] Visual smoke: dashboard/list/modals remain readable after Simple-mode saves.
