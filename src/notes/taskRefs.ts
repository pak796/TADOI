import type { NotePath, TaskRef } from "./types";

const TASK_MENTION_REF_PATTERN = /@task:([A-Za-z0-9._:-]+)/g;
const TASK_WIKILINK_REF_PATTERN = /\[\[\s*task:([A-Za-z0-9._:-]+)\s*(?:\|[^\]]*)?\]\]/gi;
const TASK_URL_REF_PATTERN = /tadoi:\/\/task\/([A-Za-z0-9._:-]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,;!?)\]}>]+$/;

function normalizeTaskRefId(raw: string): string {
  return raw.trim().replace(TRAILING_PUNCTUATION_PATTERN, "");
}

function collectRefs(
  refs: TaskRef[],
  fromPath: NotePath,
  markdown: string,
  pattern: RegExp,
  kind: TaskRef["kind"]
): void {
  pattern.lastIndex = 0;
  let match = pattern.exec(markdown);
  while (match) {
    const taskId = normalizeTaskRefId(match[1] ?? "");
    if (taskId.length > 0) {
      refs.push({ from: fromPath, taskId, kind });
    }
    match = pattern.exec(markdown);
  }
}

export function parseTaskRefs(fromPath: NotePath, markdown: string): TaskRef[] {
  const refs: TaskRef[] = [];

  collectRefs(refs, fromPath, markdown, TASK_MENTION_REF_PATTERN, "mention");
  collectRefs(refs, fromPath, markdown, TASK_WIKILINK_REF_PATTERN, "wikilink");
  collectRefs(refs, fromPath, markdown, TASK_URL_REF_PATTERN, "url");

  const seen = new Set<string>();
  const deduped: TaskRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.taskId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ref);
  }
  return deduped;
}
