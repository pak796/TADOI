import type { HelpTopic } from "./types";

const HELP_GENERAL = `TADOI command engine. Try: tadoi help <topic>

Topics: add, done, due, recur, check, bulk, note, tag

Aliases:
  a -> add        d -> done       r -> recur      h/? -> help
  ls / l -> list (CLI route)`;

const HELP_ADD = `add <title> [due:<date>] [at:<time>] [#tag ...] [notes:"..."]

Add a new task. Title may be unquoted; quote it if it begins with a #, due:, at:, or notes: token.

Examples:
  add Buy milk
  add "Read RFC 9293" due:tomorrow at:14:00 #work
  add "Call dentist" due:mon at:9am #health notes:"insurance card"

Options:
  due:<value>   Due date. Accepts: today | tomorrow | yesterday | mon..sun |
                +Nd | YYYY-MM-DD | natural like "next friday".
  at:<value>    Time of day (requires due:). Accepts: 9am | 17:30 | 5pm.
  #<tag>        Add a tag. Tags starting with #p1..#p4 mark priority.
  notes:"..."   Body notes for the task (use quotes).`;

const HELP_DONE = `done | done @selected | done id:<task-id>

Mark a task complete. With no arg, marks the in-app selected task. From the
CLI, pass an explicit id: target since there is no selection.

Examples:
  done id:480b125c-060d-4449-bfb8-8ddb80044911
  done @selected            # in-app only
  d id:abc-123              # 'd' is an alias for done`;

const HELP_DUE = `due <target> <date> [at:<time>] | due <target> clear

Set or clear the due date on a task. Date accepts the same vocabulary as
'add due:' (today, tomorrow, mon..sun, +Nd, YYYY-MM-DD, natural phrases).

Examples:
  due id:abc-123 tomorrow
  due id:abc-123 fri at:17:00
  due id:abc-123 +3d
  due id:abc-123 clear      # remove the due date

Targets:
  @selected            In-app selection only.
  id:<task-id>         Explicit id (use this from the CLI).`;

const HELP_RECUR = `recur <target> every:<day|week|month> [interval:N] [on:<days>] | recur <target> clear

Set or clear a recurrence rule on a task.

Examples:
  recur id:abc every:day
  recur id:abc every:week on:mon,wed,fri
  recur id:abc every:month on:1,15 interval:1
  recur id:abc clear

Options:
  every:<unit>     day, week, or month (also accepts daily/weekly/monthly).
  interval:N       Repeat every N units (default 1). E.g. every:week interval:2 = biweekly.
  on:<values>      Weekly: comma-separated weekday short names (mon,tue,wed,thu,fri,sat,sun).
                   Monthly: comma-separated days-of-month (1..31).`;

const HELP_CHECK = `check add <target> "text" | check toggle <target> <index>
check edit <target> <index> "text" | check del <target> <index> | check clear <target>

Per-task checklist (subtask) operations. Index is 1-based.

Examples:
  check add id:abc "draft outline"
  check toggle id:abc 1
  check edit id:abc 2 "rewrite intro"
  check del id:abc 3
  check clear id:abc`;

const HELP_BULK = `bulk <op> id:<task-id> [id:<task-id> ...] [args]

Apply an operation to many tasks in a single transaction. From the CLI you
must pass repeated id: targets; the in-app form uses marked selections.

Operations:
  bulk done                          Close every target task.
  bulk delete                        Delete every target task.
  bulk tag add #t1 #t2               Add tags to every target.
  bulk tag rm #t1                    Remove tags from every target.
  bulk due <date> [at:<time>]        Set due date on every target.
  bulk due clear                     Clear due date on every target.
  bulk priority <p1..p4|clear>       Set or clear priority.
  bulk assignee <value|clear>        Set or clear assignee.
  bulk project <value|clear>         Set or clear project.
  bulk stage <todo|doing|blocked|done>  Set workflow stage.

Example:
  bulk done id:abc-1 id:abc-2 id:abc-3`;

const HELP_NOTE = `TOME COMMANDS (Terminal Oriented Markdown Environment)
- note new "Title" [--template <id>]  Create note
- note template <id> ["Title"]         Create note from template
- note q|quick|capture "Title" ["Body"] [#tag|tag:x] [--status x] [--alias x] [--meta:key=value] [--template x] [--capture-mode append|new|prompt] [--no-link] [--from-task-notes] [--set-primary] [--clear-task-notes] [@selected|id:task]
- capture "Title" ...  Alias for note quick capture
- nq "Title" ...       Alias for note quick capture
- note open "Query"     Open note
- note search "Query"   Search TOME notes (tag:/-tag:/title:/path:/text:/created:/updated:/limit:/format:)
- note query "Query"    Alias for search
- note graph "Query" [incoming|outgoing|both] [limit:N] [format:text|json]
- note links "Query" [incoming|outgoing|both] [limit:N] [format:text|json]
- note delete "Query"   Delete note (same resolver as open)
- note restore-defaults Restore missing default guide docs
- note reindex          Rebuild TOME index
- note root set "Path"  Migrate TOME root (copy-first)
- note help             Show this help`;

const HELP_TAG = `tag <op> [args] [--dry-run]

Tag lifecycle utilities. --dry-run shows what would change without writing.

Operations:
  tag rename <old> <new>             Rename a tag everywhere.
  tag merge <src1,src2,...> -> <target>  Merge sources into one target tag.
  tag hygiene                        Surface duplicate/casing/whitespace issues.
  tag cleanup                        Apply suggested fixes from hygiene.

Examples:
  tag rename project-x projectx
  tag merge work,working,wrk -> work --dry-run
  tag hygiene`;

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
