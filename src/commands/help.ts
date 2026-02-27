import type { HelpTopic } from "./types";

const HELP_GENERAL =
  "Commands: add, done, due, recur, check, bulk, help. Try: help check";
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

export function getHelpLine(topic?: HelpTopic): string {
  if (!topic) return HELP_GENERAL;
  if (topic === "add") return HELP_ADD;
  if (topic === "done") return HELP_DONE;
  if (topic === "recur") return HELP_RECUR;
  if (topic === "check") return HELP_CHECK;
  if (topic === "bulk") return HELP_BULK;
  return HELP_DUE;
}
