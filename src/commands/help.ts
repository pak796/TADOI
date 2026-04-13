import type { HelpTopic } from "./types";

function joinHelpSegments(segments: readonly string[]): string {
  return segments.join(" | ");
}

const HELP_GENERAL =
  "Commands: add, done, due, recur, check, bulk, note, capture, nq, tag, help. Try: help tag";
const HELP_ADD =
  'add <title> [due:<date|mini>] [at:<time>] [#tag ...] [notes:"..."]';
const HELP_DONE = "done | done @selected | done id:<task-id>";
const HELP_DUE =
  "due <target> <date|mini> [at:<time>] | due <target> clear | mini: today | tomorrow | mon | +3d | 3pm | tomorrow 3pm";
const HELP_RECUR =
  "recur @selected clear | recur id:<task-id> clear | recur <target> every:day|week|month [interval:N] [on:mon,wed|1,15]";
const HELP_CHECK = joinHelpSegments([
  'check add @selected "text"',
  "check toggle @selected <index>",
  'check edit @selected <index> "text"',
  "check del @selected <index>",
  "check clear @selected",
]);
const HELP_BULK = joinHelpSegments([
  "bulk done",
  "bulk tag add #tag...",
  "bulk tag rm #tag...",
  "bulk due <date|mini> [at:<time>]",
  "bulk due clear",
  "bulk priority <P?>|clear",
  "bulk assignee <value|clear>",
  "bulk project <value|clear>",
  "bulk stage <todo|doing|blocked|done>",
  "bulk delete",
]);
const HELP_NOTE = [
  "TOME COMMANDS (Terminal Oriented Markdown Environment)",
  '- note new "Title" [--template <id>]  Create note',
  '- note template <id> ["Title"]         Create note from template',
  [
    '- note q|quick|capture "Title" ["Body"] [#tag|tag:x] [--status x] [--alias x]',
    " [--meta:key=value] [--template x] [--capture-mode append|new|prompt]",
    " [--no-link] [--from-task-notes] [--set-primary] [--clear-task-notes]",
    " [@selected|id:task]",
  ].join(""),
  '- capture "Title" ...  Alias for note quick capture',
  '- nq "Title" ...       Alias for note quick capture',
  '- note open "Query"     Open note',
  '- note search "Query"   Search TOME notes (tag:/-tag:/title:/path:/text:/created:/updated:/limit:/format:)',
  '- note query "Query"    Alias for search',
  '- note graph "Query" [incoming|outgoing|both] [limit:N] [format:text|json]',
  '- note links "Query" [incoming|outgoing|both] [limit:N] [format:text|json]',
  '- note delete "Query"   Delete note (same resolver as open)',
  "- note restore-defaults Restore missing default guide docs",
  "- note reindex          Rebuild TOME index",
  '- note root set "Path"  Migrate TOME root (copy-first)',
  "- note help             Show this help",
].join("\n");
const HELP_TAG = joinHelpSegments([
  "tag rename <old> <new> [--dry-run]",
  "tag merge <src1,src2,...> -> <target> [--dry-run]",
  "tag hygiene [--dry-run]",
  "tag cleanup [--dry-run]",
]);

export function getHelpLine(topic?: HelpTopic): string {
  if (!topic) return HELP_GENERAL;
  if (topic === "add") return HELP_ADD;
  if (topic === "done") return HELP_DONE;
  if (topic === "recur") return HELP_RECUR;
  if (topic === "check") return HELP_CHECK;
  if (topic === "bulk") return HELP_BULK;
  if (topic === "note") return HELP_NOTE;
  if (topic === "tag") return HELP_TAG;
  return HELP_DUE;
}
