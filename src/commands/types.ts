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

export type HelpTopic = "add" | "done" | "due";

export type HelpCommand = {
  type: "help";
  topic?: HelpTopic;
};

export type Command = AddCommand | DoneCommand | DueCommand | HelpCommand;

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
};
