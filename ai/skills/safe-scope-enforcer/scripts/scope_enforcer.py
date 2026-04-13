#!/usr/bin/env python3
import argparse
import fnmatch
import json
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class Violation:
    file: str
    rule: str
    reason: str


PROFILE_ALLOW = {
    "docs-only": [
        "README.md",
        "docs/**",
        "**/*.md",
        "**/*.txt",
        "**/*.adoc",
        "**/*.rst",
        ".github/**",
    ],
    "tests-only": ["tests/**", "**/*test*.ts", "**/*test*.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    "code-only": ["src/**", "scripts/**", "package.json", "tsconfig*.json"],
    "custom": [],
}

PROFILE_DENY = {
    "docs-only": ["src/**", "app/**", "packages/**"],
    "tests-only": [],
    "code-only": [],
    "custom": [],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enforce allowed file scope on changed files.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--scope-profile", required=True, choices=["docs-only", "tests-only", "code-only", "custom"])
    parser.add_argument("--allow-glob", action="append", default=[])
    parser.add_argument("--deny-glob", action="append", default=[])
    parser.add_argument("--staged-only", action="store_true")
    parser.add_argument("--out-json")
    return parser.parse_args()


def run(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"Command failed: {' '.join(cmd)}")
    return result.stdout


def get_changed_files(repo: Path, staged_only: bool) -> list[str]:
    if staged_only:
        staged = run(["git", "diff", "--name-only", "--cached"], repo).splitlines()
        return sorted({f.strip() for f in staged if f.strip()})

    changed = run(["git", "diff", "--name-only"], repo).splitlines()
    untracked = run(["git", "ls-files", "--others", "--exclude-standard"], repo).splitlines()
    files = {f.strip() for f in changed + untracked if f.strip()}
    return sorted(files)


def matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def main() -> int:
    args = parse_args()
    repo = Path(args.repo_root).resolve()

    if not (repo / ".git").exists():
        print("Not a git repository: missing .git directory")
        return 1

    allow = list(PROFILE_ALLOW[args.scope_profile])
    deny = list(PROFILE_DENY[args.scope_profile])

    if args.scope_profile == "custom":
        if not args.allow_glob:
            print("custom profile requires at least one --allow-glob")
            return 1
        allow = list(args.allow_glob)

    allow.extend(args.allow_glob)
    deny.extend(args.deny_glob)

    changed_files = get_changed_files(repo, args.staged_only)
    if not changed_files:
        print("No changed files detected. Scope check passed.")
        if args.out_json:
            payload = {"profile": args.scope_profile, "changed_files": [], "violations": []}
            Path(args.out_json).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return 0

    violations: list[Violation] = []
    for file in changed_files:
        if matches_any(file, deny):
            violations.append(Violation(file=file, rule="deny", reason="Matched deny pattern"))
            continue
        if not matches_any(file, allow):
            violations.append(Violation(file=file, rule="allow", reason="Did not match any allow pattern"))

    payload = {
        "profile": args.scope_profile,
        "changed_files": changed_files,
        "allow": allow,
        "deny": deny,
        "violations": [asdict(v) for v in violations],
    }

    if args.out_json:
        out = Path(args.out_json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    if violations:
        print(f"Scope check failed with {len(violations)} violation(s):")
        for v in violations:
            print(f"- {v.file}: {v.reason} ({v.rule})")
        return 2

    print(f"Scope check passed for {len(changed_files)} changed file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
