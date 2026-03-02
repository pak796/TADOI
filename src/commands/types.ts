import type { AppState, Task } from "../domain/models";
import type { Action } from "../state/store";

export type CommandTarget = { type: "selected" } | { type: "id"; id: string };

export type AddCommand = {
  type: "add";
  title: string;
  dueDate?: string;
  atTime?: string;
  tags: string[];
  notes?: string;
};

export type DoneCommand = {
  type: "done";
  target: CommandTarget;
};

export type DueCommand =
  | {
      type: "due";
      target: CommandTarget;
      clear: true;
    }
  | {
      type: "due";
      target: CommandTarget;
      clear: false;
      dueDate: string;
      atTime?: string;
    };

export type RecurEvery = "day" | "week" | "month";

export type RecurCommand =
  | {
      type: "recur";
      target: CommandTarget;
      clear: true;
    }
  | {
      type: "recur";
      target: CommandTarget;
      clear: false;
      every: RecurEvery;
      interval: number;
      onDays?: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
      onMonthDays?: number[];
    };

export type CheckCommand =
  | {
      type: "check";
      operation: "add";
      target: CommandTarget;
      text: string;
    }
  | {
      type: "check";
      operation: "toggle" | "del";
      target: CommandTarget;
      index: number;
    }
  | {
      type: "check";
      operation: "edit";
      target: CommandTarget;
      index: number;
      text: string;
    }
  | {
      type: "check";
      operation: "clear";
      target: CommandTarget;
    };

export type BulkTarget =
  | { type: "marked" }
  | { type: "ids"; ids: string[] };

export type BulkCommand =
  | {
      type: "bulk";
      operation: "done" | "delete";
      target: BulkTarget;
    }
  | {
      type: "bulk";
      operation: "tag_add" | "tag_rm";
      target: BulkTarget;
      tags: string[];
    }
  | {
      type: "bulk";
      operation: "due";
      target: BulkTarget;
      clear: true;
    }
  | {
      type: "bulk";
      operation: "due";
      target: BulkTarget;
      clear: false;
      dueDate: string;
      atTime?: string;
    }
  | {
      type: "bulk";
      operation: "priority";
      target: BulkTarget;
      clear: boolean;
      value?: string;
    }
  | {
      type: "bulk";
      operation: "assignee" | "project";
      target: BulkTarget;
      clear: boolean;
      value?: string;
    }
  | {
      type: "bulk";
      operation: "stage";
      target: BulkTarget;
      stage: "todo" | "doing" | "blocked" | "done";
    };

export type TagCommand =
  | {
      type: "tag";
      operation: "rename";
      oldTag: string;
      newTag: string;
      dryRun: boolean;
    }
  | {
      type: "tag";
      operation: "merge";
      sources: string[];
      target: string;
      dryRun: boolean;
    }
  | {
      type: "tag";
      operation: "hygiene" | "cleanup";
      dryRun: boolean;
    };

export type HelpTopic =
  | "add"
  | "done"
  | "due"
  | "recur"
  | "check"
  | "bulk"
  | "note"
  | "tag";

export type HelpCommand = {
  type: "help";
  topic?: HelpTopic;
};

export type NoteCommand =
  | {
      type: "note";
      operation: "new";
      title: string;
    }
  | {
      type: "note";
      operation: "open";
      query: string;
    }
  | {
      type: "note";
      operation: "search";
      query: string;
    }
  | {
      type: "note";
      operation: "delete";
      query: string;
    }
  | {
      type: "note";
      operation: "restore_defaults";
    }
  | {
      type: "note";
      operation: "reindex";
    }
  | {
      type: "note";
      operation: "help";
    }
  | {
      type: "note";
      operation: "root_set";
      path: string;
    };

export type Command =
  | AddCommand
  | DoneCommand
  | DueCommand
  | RecurCommand
  | CheckCommand
  | BulkCommand
  | TagCommand
  | HelpCommand
  | NoteCommand;

export type CommandOutput = {
  kind: "ok" | "error";
  text: string;
};

export type CommandResult = {
  actions: Action[];
  output: CommandOutput;
};

export type ParseCommandResult =
  | { ok: true; command: Command }
  | { ok: false; error: string };

export type ExecContext = {
  now: number;
  state: AppState;
  visibleTasks: Task[];
  selectedTaskId?: string;
  bulkMarkedTaskIds?: string[];
};
