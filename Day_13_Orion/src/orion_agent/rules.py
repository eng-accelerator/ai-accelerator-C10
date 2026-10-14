"""Layered rules, the way Cursor and Claude Code load them.

Order: every AGENTS.md from the repo root down to the target file's folder
(closest last, so it wins), then .cursor/rules/*.mdc with alwaysApply: true,
then .mdc rules whose globs match the target path. Lines of the form
`@some/file.md` inside a rule are replaced by that file's contents, once.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from fnmatch import fnmatchcase
from pathlib import Path

import yaml

_REF = re.compile(r"^@([\w./-]+)\s*$", re.MULTILINE)
# Cursor writes `globs: **/*.py` unquoted; strict YAML reads a leading `*` as an alias. Quote it first.
_UNQUOTED_GLOB = re.compile(r'^(\s*(?:[\w-]+:|-)\s*)(\*[^"\n]*)$', re.MULTILINE)


@dataclass
class Rule:
    """One rule file: its frontmatter, its body, and where it came from."""

    name: str
    description: str
    globs: list[str]
    always_apply: bool
    body: str
    source: str
    kind: str = field(default="mdc")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split a `---` frontmatter block from the body, returning both."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    raw = _UNQUOTED_GLOB.sub(lambda m: f'{m.group(1)}"{m.group(2).strip()}"', text[3:end])
    meta = yaml.safe_load(raw) or {}
    body = text[end + 4 :]
    return meta, body.lstrip("\n")


def _as_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def glob_matches(pattern: str, path: str) -> bool:
    """True if a rule glob matches a path, treating `**/x` as also matching a bare `x`."""
    if fnmatchcase(path, pattern):
        return True
    return pattern.startswith("**/") and fnmatchcase(path, pattern[3:])


def list_rules(root: str | Path) -> list[Rule]:
    """Read every .cursor/rules/*.mdc file under a repo root."""
    root = Path(root).resolve()
    rules: list[Rule] = []
    for mdc in sorted((root / ".cursor" / "rules").glob("*.mdc")):
        meta, body = parse_frontmatter(mdc.read_text())
        rules.append(
            Rule(
                name=mdc.stem,
                description=str(meta.get("description") or ""),
                globs=_as_list(meta.get("globs")),
                always_apply=bool(meta.get("alwaysApply", False)),
                body=body,
                source=mdc.relative_to(root).as_posix(),
            )
        )
    return rules


def _agents_files(root: Path, for_path: str | None) -> list[Path]:
    dirs = [root]
    if for_path:
        rel = Path(for_path)
        for parent in reversed(rel.parents):
            if parent.as_posix() != ".":
                dirs.append(root / parent)
    return [d / "AGENTS.md" for d in dirs if (d / "AGENTS.md").exists()]


def _inline_refs(root: Path, body: str, seen: set[str]) -> str:
    def replace(match: re.Match) -> str:
        ref = match.group(1)
        target = root / ref
        if ref in seen or not target.exists():
            return ""
        seen.add(ref)
        return target.read_text().rstrip() + "\n"

    return _REF.sub(replace, body)


def load_rules(root: str | Path, for_path: str | None = None) -> str:
    """Render every rule that applies to a target path, closest and most specific last."""
    root = Path(root).resolve()
    sections: list[tuple[str, str]] = []
    for agents in _agents_files(root, for_path):
        sections.append((agents.relative_to(root).as_posix(), agents.read_text()))
    rules = list_rules(root)
    sections += [(r.source, r.body) for r in rules if r.always_apply]
    if for_path:
        sections += [
            (r.source, r.body)
            for r in rules
            if not r.always_apply and any(glob_matches(g, for_path) for g in r.globs)
        ]
    seen: set[str] = set()
    rendered = [f"# From {src}\n{_inline_refs(root, body, seen).strip()}" for src, body in sections]
    return "\n\n".join(rendered)
