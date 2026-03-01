export type NoteId = string;
export type NotePath = string;
export type NoteKey = NotePath;

export type Note = {
  id?: NoteId;
  path: NotePath;
  filename: string;
  title: string;
  tags: string[];
  aliases: string[];
  created?: string;
  updated?: string;
  mtimeMs: number;
};

export type NoteRefKind = "wikilink" | "mdlink";

export type NoteRef = {
  from: NoteKey;
  toRaw: string;
  toResolved?: NoteKey;
  display?: string;
  kind: NoteRefKind;
  broken?: boolean;
  ambiguous?: boolean;
};

export type TaskRef = {
  from: NoteKey;
  taskId: string;
};

export type NoteWarningCode =
  | "frontmatter_parse"
  | "tag_normalization"
  | "link_broken"
  | "link_ambiguous"
  | "id_duplicate"
  | "title_duplicate";

export type NoteWarning = {
  notePath: NotePath;
  code: NoteWarningCode;
  message: string;
  raw?: string;
  normalized?: string;
};

export type ParsedNote = {
  note: Note;
  content: string;
  outgoingNoteRefs: NoteRef[];
  outgoingTaskRefs: TaskRef[];
  rawTitle: string;
  titleKey: string;
  hash: string;
  warnings: NoteWarning[];
};

export type NoteGraphIndex = {
  notesByPath: Map<NotePath, Note>;
  notesById: Map<NoteId, NotePath>;
  notesByTitle: Map<string, NotePath[]>;
  tagToNotes: Map<string, Set<NotePath>>;
  outgoingNoteRefs: Map<NotePath, NoteRef[]>;
  outgoingTaskRefs: Map<NotePath, TaskRef[]>;
  backlinks: Map<NotePath, Set<NotePath>>;
  warningsByPath: Map<NotePath, NoteWarning[]>;
};

export type NoteListItem = {
  path: NotePath;
  title: string;
  mtimeMs: number;
  tags: string[];
};

export type NoteDocument = {
  path: NotePath;
  content: string;
  mtimeMs: number;
};

export type NoteChangeKind = "created" | "updated" | "deleted";

export type NoteChange = {
  kind: NoteChangeKind;
  path: NotePath;
};
