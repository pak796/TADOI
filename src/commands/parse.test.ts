import { describe, expect, it } from "bun:test";
import { parseCommand, tokenize } from "./parse";

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

  it("parses help topics and rejects unknown commands", () => {
    expect(parseCommand("help")).toEqual({
      ok: true,
      command: { type: "help" }
    });
    expect(parseCommand("help add")).toEqual({
      ok: true,
      command: { type: "help", topic: "add" }
    });
    expect(parseCommand("wat")).toEqual({
      ok: false,
      error: 'Error: unknown command "wat"'
    });
  });
});
