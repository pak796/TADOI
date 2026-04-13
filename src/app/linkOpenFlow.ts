import type { TaskLink } from "../domain/models";
import {
  extractUrlScheme,
  resolveTaskLinkKind,
  resolveTaskLinkOpenPolicy,
  type NonHttpLinkPolicy,
  type TaskLinkOpenPolicy,
} from "../domain/taskLinks";

export type LinkOpenDecision = {
  policy: TaskLinkOpenPolicy;
  scheme: string;
  target: string;
};

export function decideTaskLinkOpen(
  link: Pick<TaskLink, "target" | "kind" | "source">,
  options: { nonHttpLinkPolicy?: NonHttpLinkPolicy } = {},
): LinkOpenDecision {
  const policy = resolveTaskLinkOpenPolicy(link, options);
  const scheme =
    resolveTaskLinkKind(link) === "path"
      ? "path"
      : (extractUrlScheme(link.target) ?? "unknown");

  return {
    policy,
    scheme,
    target: link.target,
  };
}
