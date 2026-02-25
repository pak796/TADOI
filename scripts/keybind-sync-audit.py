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
        "home": "home",
        "end": "end",
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
        "home",
        "end",
    }
    if raw in punctuation_keys:
        return True
    if len(raw) == 1 and re.match(r"[a-z]", low):
        return True
    if len(raw) == 1 and re.match(r"[0-9]", low):
        return True
    if re.match(r"^(ctrl|cmd|alt|shift)\+[a-z0-9]$", low):
        return True
    if low in named_keys:
        return True
    return False


def should_keep_numeric_doc_token(part: str, raw: str, line_text: str) -> bool:
    if not re.fullmatch(r"\d", part):
        return True

    lower_line = line_text.lower()
    key_context_words = (
        "key",
        "keys",
        "hotkey",
        "shortcut",
        "press",
        "select",
        "menu",
        "option",
        "arrow",
        "enter",
        "esc",
    )
    has_key_context = any(word in lower_line for word in key_context_words)

    if re.search(r"\bv\d+(?:\.\d+)+\b", lower_line):
        return False
    if ("schema" in lower_line or "version" in lower_line) and not has_key_context:
        return False

    raw_lower = raw.lower()
    if "/" in raw or " or " in raw_lower or "|" in raw:
        return True

    return has_key_context


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

    key_vars = r"(?:name|sequence|lowerName|lowerSequence)"
    patterns = [
        rf"{key_vars}\s*===\s*\"([^\"]+)\"",
        rf"{key_vars}\s*:\s*\"([^\"]+)\"",
        rf"\b{key_vars}\s*:\s*'([^']+)'",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            token = normalize_key(match.group(1))
            line = text.count("\n", 0, match.start()) + 1
            evidence.setdefault(token, []).append(f"{path}:{line}")

    ctrl_patterns = [
        rf"ctrl\s*:\s*true[^\n\r\}}]*{key_vars}\s*:\s*\"([a-zA-Z0-9])\"",
        rf"ctrl\s*:\s*true[^\n\r\}}]*{key_vars}\s*:\s*'([a-zA-Z0-9])'",
        rf"(?<!\!)(?:key\.)?ctrl\s*&&\s*(?:key\.)?{key_vars}\s*===\s*\"([a-zA-Z0-9])\"",
        rf"(?<!\!)(?:key\.)?ctrl\s*&&\s*(?:key\.)?{key_vars}\s*===\s*'([a-zA-Z0-9])'",
        rf"(?:key\.)?{key_vars}\s*===\s*\"([a-zA-Z0-9])\"\s*&&\s*(?:key\.)?ctrl",
        rf"(?:key\.)?{key_vars}\s*===\s*'([a-zA-Z0-9])'\s*&&\s*(?:key\.)?ctrl",
    ]
    for pattern in ctrl_patterns:
        for match in re.finditer(pattern, text):
            token = f"Ctrl+{match.group(1).upper()}"
            line = text.count("\n", 0, match.start()) + 1
            evidence.setdefault(token, []).append(f"{path}:{line}")

    return evidence


def extract_action_bearing_test_bindings(path: Path) -> dict[str, list[str]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    evidence: dict[str, list[str]] = {}

    action_assert_pattern = re.compile(
        r"expect\(\s*run\((?P<input>\{.*?\})(?:\s*,\s*\{.*?\})?\s*\)\s*\)\s*\.toEqual\(\s*\[(?P<actions>.*?)\]\s*\)",
        re.DOTALL,
    )

    for match in action_assert_pattern.finditer(text):
        actions = match.group("actions")
        if "type" not in actions:
            continue
        input_object = match.group("input")
        line = text.count("\n", 0, match.start()) + 1

        for token_match in re.finditer(r"(?:name|sequence)\s*:\s*\"([^\"]+)\"", input_object):
            token = normalize_key(token_match.group(1))
            evidence.setdefault(token, []).append(f"{path}:{line}")
        for token_match in re.finditer(r"(?:name|sequence)\s*:\s*'([^']+)'", input_object):
            token = normalize_key(token_match.group(1))
            evidence.setdefault(token, []).append(f"{path}:{line}")

        if re.search(r"ctrl\s*:\s*true", input_object):
            for ctrl_match in re.finditer(r"name\s*:\s*[\"']([a-zA-Z0-9])[\"']", input_object):
                token = f"Ctrl+{ctrl_match.group(1).upper()}"
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
        line_start = text.rfind("\n", 0, start) + 1
        line_end = text.find("\n", start)
        if line_end == -1:
            line_end = len(text)
        line_text = text[line_start:line_end]
        token = raw.strip("` .")
        if token in {"/", "?", "[", "]", "{", "}"}:
            parts = [token]
        else:
            parts = re.split(r"(?:\s+or\s+|,\s*|\||\sand\s|/)", raw)
        for part in parts:
            part = part.strip("` .")
            if not part or not looks_like_key_token(part):
                continue
            if not should_keep_numeric_doc_token(part, raw, line_text):
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
    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_md_abs = out_md.resolve()

    if not router.exists():
        raise SystemExit(f"Router path not found: {router}")

    router_evidence = extract_code_bindings(router)
    code_evidence = {key: list(values) for key, values in router_evidence.items()}
    sibling_test = router.with_name(router.stem + ".test" + router.suffix)
    if sibling_test.exists():
        test_evidence = extract_action_bearing_test_bindings(sibling_test)
        for key, values in test_evidence.items():
            if key in code_evidence:
                code_evidence[key].extend(values)

    doc_files = [
        doc for doc in gather_docs(repo, args.docs_glob) if doc.resolve() != out_md_abs
    ]
    doc_evidence: dict[str, list[str]] = {}
    for doc in doc_files:
        extracted = extract_doc_bindings(doc)
        for key, values in extracted.items():
            doc_evidence.setdefault(key, []).extend(values)

    canonical_code_keys = set(router_evidence.keys())
    doc_keys = set(doc_evidence.keys())

    missing_in_docs = sorted(canonical_code_keys - doc_keys)
    missing_in_code = sorted((doc_keys - canonical_code_keys) - NOISE_DOC_ONLY_KEYS)

    semantic_mismatch: list[str] = []
    lowered = {k.lower() for k in canonical_code_keys}
    for docs_key in sorted(doc_keys):
        if docs_key.startswith("Ctrl+"):
            plain = docs_key.split("+", 1)[1].lower()
            if plain in lowered and docs_key not in canonical_code_keys:
                semantic_mismatch.append(f"Docs specify `{docs_key}` but code evidence only shows unmodified `{plain}`.")

    payload = {
        "canonical_keybinds": sorted(canonical_code_keys),
        "missing_in_docs": missing_in_docs,
        "missing_in_code": missing_in_code,
        "semantic_mismatch": semantic_mismatch,
        "evidence": {
            "code": {k: sorted(v) for k, v in sorted(code_evidence.items())},
            "docs": {k: sorted(v) for k, v in sorted(doc_evidence.items())},
        },
    }

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
