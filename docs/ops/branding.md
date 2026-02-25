# TADOI™ Branding Operations Guide

This guide captures manual and cross-system actions that cannot be fully applied through repository file edits.

## In-Repo Audit Summary
- Applied first-mention branding rule to user-facing markdown docs.
- Added `TADOI™` to prominent first headings.
- Added required trademark notice to root README and docs landing page.
- Verified there are no legacy-name references and no registered-symbol usage in repo docs.
- Confirmed no GitHub Pages source directory exists in this repository.
- Confirmed no in-repo issue templates, PR templates, `SECURITY.md`, `CODE_OF_CONDUCT.md`, or `FUNDING.yml` are currently present.

## Manual GitHub Steps
Use these exact values in GitHub repository settings where fields are not code-managed.

1. Repository About → **Description**
- Set to: `TADOI™ terminal task manager. Keyboard-first, local-first TUI workflow for planning and execution.`

2. Repository About → **Website**
- If a docs URL is configured, use link text/context: `TADOI Documentation`
- Recommended target: the canonical docs entry URL for this repo.

3. Repository Social Preview / Marketing Copy
- Primary line: `TADOI™ is a keyboard-first terminal task manager built for local-first workflows.`
- Secondary line: `Fast task capture, recurrence, filtering, and portability in a TUI-first interface.`

4. Future Template Files (if added later)
- Ensure first prominent mention in each template uses `TADOI™`.
- Use `TADOI` for subsequent mentions in the same file.

## Notion Update Pack
Notion edit access is unavailable in this environment. Apply these edits manually in Notion.

### 1) Page: `TADOI` (project overview)
Section: page title and footer note.

Before:
```text
TADOI
```

After:
```text
TADOI™
```

Footer placement (bottom of page):
```text
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
```

### 2) Page: `TADOI Installation Guide (All Platforms)`
Section: title/header.

Before:
```text
TADOI Installation Guide (All Platforms)
```

After:
```text
TADOI™ Installation Guide (All Platforms)
```

### 3) Page: `TADOI QA Guide (v0.3.8)`
Section: title/header.

Before:
```text
TADOI QA Guide (v0.3.8)
```

After:
```text
TADOI™ QA Guide (v0.3.8)
```

### 4) Page: `TADOI User Guide (Current Functionality + Spec Review)`
Section: title/header.

Before:
```text
TADOI User Guide (Current Functionality + Spec Review)
```

After:
```text
TADOI™ User Guide (Current Functionality + Spec Review)
```

### 5) Page: `TADOI App Overview + Feature Catalog`
Section: title/header.

Before:
```text
TADOI App Overview + Feature Catalog
```

After:
```text
TADOI™ App Overview + Feature Catalog
```

### Notion body-copy rule to apply on all pages
- First/most prominent mention: `TADOI™`
- Subsequent mentions: `TADOI`
- Do not use the registered symbol
- Do not apply ™ to the tagline text `Terminal Accessible Digital Organization Interface`

## Suggested PR Description Snippet
```text
chore(docs): apply TADOI™ first-mention rule + trademark notices
chore(branding): replace legacy-name references where appropriate

Audit summary:
- Updated first-heading brand placement to TADOI™ across user-facing markdown docs.
- Added trademark notice to README and docs/README.md.
- Added docs/ops/branding.md with Manual GitHub Steps and Notion Update Pack.
- Verified legacy-name references = 0 matches and registered-symbol usage = 0 matches.
```
