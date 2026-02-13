#!/usr/bin/env python3
import argparse
import glob
import json
import re
from pathlib import Path

NOISE_DOC_ONLY_KEYS = {"0", "5"}

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit keybinding consistency between code and docs.")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--router-path", default="src/app/keyRouter.ts")
    parser.add_argument("--docs-glob", action="append")
    parser.add_argument("--out-json", default="docs/audit/KEYBIND_AUDIT.json")
    parser.add_argument("--out-md", default="docs/audit/KEYBIND_AUDIT.md")
    args = parser.parse_args()
    if not args.docs_glob:
        args.docs_glob = ["README.md", "docs/**/*.md"]
    return args


def normalize_key(raw: str) -> str:
    text = raw.strip().strip("`'").replace(" ", "")
    lower = text.lower()

    mapping = {
        "escape": "Esc",
        "esc": "Esc",
        "return": "Enter",
        "enter": "Enter",
        "space": "Space",
        "tab": "Tab",
        "backspace": "backspace",
        "up": "ArrowUp",
        "arrowup": "ArrowUp",
        "down": "ArrowDown",
        "arrowdown": "ArrowDown",
        "left": "ArrowLeft",
        "arrowleft": "ArrowLeft",
        "right": "ArrowRight",
        "arrowright": "ArrowRight",
        "page_up": "PageUp",
        "pageup": "PageUp",
        "prior": "PageUp",
        "page_down": "PageDown",
        "pagedown": "PageDown",
        "next": "PageDown",
    }
    if lower in mapping:
        return mapping[lower]

    combo_match = re.match(r"^(ctrl|cmd|alt|shift)\+([a-z0-9])$", lower)
    if combo_match:
        modifier = combo_match.group(1)
        key = combo_match.group(2).upper()
        # Treat Shift+<letter> docs aliases as the uppercase key token used by router code.
        if modifier == "shift" and key.isalpha():
            return key
        return f"{modifier.capitalize()}+{key}"

    if len(text) == 1:
        return text
    return text


def looks_like_key_token(token: str) -> bool:
    raw = token.strip().strip("`")
    if not raw:
        return False
    low = raw.lower()
    punctuation_keys = {"/", "?", "[", "]", "{", "}"}
    named_keys = {
        "esc",
        "escape",
        "enter",
        "return",
        "space",
        "tab",
        "backspace",
        "up",
        "down",
        "left",
        "right",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "page_up",
        "page_down",
        "pageup",
        "pagedown",
        "prior",
        "next",
    }
    if raw in punctuation_keys:
        return True
    if len(raw) == 1 and re.match(r"[a-z0-9]", low):
        return True
    if re.match(r"^(ctrl|cmd|alt|shift)\+[a-z0-9]$", low):
        return True
    if low in named_keys:
        return True
    return False


