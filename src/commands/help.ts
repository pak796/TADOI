import type { HelpTopic } from "./types";

const HELP_GENERAL = "Commands: add, done, due, help. Try: help add";
const HELP_ADD =
  'add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]';
const HELP_DONE = "done | done @selected | done id:<task-id>";
const HELP_DUE =
  "due @selected YYYY-MM-DD [at:HH:MM] | due id:<task-id> YYYY-MM-DD [at:HH:MM] | due @selected clear";

export function getHelpLine(topic?: HelpTopic): string {
  if (!topic) return HELP_GENERAL;
  if (topic === "add") return HELP_ADD;
  if (topic === "done") return HELP_DONE;
  return HELP_DUE;
}
