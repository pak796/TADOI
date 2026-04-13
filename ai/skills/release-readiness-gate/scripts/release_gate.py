#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import asdict, dataclass
from typing import Optional
from pathlib import Path


@dataclass
class GateResult:
    check_id: str
    status: str
    evidence: str
    blocking: bool
    fix_hint: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run release readiness gate checks.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--mode", required=True, choices=["preflight", "rc"])
    parser.add_argument("--out-json", required=True)
    parser.add_argument("--out-md", required=True)
    return parser.parse_args()


def exists(path: Path) -> bool:
    return path.exists() and path.is_file()


def add_file_check(results: list[GateResult], check_id: str, path: Path, fix_hint: str, blocking: bool = True) -> None:
    if exists(path):
        results.append(GateResult(check_id, "pass", f"Found `{path}`", False, "No action."))
    else:
        results.append(GateResult(check_id, "fail", f"Missing `{path}`", blocking, fix_hint))


def parse_package_version(package_json: Path) -> Optional[str]:
    if not exists(package_json):
        return None
    text = package_json.read_text(encoding="utf-8", errors="ignore")
    match = re.search(r'"version"\s*:\s*"([^"]+)"', text)
    return match.group(1) if match else None


def has_package_script(package_json: Path, script_name: str) -> bool:
    text = package_json.read_text(encoding="utf-8", errors="ignore") if exists(package_json) else ""
    return re.search(rf'"{re.escape(script_name)}"\s*:', text) is not None


def to_markdown(results: list[GateResult], mode: str, version: str) -> str:
    blocking_failures = [r for r in results if r.status == "fail" and r.blocking]
    overall = "PASS" if not blocking_failures else "FAIL"

    lines = [
        f"# Release Gate Report ({mode})",
        "",
        f"- Target version: `{version}`",
        f"- Overall: **{overall}**",
        f"- Blocking failures: {len(blocking_failures)}",
        "",
        "| Check | Status | Blocking | Evidence | Fix Hint |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r.check_id} | {r.status} | {str(r.blocking).lower()} | {r.evidence} | {r.fix_hint} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    repo = Path(args.repo_root).resolve()

    results: list[GateResult] = []

    add_file_check(
        results,
        "GATE-001",
        repo / "README.md",
        "Create README.md with release onboarding instructions.",
    )
    add_file_check(
        results,
        "GATE-002",
        repo / ".github/workflows/ci.yml",
        "Add CI workflow at .github/workflows/ci.yml.",
    )
    add_file_check(
        results,
        "GATE-003",
        repo / ".github/workflows/release.yml",
        "Add release workflow at .github/workflows/release.yml.",
    )

    packaging_paths = [
        repo / "packaging/macos/build-dmg.sh",
        repo / "packaging/windows/build-installer.ps1",
        repo / "packaging/linux/build-appimage.sh",
    ]
    missing_packaging = [str(p) for p in packaging_paths if not exists(p)]
    if missing_packaging:
        results.append(
            GateResult(
                "GATE-004",
                "fail",
                "Missing packaging scripts: " + ", ".join(missing_packaging),
                True,
                "Add missing packaging scripts or explicitly document unsupported targets.",
            )
        )
    else:
        results.append(GateResult("GATE-004", "pass", "Packaging scripts found for macOS/Windows/Linux.", False, "No action."))

    package_json = repo / "package.json"
    parsed_version = parse_package_version(package_json)
    if not parsed_version:
        results.append(
            GateResult(
                "GATE-005",
                "fail",
                "Unable to parse version from package.json.",
                True,
                "Set a valid semver string in package.json version field.",
            )
        )
    elif parsed_version != args.version:
        results.append(
            GateResult(
                "GATE-005",
                "warn",
                f"package.json version is {parsed_version}, target is {args.version}.",
                False,
                "Align target version with package.json or update package.json.",
            )
        )
    else:
        results.append(GateResult("GATE-005", "pass", f"package.json version matches target {args.version}.", False, "No action."))

    changelog = repo / "CHANGELOG.md"
    if exists(changelog):
        changelog_text = changelog.read_text(encoding="utf-8", errors="ignore")
        if args.version in changelog_text:
            results.append(GateResult("GATE-006", "pass", f"CHANGELOG references version {args.version}.", False, "No action."))
        else:
            results.append(
                GateResult(
                    "GATE-006",
                    "fail",
                    f"CHANGELOG does not reference version {args.version}.",
                    True,
                    "Add a changelog entry for target version before release.",
                )
            )
    else:
        results.append(GateResult("GATE-006", "fail", "Missing CHANGELOG.md.", True, "Create CHANGELOG.md and add target version section."))

    required_scripts = ["test", "typecheck"]
    missing_scripts = [s for s in required_scripts if not has_package_script(package_json, s)]
    if missing_scripts:
        results.append(
            GateResult(
                "GATE-007",
                "fail",
                "Missing package scripts: " + ", ".join(missing_scripts),
                True,
                "Add required package scripts to package.json.",
            )
        )
    else:
        results.append(GateResult("GATE-007", "pass", "Required package scripts are present.", False, "No action."))

    if args.mode == "rc":
        if exists(changelog):
            text = changelog.read_text(encoding="utf-8", errors="ignore")
            heading = re.search(rf"^##\s+.*{re.escape(args.version)}.*$", text, flags=re.MULTILINE)
            if heading:
                results.append(GateResult("GATE-101", "pass", f"Found changelog heading for {args.version}.", False, "No action."))
            else:
                results.append(
                    GateResult(
                        "GATE-101",
                        "fail",
                        f"No changelog heading found for {args.version}.",
                        True,
                        "Add a dedicated changelog heading for the target version.",
                    )
                )

        matrix = repo / "packaging/release-targets.json"
        if exists(matrix):
            results.append(GateResult("GATE-102", "pass", "Found packaging/release-targets.json.", False, "No action."))
        else:
            results.append(
                GateResult(
                    "GATE-102",
                    "warn",
                    "Missing packaging/release-targets.json.",
                    False,
                    "Add release target matrix for consistent packaging planning.",
                )
            )

    blocking_failures = [r for r in results if r.status == "fail" and r.blocking]
    payload = {
        "mode": args.mode,
        "version": args.version,
        "overall": "pass" if not blocking_failures else "fail",
        "blocking_failures": len(blocking_failures),
        "results": [asdict(r) for r in results],
    }

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(to_markdown(results, args.mode, args.version), encoding="utf-8")

    print(f"Overall: {payload['overall']}; blocking_failures={payload['blocking_failures']}")
    return 0 if payload["overall"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
