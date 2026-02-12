import type { Task, TaskLink, TaskLinkKind } from "./models";

const SAFE_URL_SCHEMES = new Set(["http", "https", "mailto"]);
const WINDOWS_DRIVE_PATH_RE = /^[a-zA-Z]:[\\/]/;
const SCHEME_RE = /^([a-zA-Z][a-zA-Z\d+.-]*):/;
const LOCAL_PATH_RE = /^[./~]/;

export type LinkUpdatePatch = {
  target?: string;
  label?: string;
  kind?: TaskLinkKind;
};

export type NonHttpLinkPolicy = "prompt" | "block";
export type TaskLinkOpenPolicy = "allow" | "confirm" | "block";

export function extractUrlScheme(target: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;
  if (WINDOWS_DRIVE_PATH_RE.test(trimmed)) return undefined;

  const match = SCHEME_RE.exec(trimmed);
  if (!match) return undefined;
  return match[1].toLowerCase();
}

export function inferTaskLinkKind(target: string): TaskLinkKind {
  return extractUrlScheme(target) ? "url" : "path";
}

export function resolveTaskLinkKind(link: Pick<TaskLink, "target" | "kind">): TaskLinkKind {
  return link.kind ?? inferTaskLinkKind(link.target);
}

export function resolveTaskLinkOpenPolicy(
  link: Pick<TaskLink, "target" | "kind" | "source">,
  options: { nonHttpLinkPolicy?: NonHttpLinkPolicy } = {}
): TaskLinkOpenPolicy {
  const nonHttpLinkPolicy = options.nonHttpLinkPolicy ?? "prompt";
  const kind = resolveTaskLinkKind(link);

  if (kind === "path" || LOCAL_PATH_RE.test(link.target.trim())) {
    return nonHttpLinkPolicy === "block" ? "block" : "confirm";
  }

  const scheme = extractUrlScheme(link.target);
  if (!scheme) {
    return link.source === "calendar_import" ? "confirm" : "allow";
  }

  if (!SAFE_URL_SCHEMES.has(scheme)) {
    return nonHttpLinkPolicy === "block" ? "block" : "confirm";
  }

  if (link.source === "calendar_import") {
    return "confirm";
  }

  return "allow";
}

export function requiresExternalSchemeConfirm(
  link: Pick<TaskLink, "target" | "kind" | "source">,
  options: { nonHttpLinkPolicy?: NonHttpLinkPolicy } = {}
): boolean {
  return resolveTaskLinkOpenPolicy(link, options) === "confirm";
}

export function addTaskLink(task: Task, link: TaskLink): Task {
  const links = task.links ?? [];
  return {
    ...task,
    links: [...links, link]
  };
}

export function updateTaskLink(task: Task, linkId: string, patch: LinkUpdatePatch): Task {
  const links = task.links ?? [];
  return {
    ...task,
    links: links.map((link) => (link.id === linkId ? { ...link, ...patch } : link))
  };
}

export function deleteTaskLink(task: Task, linkId: string): Task {
  const links = task.links ?? [];
  return {
    ...task,
    links: links.filter((link) => link.id !== linkId)
  };
}
