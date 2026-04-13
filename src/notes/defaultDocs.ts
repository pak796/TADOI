import type { NotePath } from "./types";

export type DefaultGuideDoc = {
  path: NotePath;
  title: string;
  content: string;
};

export const DEFAULT_TOME_GUIDE_DOCS: ReadonlyArray<DefaultGuideDoc> = [
  {
    path: "TADOI Guides/README - TADOI Overview.md",
    title: "README - TADOI Overview",
    content: `# README - TADOI Overview

TADOI is a keyboard-first terminal task manager with an integrated notes tool called TOME (Terminal Oriented Markdown Environment).

## What TADOI Is For
- Capture and manage tasks quickly from keyboard flows.
- Track due dates, priorities, tags, and recurring work.
- Keep notes in markdown files directly on disk through TOME.

## Core Areas
- LIST: daily task workflow.
- DASHBOARD: rollup view for workload and priorities.
- TITS: in-app and CLI command layer.
- TOME: local markdown notes linked to tasks.

## Data + Files
- Task data is saved to a JSON data file.
- TOME notes are plain .md files in the configured notes root.
- Notes are editable outside the app and picked up by refresh/reindex.

## Where To Learn More
- Main usage guide: docs/USAGE.md
- QA guide: docs/TADOI_QA_Guide_v0.4.0.md
- Notes implementation notes: docs/specs/local-markdown-notes-implementation-notes.md
`,
  },
  {
    path: "TADOI Guides/Guide - Using TADOI.md",
    title: "Guide - Using TADOI",
    content: `# Guide - Using TADOI

This guide is a quick start for daily usage.

## Common Keys
- \`a\`: add task
- \`e\`: edit task
- \`Space\`: toggle done/open
- \`d\`: delete task
- \`/\`: search tasks
- \`n\`: open TOME
- \`?\`: open help

## TOME Basics
- In TOME list:
  - \`Enter\`: open selected note
  - \`a\`: create note
  - \`e\`: edit note
  - \`d\`: delete note (confirm modal)
  - \`r\`: reindex notes
- In TOME view:
  - \`d\`: delete current note (confirm modal)
  - \`Esc\`: back to note list

## TITS Command Examples
- \`note new "My Note"\`
- \`note open "My Note"\`
- \`note delete "My Note"\`
- \`note restore-defaults\`

## Tips
- Keep note titles specific to reduce open/delete ambiguity.
- Use \`id:<note-id>\` in \`note open\` and \`note delete\` when needed.
- Reindex after major external note changes.
`,
  },
  {
    path: "TADOI Guides/Troubleshooting.md",
    title: "Troubleshooting",
    content: `# Troubleshooting

## TOME does not open
- Confirm notes are enabled in settings.
- Check the runtime banner for TOME root errors.
- Verify the notes root path is writable.

## Note not found / ambiguous note query
- Use an exact file path, for example \`Project/Plan.md\`.
- Use \`id:<note-id>\` to disambiguate duplicate titles.
- Run \`note reindex\` after large external edits.

## I deleted a built-in guide note
- Run \`note restore-defaults\`.
- Restore is missing-only and never overwrites existing notes.

## Terminal behavior feels inconsistent
- Ensure terminal is at least 104x24.
- Check key alias settings in Help -> Settings.
- Verify no conflicting shell key remaps are active.

## Save or file errors
- Confirm file permissions for data and notes directories.
- Check free disk space.
- If save conflict appears, reload and retry as instructed by the banner.
`,
  },
  {
    path: "TADOI Guides/Support - Placeholder.md",
    title: "Support - Placeholder",
    content: `# Support - Placeholder

This is a placeholder support document for future built-in documentation.

## Planned Support Content
- Common setup issues
- Migration and backup help
- Command reference quick map
- FAQ and known limitations

## Current Self-Service Links
- README.md
- docs/USAGE.md
- docs/QA/LOCAL_MARKDOWN_NOTES_CHECKLIST.md
- docs/specs/local-markdown-notes-implementation-notes.md

## Recovery
- If default guide notes were removed, run:
  - \`note restore-defaults\`

Future releases can extend this note or add more built-in guide notes under \`TADOI Guides/\`.
`,
  },
] as const;

export const DEFAULT_TOME_GUIDE_PATHS: ReadonlyArray<NotePath> =
  DEFAULT_TOME_GUIDE_DOCS.map((doc) => doc.path);
