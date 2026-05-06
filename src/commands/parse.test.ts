import { describe, expect, it } from "bun:test";
import { parseCommand, resolveTitsCommandAlias, tokenize } from "./parse";

const MINI_OPTIONS_10 = {
  now: Date.parse("2026-03-02T10:00:00-06:00"),
  tz: "America/Chicago"
} as const;

const MINI_OPTIONS_16 = {
  now: Date.parse("2026-03-02T16:00:00-06:00"),
  tz: "America/Chicago"
} as const;

describe("tokenize", () => {
  it("tokenizes whitespace while keeping quoted segments together", () => {
    expect(tokenize('add "Buy milk" notes:"hello world" #errands')).toEqual([
      "add",
      "Buy milk",
      "notes:hello world",
      "#errands"
    ]);
  });

  it("throws for unmatched quotes", () => {
    expect(() => tokenize('add "Buy milk')).toThrow("Error: unmatched quote");
  });
});

describe("resolveTitsCommandAlias", () => {
  it("resolves single-letter aliases to canonical command names", () => {
    expect(resolveTitsCommandAlias("a")).toBe("add");
    expect(resolveTitsCommandAlias("d")).toBe("done");
    expect(resolveTitsCommandAlias("r")).toBe("recur");
    expect(resolveTitsCommandAlias("h")).toBe("help");
    expect(resolveTitsCommandAlias("?")).toBe("help");
  });

  it("returns lowercased input for non-aliases", () => {
    expect(resolveTitsCommandAlias("ADD")).toBe("add");
    expect(resolveTitsCommandAlias("note")).toBe("note");
    expect(resolveTitsCommandAlias("xyz")).toBe("xyz");
  });
});

describe("parseCommand alias dispatch", () => {
  it("treats 'a' as 'add'", () => {
    const parsed = parseCommand('a "Buy milk" #errands', MINI_OPTIONS_10);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.command).toEqual({
      type: "add",
      title: "Buy milk",
      tags: ["#errands"]
    });
  });

  it("treats 'd id:abc' as 'done id:abc'", () => {
    const parsed = parseCommand("d id:abc-123");
    expect(parsed).toEqual({
      ok: true,
      command: {
        type: "done",
        target: { type: "id", id: "abc-123" }
      }
    });
  });

  it("treats 'r id:abc clear' as 'recur id:abc clear'", () => {
    const parsed = parseCommand("r id:abc-123 clear");
    expect(parsed).toEqual({
      ok: true,
      command: {
        type: "recur",
        target: { type: "id", id: "abc-123" },
        clear: true
      }
    });
  });

  it("treats '?' and 'h' as 'help'", () => {
    expect(parseCommand("?")).toEqual({
      ok: true,
      command: { type: "help" }
    });
    expect(parseCommand("h add")).toEqual({
      ok: true,
      command: { type: "help", topic: "add" }
    });
  });
});

