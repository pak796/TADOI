#!/usr/bin/env python3
import argparse
import glob
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class Finding:
    id: str
    severity: str
    doc_path: str
    evidence_paths: list[str]
    claim: str
    status: str
    requires_code_change: bool
    recommendation: str


PATH_TOKEN_RE = re.compile(r"[A-Za-z0-9_./-]+\.[a-zA-Z0-9]+")
DOT_TOKEN_RE = re.compile(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+")
SHIFT_TAB_CODE_PATTERNS = (
    re.compile(
        r"(?:shift[^\n]{0,80}(?:name|sequence|lowerName|lowerSequence)\s*===\s*['\"]tab['\"])",
        flags=re.IGNORECASE,
    ),
    re.compile(
        r"(?:(?:name|sequence|lowerName|lowerSequence)\s*===\s*['\"]tab['\"][^\n]{0,80}shift)",
        flags=re.IGNORECASE,
    ),
)
RANGE_1_TO_6_PATTERNS = (
    re.compile(r"\b1\s*\|\s*2\s*\|\s*3\s*\|\s*4\s*\|\s*5\s*\|\s*6\b"),
    re.compile(r"dueDayOffset\s*<\s*1", flags=re.IGNORECASE),
    re.compile(r"dueDayOffset\s*>\s*6", flags=re.IGNORECASE),
    re.compile(r"\b\+?1\.\.\+?6\b"),
)
KNOWN_FILE_EXTENSIONS = {
    "md",
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "json",
    "toml",
    "yaml",
    "yml",
    "txt",
    "adoc",
    "rst",
    "sh",
    "py",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scan docs for drift against code/config/tests.")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--doc-glob", action="append", required=True)
    parser.add_argument("--code-glob", action="append", required=True)
    parser.add_argument("--out-json", required=True)
    parser.add_argument("--out-md", required=True)
    return parser.parse_args()


def resolve_globs(repo_root: Path, patterns: Iterable[str]) -> list[Path]:
    out: list[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        hits = glob.glob(str(repo_root / pattern), recursive=True)
        for hit in hits:
            path = Path(hit)
            if path.is_file() and path not in seen:
                seen.add(path)
                out.append(path)
    return sorted(out)


def normalize_token(token: str) -> str:
    normalized = token.strip().strip("`'").lower()
    normalized = normalized.replace("escape", "esc").replace("return", "enter")
    normalized = re.sub(r"\s+", "", normalized)
    if normalized == "+1..+6":
        return "1..6"
    return normalized


def claim_severity(claim: str) -> str:
    low = claim.lower()
    if "--" in claim or "install" in low or "release" in low:
        return "high"
    if any(k in low for k in ("ctrl+", "cmd+", "esc", "enter", "shortcut", "key")):
        return "medium"
    return "low"


def extract_claims(doc_text: str) -> list[str]:
    claims: list[str] = []
    # CLI flags in prose or code blocks.
    claims.extend(re.findall(r"(--[a-zA-Z0-9][a-zA-Z0-9-]*)", doc_text))
    # Keybind mentions.
    claims.extend(re.findall(r"(?:Ctrl|Cmd|Alt|Shift)\+[A-Za-z0-9]+", doc_text))
    claims.extend(re.findall(r"\b(?:Esc|Enter|Return|Space|Tab)\b", doc_text))
    # Path claims.
    claims.extend(re.findall(r"`([A-Za-z0-9_./-]+\.[a-zA-Z0-9]+)`", doc_text))
    # Deduplicate while preserving order.
    seen: set[str] = set()
    ordered: list[str] = []
    for claim in claims:
        norm = normalize_token(claim)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        ordered.append(claim)
    return ordered


def to_repo_rel(path: Path, repo_root: Path) -> str:
    return str(path.resolve().relative_to(repo_root))


def resolve_file_claim_candidates(claim: str, doc_path: Path, repo_root: Path) -> list[str]:
    raw = claim.strip().strip("`'")
    parts = re.split(r"\s*,\s*|\s+\|\s+|\s+or\s+", raw)
    candidates: list[str] = []
    for part in parts:
        for token in PATH_TOKEN_RE.findall(part):
            if token not in candidates:
                candidates.append(token)
    if not candidates and PATH_TOKEN_RE.fullmatch(raw):
        candidates.append(raw)

    resolved: list[str] = []
    seen: set[str] = set()
    doc_dir = doc_path.parent
    for candidate in candidates:
        rel_candidate = candidate.strip()
        candidate_path = Path(rel_candidate)
        roots = [doc_dir, repo_root] if not candidate_path.is_absolute() else [Path("/")]
        for root in roots:
            absolute = (root / candidate_path).resolve() if root != Path("/") else candidate_path
            if not absolute.is_file():
                continue
            try:
                rel = to_repo_rel(absolute, repo_root)
            except ValueError:
                continue
            if rel not in seen:
                seen.add(rel)
                resolved.append(rel)
            break
    return sorted(resolved)


def is_file_path_claim(claim: str) -> bool:
    raw = claim.strip().strip("`'")
    if "/" in raw:
        return True
    suffix = raw.rsplit(".", 1)[-1].lower() if "." in raw else ""
    return suffix in KNOWN_FILE_EXTENSIONS


def dotted_token_suffix_matches(
    claim_key: str, evidence: dict[str, set[str]]
) -> list[str]:
    paths: set[str] = set()
    for token, token_paths in evidence.items():
        if token == claim_key:
            paths.update(token_paths)
            continue
        if token.endswith(f".{claim_key}") or claim_key.endswith(f".{token}"):
            paths.update(token_paths)
    return sorted(paths)


def semantic_segment_matches(
    claim_key: str, text_by_path: dict[str, str]
) -> list[str]:
    segments = [segment for segment in claim_key.split(".") if segment]
    if len(segments) < 2:
        return []
    escaped = [re.escape(segment) for segment in segments]
    pattern = re.compile(r"\b" + r"\b.{0,120}\b".join(escaped) + r"\b", flags=re.IGNORECASE | re.DOTALL)
    reverse_pattern = re.compile(
        r"\b" + r"\b.{0,120}\b".join(reversed(escaped)) + r"\b",
        flags=re.IGNORECASE | re.DOTALL,
    )
    matches: list[str] = []
    for rel_path, text in text_by_path.items():
        if pattern.search(text) or reverse_pattern.search(text):
            matches.append(rel_path)
    return sorted(matches)


def build_evidence_index(
    files: list[Path], repo_root: Path
) -> tuple[dict[str, set[str]], dict[str, str]]:
    index: dict[str, set[str]] = {}
    text_by_path: dict[str, str] = {}

    def add(token: str, rel: str) -> None:
        key = normalize_token(token)
        if not key:
            return
        index.setdefault(key, set()).add(rel)

    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = str(path.relative_to(repo_root))
        text_by_path[rel] = text

        # Direct path evidence (MED-01/LOW-01/LOW-04/LOW-02).
        add(rel, rel)
        add(path.name, rel)

        tokens: set[str] = set()
        tokens.update(re.findall(r"--[a-zA-Z0-9][a-zA-Z0-9-]*", text))
        tokens.update(re.findall(r"(?:Ctrl|Cmd|Alt|Shift)\+[A-Za-z0-9]+", text, flags=re.IGNORECASE))
        tokens.update(re.findall(r"\b(?:escape|esc|enter|return|space|tab)\b", text, flags=re.IGNORECASE))
        tokens.update(PATH_TOKEN_RE.findall(text))
        tokens.update(DOT_TOKEN_RE.findall(text))
        # Comma-delimited / inline path list extraction (MED-03).
        for line in text.splitlines():
            if "," not in line:
                continue
            tokens.update(PATH_TOKEN_RE.findall(line))

        if any(pattern.search(text) for pattern in SHIFT_TAB_CODE_PATTERNS):
            tokens.add("Shift+Tab")
        if sum(bool(pattern.search(text)) for pattern in RANGE_1_TO_6_PATTERNS) >= 1:
            tokens.add("1..6")
            tokens.add("+1..+6")

        for token in tokens:
            add(token, rel)

    return index, text_by_path


def to_markdown(findings: list[Finding]) -> str:
    by_status: dict[str, int] = {"verified": 0, "unverified": 0, "missing_evidence": 0}
    for finding in findings:
        by_status[finding.status] = by_status.get(finding.status, 0) + 1

    lines = [
        "# Documentation Drift Findings",
        "",
        f"- Total findings: {len(findings)}",
        f"- Verified: {by_status.get('verified', 0)}",
        f"- Unverified: {by_status.get('unverified', 0)}",
        f"- Missing evidence: {by_status.get('missing_evidence', 0)}",
        "",
        "| ID | Severity | Doc | Claim | Status | Requires Code Change | Evidence | Recommendation |",
        "|---|---|---|---|---|---|---|---|",
    ]

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    ordered = sorted(findings, key=lambda f: (severity_rank.get(f.severity, 3), f.id))
    for finding in ordered:
        evidence = ", ".join(finding.evidence_paths) if finding.evidence_paths else "-"
        claim = finding.claim.replace("|", "\\|")
        recommendation = finding.recommendation.replace("|", "\\|")
        lines.append(
            f"| {finding.id} | {finding.severity} | `{finding.doc_path}` | `{claim}` | {finding.status} | {str(finding.requires_code_change).lower()} | {evidence} | {recommendation} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()

    doc_files = resolve_globs(repo_root, args.doc_glob)
    code_files = resolve_globs(repo_root, args.code_glob)
    scanned_files = sorted({path.resolve() for path in [*doc_files, *code_files]})
    scanned_rel_paths = {str(path.relative_to(repo_root)) for path in scanned_files}

    if not doc_files:
        raise SystemExit("No documentation files matched --doc-glob patterns.")
    if not code_files:
        raise SystemExit("No code/config files matched --code-glob patterns.")

    evidence, text_by_path = build_evidence_index(code_files, repo_root)

    findings: list[Finding] = []
    counter = 1

    for doc in doc_files:
        rel_doc = str(doc.relative_to(repo_root))
        text = doc.read_text(encoding="utf-8", errors="ignore")
        claims = extract_claims(text)
        for claim in claims:
            key = normalize_token(claim)
            paths: list[str] = []

            if is_file_path_claim(claim):
                raw_claim = claim.strip().strip("`'")
                candidate_paths = resolve_file_claim_candidates(claim, doc, repo_root)
                paths = sorted(path for path in candidate_paths if path in scanned_rel_paths)
                # Keep filename-only legacy claims (for example: settings.json) verifiable by
                # token evidence when no concrete path exists in scanned files.
                if not paths and "/" not in raw_claim and not raw_claim.startswith("."):
                    paths = sorted(evidence.get(key, set()))
            else:
                paths = sorted(evidence.get(key, set()))

            # LOW-05 semantic dotted token evidence fallback.
            if not paths and "." in key and not is_file_path_claim(claim):
                paths = dotted_token_suffix_matches(key, evidence)
                if not paths:
                    paths = semantic_segment_matches(key, text_by_path)

            if paths:
                status = "verified"
                recommendation = "No action."
                requires_code_change = False
            else:
                status = "missing_evidence"
                recommendation = "Verify manually, then update docs or implementation."
                requires_code_change = False

            findings.append(
                Finding(
                    id=f"DRIFT-{counter:03d}",
                    severity=claim_severity(claim),
                    doc_path=rel_doc,
                    evidence_paths=paths,
                    claim=claim,
                    status=status,
                    requires_code_change=requires_code_change,
                    recommendation=recommendation,
                )
            )
            counter += 1

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)

    out_json.write_text(json.dumps([asdict(finding) for finding in findings], indent=2) + "\n", encoding="utf-8")
    out_md.write_text(to_markdown(findings), encoding="utf-8")

    print(f"Wrote {len(findings)} findings to {out_json} and {out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
