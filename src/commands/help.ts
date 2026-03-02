import type { HelpTopic } from "./types";

const HELP_GENERAL =
  "Commands: add, done, due, recur, check, bulk, note, tag, help. Try: help tag";
const HELP_ADD =
  'add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]';
const HELP_DONE = "done | done @selected | done id:<task-id>";
const HELP_DUE =
  "due @selected YYYY-MM-DD [at:HH:MM] | due id:<task-id> YYYY-MM-DD [at:HH:MM] | due @selected clear | due id:<task-id> clear";
const HELP_RECUR =
  "recur @selected clear | recur id:<task-id> clear | recur <target> every:day|week|month [interval:N] [on:mon,wed|1,15]";
const HELP_CHECK =
  'check add @selected "text" | check toggle @selected <index> | check edit @selected <index> "text" | check del @selected <index> | check clear @selected';
const HELP_BULK =
  "bulk done | bulk tag add #tag... | bulk tag rm #tag... | bulk due YYYY-MM-DD [at:HH:MM] | bulk due clear | bulk priority <P?>|clear | bulk assignee <value|clear> | bulk project <value|clear> | bulk stage <todo|doing|blocked|done> | bulk delete";
const HELP_NOTE = `TOME COMMANDS (Terminal Oriented Markdown Environment)
- note new "Title"      Create note
- note open "Query"     Open note
- note search "Term"    Search TOME notes (supports tag:<x>)
- note delete "Query"   Delete note (same resolver as open)
- note restore-defaults Restore missing default guide docs
- note reindex          Rebuild TOME index
- note root set "Path"  Migrate TOME root (copy-first)
- note help             Show this help`;
const HELP_TAG =
  "tag rename <old> <new> [--dry-run] | tag merge <src1,src2,...> -> <target> [--dry-run] | tag hygiene [--dry-run] | tag cleanup [--dry-run]";

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
