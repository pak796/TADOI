#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class PatchPlan:
    patch_id: str
    title: str
    goal: str
    likely_files: list[str]
    depends_on: list[str]
    tests: list[str]
    rollback: str
    acceptance_criteria: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate atomic implementation patch plans from a broad request.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--request-file", required=True)
    parser.add_argument("--max-patches", type=int, required=True)
    parser.add_argument("--out-md", required=True)
    parser.add_argument("--out-json", required=True)
    return parser.parse_args()


def extract_objectives(text: str) -> list[str]:
    objectives: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^(?:\d+\.|[-*])\s+", stripped):
            objectives.append(re.sub(r"^(?:\d+\.|[-*])\s+", "", stripped).strip())

    if objectives:
        return objectives

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return paragraphs


def infer_files(goal: str) -> list[str]:
    lower = goal.lower()
    files: list[str] = []
    if any(k in lower for k in ("doc", "readme", "guide", "changelog", "spec")):
        files.extend(["docs/**", "README.md", "CHANGELOG.md"])
    if any(k in lower for k in ("keybind", "keyboard", "shortcut")):
        files.extend(["src/app/keyRouter.ts", "src/app/keyRouter.test.ts", "docs/**"])
    if any(k in lower for k in ("release", "packaging", "installer")):
        files.extend(["packaging/**", ".github/workflows/release.yml", "scripts/build-binary.ts"])
    if any(k in lower for k in ("test", "qa", "verify")):
        files.extend(["**/*.test.ts", "docs/**"])
    if not files:
        files.extend(["src/**", "docs/**"])

    dedup: list[str] = []
    seen: set[str] = set()
    for item in files:
        if item not in seen:
            seen.add(item)
            dedup.append(item)
    return dedup


def infer_tests(goal: str) -> list[str]:
    lower = goal.lower()
    tests = ["Run relevant unit tests", "Run type checks", "Manual smoke-check core flow"]
    if "release" in lower:
        tests.append("Run release preflight script")
    if any(k in lower for k in ("doc", "readme", "guide")):
        tests.append("Validate all internal links")
    return tests


def to_markdown(request_excerpt: str, patches: list[PatchPlan]) -> str:
    lines = [
        "# Atomic Change Plan",
        "",
        "## Request Excerpt",
        "",
        "```",
        request_excerpt,
        "```",
        "",
        f"## Patch Breakdown ({len(patches)} patches)",
        "",
    ]

    for patch in patches:
        lines.extend([
            f"### {patch.patch_id}: {patch.title}",
            "",
            f"- Goal: {patch.goal}",
            f"- Depends on: {', '.join(patch.depends_on) if patch.depends_on else 'None'}",
            f"- Likely files: {', '.join(patch.likely_files)}",
            "- Tests:",
        ])
        for test in patch.tests:
            lines.append(f"  - {test}")
        lines.append(f"- Rollback: {patch.rollback}")
        lines.append("- Acceptance criteria:")
        for criterion in patch.acceptance_criteria:
            lines.append(f"  - {criterion}")
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    request_path = Path(args.request_file)
    if not request_path.exists():
        raise SystemExit(f"Request file not found: {request_path}")

    text = request_path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        raise SystemExit("Request file is empty.")

    objectives = extract_objectives(text)
    if not objectives:
        raise SystemExit("Could not derive objectives from request.")

    capped = objectives[: args.max_patches]
    patches: list[PatchPlan] = []
    for idx, goal in enumerate(capped, start=1):
        patch_id = f"AP-{idx:02d}"
        depends = [patches[-1].patch_id] if patches else []
        title = goal[:72]
        likely_files = infer_files(goal)
        tests = infer_tests(goal)
        acceptance = [
            "Expected behavior is implemented and observable.",
            "No unrelated files are modified.",
            "Validation commands complete without new failures.",
        ]
        patches.append(
            PatchPlan(
                patch_id=patch_id,
                title=title,
                goal=goal,
                likely_files=likely_files,
                depends_on=depends,
                tests=tests,
                rollback=f"Revert patch {patch_id} commit or undo associated file edits.",
                acceptance_criteria=acceptance,
            )
        )

    payload = {
        "repo_root": str(Path(args.repo_root).resolve()),
        "objective_count": len(objectives),
        "generated_patch_count": len(patches),
        "patches": [asdict(p) for p in patches],
    }

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)

    out_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(to_markdown(text[:1200], patches), encoding="utf-8")

    print(f"Generated {len(patches)} patch plans (from {len(objectives)} objectives)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
