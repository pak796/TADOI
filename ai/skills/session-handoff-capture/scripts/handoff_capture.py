#!/usr/bin/env python3
import argparse
import datetime as dt
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a structured session handoff markdown document.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--out-md", required=True)
    parser.add_argument("--include-git-log", type=int, default=10)
    parser.add_argument("--include-status", action="store_true")
    return parser.parse_args()


def safe_run(cmd: list[str], cwd: Path) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def build_markdown(args: argparse.Namespace, repo: Path) -> str:
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()

    git_available = (repo / ".git").exists()
    status_text = ""
    log_text = ""
    warning = ""

    if git_available:
        if args.include_status:
            rc, out, err = safe_run(["git", "status", "--short"], repo)
            status_text = out if rc == 0 else f"Unable to read git status: {err}"
        rc, out, err = safe_run(["git", "log", "--oneline", f"-n{args.include_git_log}"], repo)
        log_text = out if rc == 0 else f"Unable to read git log: {err}"
    else:
        warning = "Repository has no .git directory; status/log sections are informational placeholders."

    changed_files = []
    if status_text:
        for line in status_text.splitlines():
            if not line.strip():
                continue
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                changed_files.append(parts[1])

    lines = [
        f"# Session Handoff: {args.title}",
        "",
        f"- Generated (UTC): `{timestamp}`",
        f"- Repository: `{repo}`",
        "",
        "## Summary",
        "",
        "- Purpose: capture current implementation state for seamless continuation.",
        f"- Changed files detected: {len(changed_files)}",
        "",
        "## Decisions Captured",
        "",
        "- Document key product/technical decisions here.",
        "- Include rationale and constraints for each decision.",
        "",
        "## Workspace State",
        "",
    ]

    if warning:
        lines.extend([f"- Warning: {warning}", ""])

    if args.include_status:
        lines.extend([
            "### Git Status",
            "",
            "```",
            status_text or "(no output)",
            "```",
            "",
        ])

    lines.extend([
        f"### Recent Commits (last {args.include_git_log})",
        "",
        "```",
        log_text or "(no output)",
        "```",
        "",
        "## Completed Work",
        "",
        "- List finished tasks and merged outcomes.",
        "",
        "## Remaining Work",
        "",
        "- List open tasks in execution order.",
        "",
        "## Risks and Blockers",
        "",
        "- [High|Medium|Low] <risk summary> -> owner -> next action",
        "",
        "## Next Commands",
        "",
        "```bash",
        "# Add reproducible follow-up commands here",
        "git status --short",
        "```",
        "",
    ])

    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    repo = Path(args.repo_root).resolve()
    out_md = Path(args.out_md)

    content = build_markdown(args, repo)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(content, encoding="utf-8")

    print(f"Wrote handoff to {out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
