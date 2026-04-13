import React, { useEffect, useRef, useState } from "react";
import path from "path";
import { createDataBackup, getDataFilePath } from "../state/persistence";
import type { SettingsState } from "../state/settingsStore";
import { createNotesService, isPathWithin } from "../notes/service";
import { parseFrontmatter, upsertFrontmatterTags } from "../notes/frontmatter";
import { renderMarkdownToTerminalLines } from "../notes/markdown";
import { parseNoteTags } from "../notes/tags";
import { resolveNotesRootPath } from "../notes/storage";
import type { NoteMention } from "../notes/mentions";
import type { NotePath, NoteRef, NoteWarning } from "../notes/types";
import { FocusTarget, Mode, type ThemeId } from "../domain/models";
import { formatTagForDisplay } from "../domain/tagIndex";
import { redactPathForDisplay } from "./pathRedaction";
import {
  filterNotesList,
  resolveActiveNoteTitle,
  resolveSelectedNoteTags
} from "./appSelectors";
import type { UIState } from "../ui/state";

const NOTES_POLL_FALLBACK_INTERVAL_MS = 5_000;

type NotesListItem = {
  path: NotePath;
  title: string;
  mtimeMs: number;
  tags: string[];
};

type NotesRuntimeState = {
  ready: boolean;
  enabled: boolean;
  notesRoot: string;
  error?: string;
};

type NoteViewState = {
  openPath: NotePath | null;
  content: string;
  lines: string[];
  outgoingRefs: NoteRef[];
  warnings: NoteWarning[];
  backlinks: NotePath[];
  unlinkedMentions: NoteMention[];
  linkedTasks: string[];
  selectedLinkIndex: number;
};

type NotesRuntimeDeps = {
  uiState: UIState;
  uiDispatch: (action: any) => void;
  settingsState: SettingsState;
  settingsDispatch: (action: any) => void;
  openListMode: (options?: { bypassUnsavedGuard?: boolean }) => void;
  clearPendingGPrefix: () => void;
  closeViewsOverlay: () => void;
  showShortNavigationBanner: (message: string) => void;
  showShortNavigationBannerIfIdle: (message: string) => void;
  triggerFirstTomeCreated: (at: number, notePath: string) => void;
  normalizeErrorDetail: (error: unknown) => string;
};

function createEmptyNoteViewState(): NoteViewState {
  return {
    openPath: null,
    content: "",
    lines: [],
    outgoingRefs: [],
    warnings: [],
    backlinks: [],
    unlinkedMentions: [],
    linkedTasks: [],
    selectedLinkIndex: 0
  };
}

