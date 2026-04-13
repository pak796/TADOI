import { upsertFrontmatter } from "../frontmatter";
import { resolveNotesRootPath } from "../storage";
import type { NotesService } from "../service";
import type { NoteCommand } from "../../commands/types";
import type { ExecuteNoteCommandContext } from "./shared";
import { TEMPLATE_DIR } from "./shared";
import type { NotePath } from "../types";

function normalizeTemplatePath(templateId: string): NotePath[] {
  const trimmed = templateId.trim().replace(/\\/g, "/");
  const withExt = trimmed.toLowerCase().endsWith(".md")
    ? trimmed
    : `${trimmed}.md`;
  const templatesPath = `${TEMPLATE_DIR}/${withExt}`.replace(/\/+/g, "/");
  return Array.from(new Set([withExt, templatesPath]));
}

export async function resolveTemplateContent(
  service: NotesService,
  templateId: string,
): Promise<{ path: NotePath; content: string } | null> {
  const candidates = normalizeTemplatePath(templateId);
  for (const candidate of candidates) {
    const document = await service.getNoteContent(candidate);
    if (document) {
      return { path: candidate, content: document.content };
    }
  }
  return null;
}

export function withTitleSeed(content: string, title: string): string {
  const replaced = content.replace(/\{\{\s*title\s*\}\}/gi, title);
  if (/^#\s+/m.test(replaced)) {
    return replaced;
  }
  const body = replaced.trim();
  if (!body) {
    return `# ${title}\n\n`;
  }
  return `# ${title}\n\n${body}\n`;
}

export function resolveLinkTargetTaskId(
  command: Extract<NoteCommand, { operation: "quick" }>,
  context: ExecuteNoteCommandContext,
): string | undefined {
  if (!command.target) return undefined;
  if (command.target.type === "id") return command.target.id;
  return context.selectedTaskId;
}

export function mergeCaptureBody(options: {
  body?: string;
  inlineTaskNotes?: string;
}): string | undefined {
  const body = options.body?.trim() ?? "";
  const inlineTaskNotes = options.inlineTaskNotes?.trim() ?? "";
  if (!body && !inlineTaskNotes) {
    return undefined;
  }
  if (!inlineTaskNotes) {
    return body || undefined;
  }
  if (!body) {
    return `Task notes snapshot:\n${inlineTaskNotes}`;
  }
  return `${body}\n\nTask notes snapshot:\n${inlineTaskNotes}`;
}

export function buildCaptureAppendBlock(options: {
  capturedAt: string;
  title: string;
  body?: string;
  linkedTaskId?: string;
  includeTaskLink: boolean;
}): string {
  const lines = [`## Capture ${options.capturedAt}`, `Title: ${options.title}`];
  const body = options.body?.trim() ?? "";
  if (body) {
    lines.push("", body);
  }
  if (options.includeTaskLink && options.linkedTaskId) {
    lines.push("", `Linked task: @task:${options.linkedTaskId}`);
  }
  return `${lines.join("\n").trim()}\n`;
}

export { upsertFrontmatter, resolveNotesRootPath };
