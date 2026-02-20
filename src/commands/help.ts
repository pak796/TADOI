import type { HelpTopic } from "./types";

const HELP_GENERAL = "Commands: add, done, due, recur, help. Try: help recur";
const HELP_ADD =
  'add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]';
const HELP_DONE = "done | done @selected | done id:<task-id>";
const HELP_DUE =
  "due @selected YYYY-MM-DD [at:HH:MM] | due id:<task-id> YYYY-MM-DD [at:HH:MM] | due @selected clear | due id:<task-id> clear";
const HELP_RECUR =
  "recur @selected clear | recur id:<task-id> clear | recur <target> every:day|week|month [interval:N] [on:mon,wed|1,15]";

export function getHelpLine(topic?: HelpTopic): string {
  if (!topic) return HELP_GENERAL;
  if (topic === "add") return HELP_ADD;
  if (topic === "done") return HELP_DONE;
  if (topic === "recur") return HELP_RECUR;
  return HELP_DUE;
}
