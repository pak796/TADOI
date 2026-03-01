import type { NotePath, TaskRef } from "./types";

const TASK_REF_PATTERN = /@task:([A-Za-z0-9._:-]+)/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,;!?)\]}>]+$/;

function normalizeTaskRefId(raw: string): string {
  return raw.trim().replace(TRAILING_PUNCTUATION_PATTERN, "");
}

export function parseTaskRefs(fromPath: NotePath, markdown: string): TaskRef[] {
  const refs: TaskRef[] = [];
  TASK_REF_PATTERN.lastIndex = 0;
  let match = TASK_REF_PATTERN.exec(markdown);
  while (match) {
    const taskId = normalizeTaskRefId(match[1] ?? "");
    if (taskId.length > 0) {
      refs.push({ from: fromPath, taskId });
    }
    match = TASK_REF_PATTERN.exec(markdown);
  }
  return refs;
}