function parseFrontmatterTagInput(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function useNotesRuntime(deps: NotesRuntimeDeps) {
  const notesServiceRef = useRef<ReturnType<typeof createNotesService> | null>(null);
  const [notesRuntime, setNotesRuntime] = useState<NotesRuntimeState>({
    ready: false,
    enabled: deps.settingsState.notes.enabled,
    notesRoot: resolveNotesRootPath(getDataFilePath(), deps.settingsState.notes.rootPath)
  });
  const [notesList, setNotesList] = useState<NotesListItem[]>([]);
  const [notesSelectedIndex, setNotesSelectedIndex] = useState(0);
  const [notesSearchQuery, setNotesSearchQuery] = useState("");
  const [notesTagFilterQuery, setNotesTagFilterQuery] = useState("");
  const [noteViewState, setNoteViewState] = useState<NoteViewState>(createEmptyNoteViewState);
  const notesOpenPathRef = useRef<NotePath | null>(null);
  const notesHydrateRequestIdRef = useRef(0);
  const [notesViewReturnToCapturedContext, setNotesViewReturnToCapturedContext] =
    useState(false);
  const notesOpenPath = noteViewState.openPath;
  const notesViewContent = noteViewState.content;
  const notesViewLines = noteViewState.lines;
  const notesOutgoingRefs = noteViewState.outgoingRefs;
  const notesWarnings = noteViewState.warnings;
  const notesBacklinks = noteViewState.backlinks;
  const notesUnlinkedMentions = noteViewState.unlinkedMentions;
  const notesLinkedTasks = noteViewState.linkedTasks;
  const notesSelectedLinkIndex = noteViewState.selectedLinkIndex;
  const [notesEditValue, setNotesEditValue] = useState("");
  const [notesEditFrontmatterTags, setNotesEditFrontmatterTags] = useState("");
  const notesEditFrontmatterTagsRef = useRef("");
  const [notesEditDirty, setNotesEditDirty] = useState(false);
  const [notesEditEscGuardArmed, setNotesEditEscGuardArmed] = useState(false);
  const [notesEditActiveField, setNotesEditActiveField] = useState<"tags" | "body">("body");
  const notesEditTextareaRef = useRef<{ plainText: string; setText?: (value: string) => void } | null>(
    null
  );
  const [notesRootSettingsOpen, setNotesRootSettingsOpen] = useState(false);
  const [notesRootInput, setNotesRootInput] = useState("");
  const [notesRootApplying, setNotesRootApplying] = useState(false);
  const [notesCreatePromptOpen, setNotesCreatePromptOpen] = useState(false);
  const [notesCreateTitle, setNotesCreateTitle] = useState("");
  const [notesCreateApplying, setNotesCreateApplying] = useState(false);
  const [notesRenamePromptOpen, setNotesRenamePromptOpen] = useState(false);
  const [notesRenameTitle, setNotesRenameTitle] = useState("");
  const [notesRenameApplying, setNotesRenameApplying] = useState(false);
  const [notesDeletePromptOpen, setNotesDeletePromptOpen] = useState(false);
  const [notesDeleteApplying, setNotesDeleteApplying] = useState(false);
  const notesDeleteTargetRef = useRef<{ path: NotePath; title: string } | null>(null);

  const filteredNotes = React.useMemo(
    () => filterNotesList(notesList, notesSearchQuery, notesTagFilterQuery),
    [notesList, notesSearchQuery, notesTagFilterQuery]
  );
  const clampedNotesSelectedIndex =
    filteredNotes.length === 0
      ? 0
      : Math.max(0, Math.min(notesSelectedIndex, filteredNotes.length - 1));
  const selectedNotesListItem = filteredNotes[clampedNotesSelectedIndex];
  const activeNoteTitle = resolveActiveNoteTitle({
    notesOpenPath,
    notesList,
    selectedNotesListItem
  });
  const selectedNoteTags = resolveSelectedNoteTags({
    notesOpenPath,
    notesList,
    selectedNotesListItem
  });
  const notesEditTagDraft = React.useMemo(
    () =>
      parseNoteTags({
        markdown: "",
        frontmatterTags: parseFrontmatterTagInput(notesEditFrontmatterTags)
      }),
    [notesEditFrontmatterTags]
  );
  const notesEditEffectiveTags = React.useMemo(() => {
    const parsed = parseFrontmatter(notesEditValue);
    return parseNoteTags({
      markdown: parsed.body,
      frontmatterTags: notesEditTagDraft.tags
    });
  }, [notesEditTagDraft.tags, notesEditValue]);
  const notesInlinePromptOpen =
    notesCreatePromptOpen || notesRenamePromptOpen || notesRootSettingsOpen;

  function updateNoteViewState(
    updater: NoteViewState | ((current: NoteViewState) => NoteViewState)
  ): void {
    setNoteViewState((current) => {
      const next =
        typeof updater === "function"
          ? (updater as (current: NoteViewState) => NoteViewState)(current)
          : updater;
      notesOpenPathRef.current = next.openPath;
      return next;
    });
  }

  function updateNoteViewField<K extends keyof NoteViewState>(
    key: K,
    value: React.SetStateAction<NoteViewState[K]>
  ): void {
    updateNoteViewState((current) => ({
      ...current,
      [key]:
        typeof value === "function"
          ? (value as (current: NoteViewState[K]) => NoteViewState[K])(current[key])
          : value
    }));
  }

  function setNotesOpenPath(value: React.SetStateAction<NotePath | null>): void {
    updateNoteViewField("openPath", value);
  }

  function setNotesViewContent(value: React.SetStateAction<string>): void {
    updateNoteViewField("content", value);
  }

  function setNotesViewLines(value: React.SetStateAction<string[]>): void {
    updateNoteViewField("lines", value);
  }

  function setNotesOutgoingRefs(value: React.SetStateAction<NoteRef[]>): void {
    updateNoteViewField("outgoingRefs", value);
  }

  function setNotesWarnings(value: React.SetStateAction<NoteWarning[]>): void {
    updateNoteViewField("warnings", value);
  }

  function setNotesBacklinks(value: React.SetStateAction<NotePath[]>): void {
    updateNoteViewField("backlinks", value);
  }

  function setNotesUnlinkedMentions(
    value: React.SetStateAction<NoteMention[]>
  ): void {
    updateNoteViewField("unlinkedMentions", value);
  }

  function setNotesLinkedTasks(value: React.SetStateAction<string[]>): void {
    updateNoteViewField("linkedTasks", value);
  }

  function setNotesSelectedLinkIndex(
    value: React.SetStateAction<number>
  ): void {
    updateNoteViewField("selectedLinkIndex", value);
  }

  function filterCurrentNotes(noteListOverride?: NotesListItem[]): NotesListItem[] {
    return filterNotesList(
      noteListOverride ?? notesList,
      notesSearchQuery,
      notesTagFilterQuery
    );
  }

  function clampNotesSelectionToAvailable(noteListOverride?: NotesListItem[]): void {
    const candidateNotes = noteListOverride ?? filteredNotes;
    if (candidateNotes.length === 0) {
      setNotesSelectedIndex(0);
      return;
    }
    setNotesSelectedIndex((current) =>
      Math.max(0, Math.min(current, candidateNotes.length - 1))
    );
  }

  function syncNotesSelectionToPath(
    pathValue: NotePath | null,
    noteListOverride?: NotesListItem[]
  ): void {
    const candidateNotes = noteListOverride ?? filteredNotes;
    if (!pathValue) {
      clampNotesSelectionToAvailable(candidateNotes);
      return;
    }
    const index = candidateNotes.findIndex((note) => note.path === pathValue);
    if (index >= 0) {
      setNotesSelectedIndex(index);
      return;
    }
    clampNotesSelectionToAvailable(candidateNotes);
  }

  function resolveNotesService(): ReturnType<typeof createNotesService> | null {
    const service = notesServiceRef.current;
    if (!service) {
      deps.showShortNavigationBanner("TOME service unavailable");
      return null;
    }
    return service;
  }

  function applyNotesEditFrontmatterTags(nextValue: string): void {
    notesEditFrontmatterTagsRef.current = nextValue;
    setNotesEditFrontmatterTags(nextValue);
    const nextTagDraft = parseNoteTags({
      markdown: "",
      frontmatterTags: parseFrontmatterTagInput(nextValue)
    });
    const nextContent = upsertFrontmatterTags(notesEditValue, nextTagDraft.tags);
    setNotesEditDirty(nextContent !== notesViewContent);
    setNotesEditEscGuardArmed(false);
  }

  function buildHydratedNoteViewState(options: {
    pathValue: NotePath;
    content: string;
    service: ReturnType<typeof createNotesService>;
    selectedLinkIndex: number;
  }): NoteViewState {
    const { pathValue, content, service, selectedLinkIndex } = options;
    return {
      openPath: pathValue,
      content,
      lines: renderMarkdownToTerminalLines(content),
      outgoingRefs: service.getResolvedOutgoingRefs(pathValue),
      warnings: service.getWarnings(pathValue),
      backlinks: service.getBacklinks(pathValue),
      unlinkedMentions: service.getUnlinkedMentions(pathValue),
      linkedTasks: service.getLinkedTasksForNote(pathValue),
      selectedLinkIndex
    };
  }

  function commitHydratedNoteView(options: {
    requestId: number;
    pathValue: NotePath;
    content: string;
    service: ReturnType<typeof createNotesService>;
    selectedLinkIndex: number | ((current: NoteViewState) => number);
  }): void {
    updateNoteViewState((current) => {
      if (notesHydrateRequestIdRef.current !== options.requestId) {
        return current;
      }
      const selectedLinkIndex =
        typeof options.selectedLinkIndex === "function"
          ? options.selectedLinkIndex(current)
          : options.selectedLinkIndex;
      return buildHydratedNoteViewState({
        pathValue: options.pathValue,
        content: options.content,
        service: options.service,
        selectedLinkIndex
      });
    });
  }

  async function hydrateOpenNote(pathValue: NotePath): Promise<void> {
    const service = resolveNotesService();
    if (!service) return;
    const requestId = notesHydrateRequestIdRef.current + 1;
    notesHydrateRequestIdRef.current = requestId;
    notesOpenPathRef.current = pathValue;
    try {
      await service.refreshChanged();
    } catch {
      // Best effort index refresh; fall through to direct note load.
    }
    const document = await service.getNoteContent(pathValue);
    if (notesHydrateRequestIdRef.current !== requestId) {
      return;
    }
    if (!document) {
      deps.showShortNavigationBanner(`Note not found: ${pathValue}`);
      return;
    }
    commitHydratedNoteView({
      requestId,
      pathValue,
      content: document.content,
      service,
      selectedLinkIndex: 0
    });
  }

  function openNotesMode() {
    if (!deps.settingsState.notes.enabled || !notesRuntime.enabled) {
      deps.showShortNavigationBanner(notesRuntime.error ?? "TOME is disabled in settings.");
      return;
    }
    deps.clearPendingGPrefix();
    deps.closeViewsOverlay();
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: deps.uiState.mode,
      focus: deps.uiState.focus
    });
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesViewReturnToCapturedContext(false);
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_LIST });
    clampNotesSelectionToAvailable();
  }

  function openNotesSearchMode() {
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: Mode.NOTES_LIST,
      focus: FocusTarget.NOTES_LIST
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_SEARCH });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_SEARCH_INPUT });
  }

  function closeNotesSearchMode() {
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_LIST });
    clampNotesSelectionToAvailable();
  }

  function openNotesTagFilterMode() {
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: Mode.NOTES_LIST,
      focus: FocusTarget.NOTES_LIST
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_TAG_FILTER });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_TAG_FILTER_INPUT });
  }

  function closeNotesTagFilterMode() {
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_LIST });
    clampNotesSelectionToAvailable();
  }

  function moveNotesSelection(delta: 1 | -1) {
    if (filteredNotes.length === 0) {
      setNotesSelectedIndex(0);
      return;
    }
    setNotesSelectedIndex((current) => {
      const safe = Math.max(0, Math.min(current, filteredNotes.length - 1));
      return (safe + delta + filteredNotes.length) % filteredNotes.length;
    });
  }

  async function openSelectedNoteFromList(): Promise<void> {
    if (!selectedNotesListItem) {
      deps.showShortNavigationBanner("No TOME notes available");
      return;
    }
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesViewReturnToCapturedContext(false);
    await hydrateOpenNote(selectedNotesListItem.path);
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: Mode.NOTES_LIST,
      focus: FocusTarget.NOTES_LIST
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_VIEW });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_VIEW });
  }

  function openNotesCreatePrompt(): void {
    setNotesRootSettingsOpen(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesCreatePromptOpen(true);
    setNotesCreateTitle("");
    setNotesCreateApplying(false);
  }

  function closeNotesCreatePrompt(): void {
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesCreateTitle("");
  }

  async function confirmNotesCreatePrompt(): Promise<void> {
    if (notesCreateApplying) return;
    const title = notesCreateTitle.trim();
    if (title.length === 0) {
      deps.showShortNavigationBanner("Enter a title to create a TOME note");
      return;
    }
    const service = resolveNotesService();
    if (!service) return;
    setNotesCreateApplying(true);
    try {
      const nowMs = Date.now();
      const created = await service.createNote(title, `# ${title}\n\n`);
      deps.triggerFirstTomeCreated(nowMs, created.path);
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      setNotesOpenPath(created.path);
      setNotesEditValue(created.content);
      setNotesEditFrontmatterTags("");
      notesEditFrontmatterTagsRef.current = "";
      setNotesEditDirty(false);
      setNotesEditEscGuardArmed(false);
      setNotesEditActiveField("body");
      setNotesCreatePromptOpen(false);
      setNotesCreateTitle("");
      setNotesRenamePromptOpen(false);
      setNotesRenameTitle("");
      setNotesRenameApplying(false);
      setNotesDeletePromptOpen(false);
      setNotesDeleteApplying(false);
      syncNotesSelectionToPath(created.path, filterCurrentNotes(nextNotesList));
      await hydrateOpenNote(created.path);
      deps.uiDispatch({
        type: "captureReturnContext",
        mode: Mode.NOTES_VIEW,
        focus: FocusTarget.NOTES_VIEW
      });
      deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_EDIT });
      deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_EDIT });
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `Failed to create note: ${deps.normalizeErrorDetail(error)}`
      );
    } finally {
      setNotesCreateApplying(false);
    }
  }

  function openNotesRenamePrompt(): void {
    if (!selectedNotesListItem) {
      deps.showShortNavigationBanner("No TOME note selected");
      return;
    }
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateTitle("");
    setNotesCreateApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesRenamePromptOpen(true);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
  }

  function closeNotesRenamePrompt(): void {
    setNotesRenamePromptOpen(false);
    setNotesRenameApplying(false);
    setNotesRenameTitle("");
  }

  async function confirmNotesRenamePrompt(): Promise<void> {
    if (notesRenameApplying) return;
    if (!selectedNotesListItem) {
      deps.showShortNavigationBanner("No TOME note selected");
      return;
    }
    const title = notesRenameTitle.trim();
    if (title.length === 0) {
      deps.showShortNavigationBanner("Enter a title to rename this TOME note");
      return;
    }
    const service = resolveNotesService();
    if (!service) return;
    setNotesRenameApplying(true);
    try {
      const renamed = await service.renameNote(selectedNotesListItem.path, title);
      if (!renamed) {
        deps.showShortNavigationBanner("TOME service unavailable");
        return;
      }
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      setNotesRenamePromptOpen(false);
      setNotesRenameTitle("");
      syncNotesSelectionToPath(renamed.path, filterCurrentNotes(nextNotesList));
      if (notesOpenPath === selectedNotesListItem.path) {
        await hydrateOpenNote(renamed.path);
      }
      deps.showShortNavigationBanner(`Renamed TOME note to ${renamed.path}`);
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `Failed to rename note: ${deps.normalizeErrorDetail(error)}`
      );
    } finally {
      setNotesRenameApplying(false);
    }
  }

  function openNotesDeletePrompt(): void {
    const selectedFromList = selectedNotesListItem;
    const selectedPathFromView = notesOpenPath;
    const selected =
      deps.uiState.mode === Mode.NOTES_VIEW && selectedPathFromView
        ? {
            path: selectedPathFromView,
            title:
              notesList.find((note) => note.path === selectedPathFromView)?.title ??
              path.posix.basename(selectedPathFromView, ".md")
          }
        : selectedFromList;
    if (!selected?.path) {
      deps.showShortNavigationBanner("No TOME note selected");
      return;
    }
    notesDeleteTargetRef.current = {
      path: selected.path,
      title: selected.title
    };
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateTitle("");
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    deps.closeViewsOverlay();
    deps.uiDispatch({
      type: "setModal",
      modal: {
        type: "note_delete",
        notePath: selected.path,
        noteTitle: selected.title,
        previousMode: Mode.NOTES_LIST,
        previousFocus: FocusTarget.NOTES_LIST
      }
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.MODAL_CONFIRM });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.MODAL });
  }

  function closeNotesDeletePrompt(): void {
    notesDeleteTargetRef.current = null;
    const modal = deps.uiState.modal;
    if (modal?.type === "note_delete") {
      deps.uiDispatch({ type: "setModal", modal: null });
      deps.uiDispatch({ type: "setMode", mode: modal.previousMode });
      deps.uiDispatch({ type: "setFocus", focus: modal.previousFocus });
    }
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
  }

  async function confirmNotesDeletePrompt(): Promise<void> {
    if (notesDeleteApplying) return;
    const selected = notesDeleteTargetRef.current;
    if (!selected) {
      deps.showShortNavigationBanner("No TOME note selected");
      return;
    }
    const service = resolveNotesService();
    if (!service) return;
    setNotesDeleteApplying(true);
    try {
      const deleted = await service.deleteNote(selected.path);
      if (!deleted) {
        deps.showShortNavigationBanner("TOME note already removed");
      } else {
        deps.showShortNavigationBanner(`Deleted TOME note: ${selected.title}`);
      }
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      setNotesDeletePromptOpen(false);
      notesDeleteTargetRef.current = null;
      notesHydrateRequestIdRef.current += 1;
      updateNoteViewState((current) => ({
        ...createEmptyNoteViewState(),
        selectedLinkIndex: current.selectedLinkIndex
      }));
      deps.uiDispatch({ type: "setModal", modal: null });
      deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_LIST });
      deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_LIST });
      clampNotesSelectionToAvailable(filterCurrentNotes(nextNotesList));
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `Failed to delete note: ${deps.normalizeErrorDetail(error)}`
      );
    } finally {
      setNotesDeleteApplying(false);
    }
  }

  async function openCurrentNoteForEdit(): Promise<void> {
    let targetPath = notesOpenPath;
    if (!targetPath) {
      targetPath = selectedNotesListItem?.path ?? null;
    }
    if (!targetPath) {
      deps.showShortNavigationBanner("No note selected");
      return;
    }
    await hydrateOpenNote(targetPath);
    const service = resolveNotesService();
    if (!service) return;
    const document = await service.getNoteContent(targetPath);
    if (!document) {
      deps.showShortNavigationBanner(`Note not found: ${targetPath}`);
      return;
    }
    const parsed = parseFrontmatter(document.content);
    setNotesEditValue(document.content);
    const nextFrontmatterTags = (parsed.frontmatter.tags ?? [])
      .map((tag) => formatTagForDisplay(tag))
      .join(" ");
    setNotesEditFrontmatterTags(nextFrontmatterTags);
    notesEditFrontmatterTagsRef.current = nextFrontmatterTags;
    setNotesEditDirty(false);
    setNotesEditEscGuardArmed(false);
    setNotesEditActiveField("body");
    deps.uiDispatch({
      type: "captureReturnContext",
      mode: Mode.NOTES_VIEW,
      focus: FocusTarget.NOTES_VIEW
    });
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_EDIT });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_EDIT });
  }

  async function saveCurrentNoteEdit(): Promise<void> {
    if (!notesOpenPath) {
      deps.showShortNavigationBanner("No note selected");
      return;
    }
    const service = resolveNotesService();
    if (!service) return;
    try {
      const nextContent = upsertFrontmatterTags(notesEditValue, notesEditTagDraft.tags);
      await service.saveNote(notesOpenPath, nextContent);
      setNotesEditValue(nextContent);
      const savedFrontmatterTags = notesEditTagDraft.tags
        .map((tag) => formatTagForDisplay(tag))
        .join(" ");
      setNotesEditFrontmatterTags(savedFrontmatterTags);
      notesEditFrontmatterTagsRef.current = savedFrontmatterTags;
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      await hydrateOpenNote(notesOpenPath);
      setNotesEditDirty(false);
      setNotesEditEscGuardArmed(false);
      setNotesEditActiveField("body");
      deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_VIEW });
      deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_VIEW });
      deps.showShortNavigationBanner(
        notesEditTagDraft.warnings.length > 0
          ? "Note saved (some tags normalized)"
          : "Note saved"
      );
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `Failed to save note: ${deps.normalizeErrorDetail(error)}`
      );
    }
  }

  function cancelCurrentNoteEdit(): void {
    if (notesEditDirty && !notesEditEscGuardArmed) {
      setNotesEditEscGuardArmed(true);
      deps.showShortNavigationBanner("Unsaved note changes. Press Esc again to discard.");
      return;
    }
    setNotesEditEscGuardArmed(false);
    setNotesEditDirty(false);
    setNotesEditActiveField("body");
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_VIEW });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_VIEW });
  }

  function backToNotesList(): void {
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesEditEscGuardArmed(false);
    const returnMode = deps.uiState.previousMode;
    const returnFocus = deps.uiState.previousFocus;
    const returnToCapturedContext =
      notesViewReturnToCapturedContext &&
      returnMode !== Mode.NOTES_LIST &&
      returnMode !== Mode.NOTES_VIEW &&
      returnMode !== Mode.NOTES_EDIT &&
      returnMode !== Mode.NOTES_SEARCH &&
      returnMode !== Mode.NOTES_TAG_FILTER;
    if (returnToCapturedContext) {
      setNotesViewReturnToCapturedContext(false);
      deps.uiDispatch({ type: "setMode", mode: returnMode });
      deps.uiDispatch({ type: "setFocus", focus: returnFocus });
      return;
    }
    setNotesViewReturnToCapturedContext(false);
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_LIST });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_LIST });
    syncNotesSelectionToPath(notesOpenPath);
  }

  function exitNotesToTaskList(): void {
    setNotesRootSettingsOpen(false);
    setNotesCreatePromptOpen(false);
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesEditEscGuardArmed(false);
    deps.openListMode({ bypassUnsavedGuard: true });
  }

  function moveNotesLinkSelection(delta: 1 | -1): void {
    if (notesOutgoingRefs.length === 0) {
      setNotesSelectedLinkIndex(0);
      return;
    }
    setNotesSelectedLinkIndex((current) => {
      const safe = Math.max(0, Math.min(current, notesOutgoingRefs.length - 1));
      return (safe + delta + notesOutgoingRefs.length) % notesOutgoingRefs.length;
    });
  }

  async function followNoteLink(ref: NoteRef | undefined, index?: number): Promise<void> {
    if (typeof index === "number") {
      setNotesSelectedLinkIndex(index);
    }
    if (!ref) {
      deps.showShortNavigationBanner("No link selected");
      return;
    }
    if (!ref.toResolved) {
      deps.showShortNavigationBanner(`Unresolved link: ${ref.toRaw}`);
      return;
    }
    setNotesViewReturnToCapturedContext(false);
    notesOpenPathRef.current = ref.toResolved;
    await hydrateOpenNote(ref.toResolved);
    deps.uiDispatch({ type: "setMode", mode: Mode.NOTES_VIEW });
    deps.uiDispatch({ type: "setFocus", focus: FocusTarget.NOTES_VIEW });
  }

  async function followSelectedNoteLink(): Promise<void> {
    await followNoteLink(notesOutgoingRefs[notesSelectedLinkIndex]);
  }

  async function reindexNotes(): Promise<void> {
    const service = resolveNotesService();
    if (!service) return;
    try {
      await service.reindexAll();
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      if (notesOpenPath) {
        await hydrateOpenNote(notesOpenPath);
      }
      deps.showShortNavigationBanner("TOME reindex complete");
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `TOME reindex failed: ${deps.normalizeErrorDetail(error)}`
      );
    }
  }

  function openNotesRootSettings(): void {
    setNotesCreatePromptOpen(false);
    setNotesCreateTitle("");
    setNotesCreateApplying(false);
    setNotesRenamePromptOpen(false);
    setNotesRenameTitle("");
    setNotesRenameApplying(false);
    setNotesDeletePromptOpen(false);
    setNotesDeleteApplying(false);
    setNotesRootInput(notesRuntime.notesRoot);
    setNotesRootSettingsOpen(true);
  }

  function closeNotesRootSettings(): void {
    setNotesRootSettingsOpen(false);
    setNotesRootApplying(false);
    setNotesRootInput(notesRuntime.notesRoot);
  }

  async function confirmNotesRootSettings(): Promise<void> {
    if (notesRootApplying) return;
    const service = resolveNotesService();
    if (!service) return;
    const rawInput = notesRootInput.trim();
    const nextRoot =
      rawInput.length > 0
        ? path.resolve(rawInput)
        : resolveNotesRootPath(getDataFilePath(), null);
    if (!isPathWithin(path.dirname(nextRoot), nextRoot)) {
      deps.showShortNavigationBanner("Invalid TOME root path");
      return;
    }

    setNotesRootApplying(true);
    try {
      await createDataBackup(getDataFilePath());
      await service.migrateNotesRootCopyFirst(nextRoot);
      deps.settingsDispatch({
        type: "setNotes",
        notes: {
          enabled: true,
          rootPath: nextRoot
        }
      });
      setNotesRootSettingsOpen(false);
      setNotesRootInput(nextRoot);
      const nextNotesList = service.listNotes();
      setNotesList(nextNotesList);
      setNotesRuntime({
        ready: true,
        enabled: true,
        notesRoot: nextRoot
      });
      if (notesOpenPath) {
        await hydrateOpenNote(notesOpenPath);
      }
      deps.showShortNavigationBanner(
        `TOME root migrated to ${redactPathForDisplay(nextRoot)}`
      );
    } catch (error: unknown) {
      deps.showShortNavigationBanner(
        `TOME root change failed: ${deps.normalizeErrorDetail(error)}`
      );
    } finally {
      setNotesRootApplying(false);
    }
  }

  useEffect(() => {
    const notesService = createNotesService({
      dataFilePath: getDataFilePath(),
      rootPath: deps.settingsState.notes.rootPath,
      enabled: deps.settingsState.notes.enabled
    });
    notesServiceRef.current = notesService;
    let cancelled = false;

    void (async () => {
      try {
        await notesService.initialize();
        await notesService.seedDefaultGuideDocsIfEmpty();
        if (cancelled) return;
        const status = notesService.getStatus();
        setNotesRuntime({
          ready: true,
          enabled: status.enabled,
          notesRoot: status.notesRoot
        });
        setNotesRootInput(status.notesRoot);
        setNotesList(notesService.listNotes());
      } catch (error: unknown) {
        if (cancelled) return;
        const detail = deps.normalizeErrorDetail(error);
        setNotesRuntime({
          ready: true,
          enabled: false,
          notesRoot: resolveNotesRootPath(getDataFilePath(), deps.settingsState.notes.rootPath),
          error: detail
        });
        deps.showShortNavigationBannerIfIdle(`TOME disabled: ${detail}`);
      }
    })();

    return () => {
      cancelled = true;
      notesService.stopAutoRefresh();
      if (notesServiceRef.current === notesService) {
        notesServiceRef.current = null;
      }
    };
  }, [
    deps.normalizeErrorDetail,
    deps.settingsState.notes.enabled,
    deps.settingsState.notes.rootPath,
    deps.showShortNavigationBannerIfIdle
  ]);

  useEffect(() => {
    notesOpenPathRef.current = notesOpenPath;
  }, [notesOpenPath]);

  useEffect(() => {
    if (!notesRuntime.ready || !notesRuntime.enabled) return;
    const service = notesServiceRef.current;
    if (!service) return;

    let cancelled = false;
    const hydrateFromService = async () => {
      if (cancelled) return;
      setNotesList(service.listNotes());
      const openPath = notesOpenPathRef.current;
      if (!openPath) return;

      const requestId = notesHydrateRequestIdRef.current + 1;
      notesHydrateRequestIdRef.current = requestId;
      const current = await service.getNoteContent(openPath);
      if (
        !current ||
        cancelled ||
        notesOpenPathRef.current !== openPath ||
        notesHydrateRequestIdRef.current !== requestId
      ) {
        return;
      }
      commitHydratedNoteView({
        requestId,
        pathValue: openPath,
        content: current.content,
        service,
        selectedLinkIndex: (currentState) => currentState.selectedLinkIndex
      });
    };

    void service
      .startAutoRefresh({
        pollingFallbackIntervalMs: NOTES_POLL_FALLBACK_INTERVAL_MS,
        onRefreshed: hydrateFromService
      })
      .catch(() => {
        // Best effort refresh runtime; errors surface through manual notes actions.
      });

    return () => {
      cancelled = true;
      service.stopAutoRefresh();
    };
  }, [notesRuntime.enabled, notesRuntime.ready, notesRuntime.notesRoot]);

  useEffect(() => {
    const textarea = notesEditTextareaRef.current;
    if (!textarea || typeof textarea.setText !== "function") return;
    if (textarea.plainText !== notesEditValue) {
      textarea.setText(notesEditValue);
    }
  }, [deps.uiState.mode, notesEditValue]);

  return {
    notesServiceRef,
    notesRuntime,
    setNotesRuntime,
    notesList,
    setNotesList,
    filteredNotes,
    clampedNotesSelectedIndex,
    selectedNotesListItem,
    activeNoteTitle,
    selectedNoteTags,
    notesSelectedIndex,
    setNotesSelectedIndex,
    notesSearchQuery,
    setNotesSearchQuery,
    notesTagFilterQuery,
    setNotesTagFilterQuery,
    notesOpenPath,
    setNotesOpenPath,
    notesViewReturnToCapturedContext,
    setNotesViewReturnToCapturedContext,
    notesViewContent,
    setNotesViewContent,
    notesViewLines,
    setNotesViewLines,
    notesOutgoingRefs,
    setNotesOutgoingRefs,
    notesWarnings,
    setNotesWarnings,
    notesBacklinks,
    setNotesBacklinks,
    notesUnlinkedMentions,
    setNotesUnlinkedMentions,
    notesLinkedTasks,
    setNotesLinkedTasks,
    notesSelectedLinkIndex,
    setNotesSelectedLinkIndex,
    notesEditValue,
    setNotesEditValue,
    notesEditFrontmatterTags,
    setNotesEditFrontmatterTags,
    notesEditFrontmatterTagsRef,
    notesEditTagDraft,
    notesEditEffectiveTags,
    notesEditDirty,
    setNotesEditDirty,
    notesEditEscGuardArmed,
    setNotesEditEscGuardArmed,
    notesEditActiveField,
    setNotesEditActiveField,
    notesEditTextareaRef,
    notesRootSettingsOpen,
    setNotesRootSettingsOpen,
    notesRootInput,
    setNotesRootInput,
    notesRootApplying,
    setNotesRootApplying,
    notesCreatePromptOpen,
    setNotesCreatePromptOpen,
    notesCreateTitle,
    setNotesCreateTitle,
    notesCreateApplying,
    setNotesCreateApplying,
    notesRenamePromptOpen,
    setNotesRenamePromptOpen,
    notesRenameTitle,
    setNotesRenameTitle,
    notesRenameApplying,
    setNotesRenameApplying,
    notesDeletePromptOpen,
    setNotesDeletePromptOpen,
    notesDeleteApplying,
    setNotesDeleteApplying,
    notesInlinePromptOpen,
    clampNotesSelectionToAvailable,
    syncNotesSelectionToPath,
    resolveNotesService,
    applyNotesEditFrontmatterTags,
    hydrateOpenNote,
    openNotesMode,
    openNotesSearchMode,
    closeNotesSearchMode,
    openNotesTagFilterMode,
    closeNotesTagFilterMode,
    moveNotesSelection,
    openSelectedNoteFromList,
    openNotesCreatePrompt,
    closeNotesCreatePrompt,
    confirmNotesCreatePrompt,
    openNotesRenamePrompt,
    closeNotesRenamePrompt,
    confirmNotesRenamePrompt,
    openNotesDeletePrompt,
    closeNotesDeletePrompt,
    confirmNotesDeletePrompt,
    openCurrentNoteForEdit,
    saveCurrentNoteEdit,
    cancelCurrentNoteEdit,
    backToNotesList,
    exitNotesToTaskList,
    moveNotesLinkSelection,
    followSelectedNoteLink,
    reindexNotes,
    openNotesRootSettings,
    closeNotesRootSettings,
    confirmNotesRootSettings
  };
}