def gather_docs(repo_root: Path, patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        for hit in glob.glob(str(repo_root / pattern), recursive=True):
            path = Path(hit)
            if path.is_file() and path not in seen:
                seen.add(path)
                files.append(path)
    return sorted(files)


def extract_code_bindings(path: Path) -> dict[str, list[str]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    evidence: dict[str, list[str]] = {}

    patterns = [
        r"(?:name|sequence)\s*===\s*\"([^\"]+)\"",
        r"(?:name|sequence)\s*:\s*\"([^\"]+)\"",
        r"\b(?:name|sequence)\s*:\s*'([^']+)'",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            token = normalize_key(match.group(1))
            line = text.count("\n", 0, match.start()) + 1
            evidence.setdefault(token, []).append(f"{path}:{line}")

    for match in re.finditer(r"ctrl\s*:\s*true[^\n\r\}]*name\s*:\s*\"([a-zA-Z0-9])\"", text):
        token = f"Ctrl+{match.group(1).upper()}"
        line = text.count("\n", 0, match.start()) + 1
        evidence.setdefault(token, []).append(f"{path}:{line}")

    return evidence


def extract_doc_bindings(path: Path) -> dict[str, list[str]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    evidence: dict[str, list[str]] = {}

    candidates: list[tuple[str, int]] = []

    # Capture inline backticked tokens only (skip fenced code blocks).
    for match in re.finditer(r"(?<!`)`([^`\n]+)`(?!`)", text):
        candidates.append((match.group(1), match.start()))

    # Also capture plain-text key mentions outside code spans.
    plain_pattern = r"\b(Ctrl\+[A-Za-z0-9]|Cmd\+[A-Za-z0-9]|Esc|Enter|Return|Space|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)\b"
    for match in re.finditer(plain_pattern, text):
        candidates.append((match.group(1), match.start()))

    for raw, start in candidates:
        token = raw.strip("` .")
        if token in {"/", "?", "[", "]", "{", "}"}:
            parts = [token]
        else:
            parts = re.split(r"(?:\s+or\s+|,\s*|\||\sand\s|/)", raw)
        for part in parts:
            part = part.strip("` .")
            if not part or not looks_like_key_token(part):
                continue
            token = normalize_key(part)
            line = text.count("\n", 0, start) + 1
            evidence.setdefault(token, []).append(f"{path}:{line}")

    return evidence


def to_markdown(payload: dict) -> str:
    lines = [
        "# Keybinding Consistency Audit",
        "",
        f"- Canonical keybind count: {len(payload['canonical_keybinds'])}",
        f"- Missing in docs: {len(payload['missing_in_docs'])}",
        f"- Missing in code: {len(payload['missing_in_code'])}",
        f"- Semantic mismatches: {len(payload['semantic_mismatch'])}",
        "",
        "## Canonical Keybinds",
        "",
        "| Key | Code Evidence |",
        "|---|---|",
    ]
    for token in payload["canonical_keybinds"]:
        ev = ", ".join(payload["evidence"]["code"].get(token, [])) or "-"
        lines.append(f"| `{token}` | {ev} |")

    lines.extend(["", "## Missing In Docs", ""])
    for token in payload["missing_in_docs"]:
        lines.append(f"- `{token}`")
    if not payload["missing_in_docs"]:
        lines.append("- None")

    lines.extend(["", "## Missing In Code", ""])
    for token in payload["missing_in_code"]:
        lines.append(f"- `{token}`")
    if not payload["missing_in_code"]:
        lines.append("- None")

    lines.extend(["", "## Semantic Mismatch", ""])
    for item in payload["semantic_mismatch"]:
        lines.append(f"- {item}")
    if not payload["semantic_mismatch"]:
        lines.append("- None")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    repo = Path(args.repo_root).resolve()
    router = (repo / args.router_path).resolve()

    if not router.exists():
        raise SystemExit(f"Router path not found: {router}")

    code_evidence = extract_code_bindings(router)
    sibling_test = router.with_name(router.stem + ".test" + router.suffix)
    if sibling_test.exists():
        test_evidence = extract_code_bindings(sibling_test)
        for key, values in test_evidence.items():
            code_evidence.setdefault(key, []).extend(values)

    doc_files = gather_docs(repo, args.docs_glob)
    doc_evidence: dict[str, list[str]] = {}
    for doc in doc_files:
        extracted = extract_doc_bindings(doc)
        for key, values in extracted.items():
            doc_evidence.setdefault(key, []).extend(values)

    code_keys = set(code_evidence.keys())
    doc_keys = set(doc_evidence.keys())

    missing_in_docs = sorted(code_keys - doc_keys)
    missing_in_code = sorted((doc_keys - code_keys) - NOISE_DOC_ONLY_KEYS)

    semantic_mismatch: list[str] = []
    lowered = {k.lower() for k in code_keys}
    for docs_key in sorted(doc_keys):
        if docs_key.startswith("Ctrl+"):
            plain = docs_key.split("+", 1)[1].lower()
            if plain in lowered and docs_key not in code_keys:
                semantic_mismatch.append(f"Docs specify `{docs_key}` but code evidence only shows unmodified `{plain}`.")

    payload = {
        "canonical_keybinds": sorted(code_keys),
        "missing_in_docs": missing_in_docs,
        "missing_in_code": missing_in_code,
        "semantic_mismatch": semantic_mismatch,
        "evidence": {
            "code": {k: sorted(v) for k, v in sorted(code_evidence.items())},
            "docs": {k: sorted(v) for k, v in sorted(doc_evidence.items())},
        },
    }

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    out_md.write_text(to_markdown(payload), encoding="utf-8")

    print(
        f"canonical={len(payload['canonical_keybinds'])} missing_in_docs={len(missing_in_docs)} missing_in_code={len(missing_in_code)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