describe("parseCommand", () => {
  it("parses add with unquoted multi-word title and options", () => {
    const parsed = parseCommand('add Buy milk due:2026-02-28 at:17:30 #errands notes:"2%"');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.command).toEqual({
      type: "add",
      title: "Buy milk",
      dueDate: "2026-02-28",
      atTime: "17:30",
      tags: ["#errands"],
      notes: "2%"
    });
  });

  it("requires quoted title when first token is option-like", () => {
    const parsed = parseCommand("add due:2026-02-28 #errands");
    expect(parsed).toEqual({
      ok: false,
      error:
        'Error: add title is required before options (quote titles starting with #, due:, at:, or notes:)'
    });
  });

  it("allows quoted option-like add title", () => {
    const parsed = parseCommand('add "due:watchlist" #work');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.command).toEqual({
      type: "add",
      title: "due:watchlist",
      tags: ["#work"]
    });
  });

  it("accepts dash-prefixed literal add titles", () => {
    expect(parseCommand("add --help")).toEqual({
      ok: true,
      command: {
        type: "add",
        title: "--help",
        tags: []
      }
    });
  });

  it("rejects invalid add date/time and at without due", () => {
    expect(parseCommand('add "X" due:2026-02-29')).toEqual({
      ok: false,
      error: 'Error: invalid due date "2026-02-29"'
    });
    expect(parseCommand('add "X" due:2026-02-28 at:24:00')).toEqual({
      ok: false,
      error: 'Error: invalid time "24:00"'
    });
    expect(parseCommand('add "X" at:09:00')).toEqual({
      ok: false,
      error: "Error: at: requires due:"
    });
  });

  it("parses done targets", () => {
    expect(parseCommand("done")).toEqual({
      ok: true,
      command: {
        type: "done",
        target: { type: "selected" }
      }
    });
    expect(parseCommand("done id:abc-123")).toEqual({
      ok: true,
      command: {
        type: "done",
        target: { type: "id", id: "abc-123" }
      }
    });
  });

  it("parses due forms", () => {
    expect(parseCommand("due @selected clear")).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "selected" },
        clear: true
      }
    });
    expect(parseCommand("due id:abc clear")).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "id", id: "abc" },
        clear: true
      }
    });
    expect(parseCommand("due id:abc 2026-03-05 at:09:00")).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "id", id: "abc" },
        clear: false,
        dueDate: "2026-03-05",
        atTime: "09:00"
      }
    });
  });

  it("parses mini due/time forms deterministically", () => {
    expect(parseCommand('add "X" due:"tomorrow 3pm"', MINI_OPTIONS_10)).toEqual({
      ok: true,
      command: {
        type: "add",
        title: "X",
        dueDate: "2026-03-03",
        atTime: "15:00",
        tags: []
      }
    });

    expect(parseCommand("due id:abc 3pm", MINI_OPTIONS_10)).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "id", id: "abc" },
        clear: false,
        dueDate: "2026-03-02",
        atTime: "15:00"
      }
    });

    expect(parseCommand("due id:abc 3pm", MINI_OPTIONS_16)).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "id", id: "abc" },
        clear: false,
        dueDate: "2026-03-03",
        atTime: "15:00"
      }
    });

    expect(parseCommand("due id:abc mon 3pm", MINI_OPTIONS_16)).toEqual({
      ok: true,
      command: {
        type: "due",
        target: { type: "id", id: "abc" },
        clear: false,
        dueDate: "2026-03-09",
        atTime: "15:00"
      }
    });
  });

  it("rejects unknown/ambiguous tokens in due parsing", () => {
    expect(parseCommand("due id:abc next mon", MINI_OPTIONS_10)).toEqual({
      ok: false,
      error: 'Error: invalid due date "next mon"'
    });

    expect(parseCommand("due id:abc 3", MINI_OPTIONS_10)).toEqual({
      ok: false,
      error: 'Error: ambiguous time "3"'
    });
  });

  it("parses help topics and rejects unknown commands", () => {
    expect(parseCommand("help")).toEqual({
      ok: true,
      command: { type: "help" }
    });
    expect(parseCommand("help add")).toEqual({
      ok: true,
      command: { type: "help", topic: "add" }
    });
    expect(parseCommand("help recur")).toEqual({
      ok: true,
      command: { type: "help", topic: "recur" }
    });
    expect(parseCommand("help check")).toEqual({
      ok: true,
      command: { type: "help", topic: "check" }
    });
    expect(parseCommand("help bulk")).toEqual({
      ok: true,
      command: { type: "help", topic: "bulk" }
    });
    expect(parseCommand("help note")).toEqual({
      ok: true,
      command: { type: "help", topic: "note" }
    });
    expect(parseCommand("help tag")).toEqual({
      ok: true,
      command: { type: "help", topic: "tag" }
    });
    expect(parseCommand("wat")).toEqual({
      ok: false,
      error: 'Error: unknown command "wat"'
    });
  });

  it("parses tag lifecycle commands", () => {
    expect(parseCommand('tag rename " Work " work --dry-run')).toEqual({
      ok: true,
      command: {
        type: "tag",
        operation: "rename",
        oldTag: " Work ",
        newTag: "work",
        dryRun: true
      }
    });
    expect(parseCommand("tag merge work,work-project -> project")).toEqual({
      ok: true,
      command: {
        type: "tag",
        operation: "merge",
        sources: ["work", "work-project"],
        target: "project",
        dryRun: false
      }
    });
    expect(parseCommand("tag hygiene")).toEqual({
      ok: true,
      command: {
        type: "tag",
        operation: "hygiene",
        dryRun: false
      }
    });
    expect(parseCommand("tag cleanup --dry-run")).toEqual({
      ok: true,
      command: {
        type: "tag",
        operation: "cleanup",
        dryRun: true
      }
    });
  });

  it("rejects malformed tag lifecycle command forms", () => {
    expect(parseCommand("tag rename old")).toEqual({
      ok: false,
      error: "Error: tag rename requires <old> <new>"
    });
    expect(parseCommand("tag merge a,b c")).toEqual({
      ok: false,
      error: "Error: tag merge requires <src1,src2,...> -> <target>"
    });
    expect(parseCommand("tag hygiene now")).toEqual({
      ok: false,
      error: "Error: tag hygiene takes no extra tokens"
    });
    expect(parseCommand("tag cleanup now")).toEqual({
      ok: false,
      error: "Error: tag cleanup takes no extra tokens"
    });
    expect(parseCommand("tag cleanup --dry-run now")).toEqual({
      ok: false,
      error: "Error: --dry-run must be the last token"
    });
  });

  it("parses note command families", () => {
    expect(parseCommand('note new "Design notes" --template meeting')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "new",
        title: "Design notes",
        template: "meeting"
      }
    });
    expect(parseCommand("note template meeting")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "template",
        template: "meeting"
      }
    });
    expect(parseCommand('nq "Daily" "Body" #work --status done --alias d1 --meta:source=cli')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "quick",
        title: "Daily",
        body: "Body",
        tags: ["work"],
        status: "done",
        aliases: ["d1"],
        metadata: { source: "cli" }
      }
    });
    expect(parseCommand('capture "Daily" "Body" id:task-123')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "quick",
        title: "Daily",
        body: "Body",
        tags: [],
        aliases: [],
        metadata: {},
        target: { type: "id", id: "task-123" }
      }
    });
    expect(
      parseCommand(
        'note q "Daily" #work --capture-mode append --no-link --from-task-notes --set-primary --clear-task-notes'
      )
    ).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "quick",
        title: "Daily",
        tags: ["work"],
        aliases: [],
        metadata: {},
        captureMode: "append",
        noLink: true,
        fromTaskNotes: true,
        setPrimary: true,
        clearTaskNotes: true
      }
    });
    expect(parseCommand('note open "Design notes"')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "open",
        query: "Design notes"
      }
    });
    expect(parseCommand("note search tag:inbox title:retro -tag:closed created:today limit:20", MINI_OPTIONS_10)).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "search",
        query: "tag:inbox title:retro -tag:closed created:today limit:20",
        filters: {
          textTerms: [],
          titleFilters: ["retro"],
          pathFilters: [],
          tagFilters: ["inbox"],
          excludedTagFilters: ["closed"],
          createdAfter: "2026-03-02",
          createdBefore: "2026-03-03",
          limit: 20
        }
      }
    });
    expect(parseCommand("note query tag:inbox")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "query",
        query: "tag:inbox",
        filters: {
          textTerms: [],
          titleFilters: [],
          pathFilters: [],
          tagFilters: ["inbox"],
          excludedTagFilters: []
        }
      }
    });
    expect(parseCommand("note graph Inbox incoming limit:5")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "graph",
        query: "Inbox",
        direction: "incoming",
        limit: 5
      }
    });
    expect(parseCommand("note links Inbox outgoing format:json")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "links",
        query: "Inbox",
        direction: "outgoing",
        format: "json"
      }
    });
    expect(parseCommand('note delete "Design notes"')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "delete",
        query: "Design notes"
      }
    });
    expect(parseCommand("note restore-defaults")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "restore_defaults"
      }
    });
    expect(parseCommand("note reindex")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "reindex"
      }
    });
    expect(parseCommand("note help")).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "help"
      }
    });
    expect(parseCommand('note root set "./vault notes"')).toEqual({
      ok: true,
      command: {
        type: "note",
        operation: "root_set",
        path: "./vault notes"
      }
    });
    expect(parseCommand("note restore-defaults now")).toEqual({
      ok: false,
      error: "Error: note restore-defaults takes no extra tokens"
    });
    expect(parseCommand('note q "Daily" --capture-mode invalid')).toEqual({
      ok: false,
      error: 'Error: --capture-mode must be "append", "new", or "prompt"'
    });
  });

  it("parses recur clear and recur rule forms", () => {
    expect(parseCommand("recur id:abc clear")).toEqual({
      ok: true,
      command: {
        type: "recur",
        target: { type: "id", id: "abc" },
        clear: true
      }
    });
    expect(parseCommand("recur @selected every:week interval:2 on:mon,wed")).toEqual({
      ok: true,
      command: {
        type: "recur",
        target: { type: "selected" },
        clear: false,
        every: "week",
        interval: 2,
        onDays: ["mon", "wed"]
      }
    });
    expect(parseCommand("recur id:abc every:month on:1,31")).toEqual({
      ok: true,
      command: {
        type: "recur",
        target: { type: "id", id: "abc" },
        clear: false,
        every: "month",
        interval: 1,
        onMonthDays: [1, 31]
      }
    });
  });

  it("rejects invalid recur forms", () => {
    expect(parseCommand("recur @selected every:day on:mon")).toEqual({
      ok: false,
      error: "Error: on: is not supported for every:day"
    });
    expect(parseCommand("recur id:abc every:week on:mo")).toEqual({
      ok: false,
      error: 'Error: invalid weekly on value "mo"'
    });
    expect(parseCommand("recur id:abc every:month on:0")).toEqual({
      ok: false,
      error: 'Error: invalid monthly on value "0"'
    });
  });

  it("parses check command families", () => {
    expect(parseCommand('check add @selected "Buy milk"')).toEqual({
      ok: true,
      command: {
        type: "check",
        operation: "add",
        target: { type: "selected" },
        text: "Buy milk"
      }
    });
    expect(parseCommand("check:toggle id:abc 2")).toEqual({
      ok: true,
      command: {
        type: "check",
        operation: "toggle",
        target: { type: "id", id: "abc" },
        index: 2
      }
    });
    expect(parseCommand('check edit @selected 1 "new text"')).toEqual({
      ok: true,
      command: {
        type: "check",
        operation: "edit",
        target: { type: "selected" },
        index: 1,
        text: "new text"
      }
    });
    expect(parseCommand("check:del id:abc 3")).toEqual({
      ok: true,
      command: {
        type: "check",
        operation: "del",
        target: { type: "id", id: "abc" },
        index: 3
      }
    });
    expect(parseCommand("check clear @selected")).toEqual({
      ok: true,
      command: {
        type: "check",
        operation: "clear",
        target: { type: "selected" }
      }
    });
  });

  it("parses bulk command families", () => {
    expect(parseCommand("bulk done")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "done",
        target: { type: "marked" }
      }
    });
    expect(parseCommand("bulk:done id:alpha id:beta")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "done",
        target: { type: "ids", ids: ["alpha", "beta"] }
      }
    });
    expect(parseCommand("bulk tag add #home #errands")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "tag_add",
        target: { type: "marked" },
        tags: ["#home", "#errands"]
      }
    });
    expect(parseCommand("bulk:tag:rm id:alpha #home")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "tag_rm",
        target: { type: "ids", ids: ["alpha"] },
        tags: ["#home"]
      }
    });
    expect(parseCommand("bulk due 2026-03-05 at:09:00")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target: { type: "marked" },
        clear: false,
        dueDate: "2026-03-05",
        atTime: "09:00"
      }
    });
    expect(parseCommand("bulk due tomorrow 3pm", MINI_OPTIONS_10)).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target: { type: "marked" },
        clear: false,
        dueDate: "2026-03-03",
        atTime: "15:00"
      }
    });
    expect(parseCommand("bulk:due:clear id:alpha id:beta")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "due",
        target: { type: "ids", ids: ["alpha", "beta"] },
        clear: true
      }
    });
    expect(parseCommand("bulk priority clear")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "priority",
        target: { type: "marked" },
        clear: true
      }
    });
    expect(parseCommand("bulk priority #p2")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "priority",
        target: { type: "marked" },
        clear: false,
        value: "#p2"
      }
    });
    expect(parseCommand("bulk assignee clear")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "assignee",
        target: { type: "marked" },
        clear: true
      }
    });
    expect(parseCommand("bulk project Apollo")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "project",
        target: { type: "marked" },
        clear: false,
        value: "Apollo"
      }
    });
    expect(parseCommand("bulk stage doing")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "stage",
        target: { type: "marked" },
        stage: "doing"
      }
    });
    expect(parseCommand("bulk delete")).toEqual({
      ok: true,
      command: {
        type: "bulk",
        operation: "delete",
        target: { type: "marked" }
      }
    });
  });
});
