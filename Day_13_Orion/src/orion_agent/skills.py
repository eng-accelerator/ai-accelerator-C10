"""Skills: folders with a SKILL.md, loaded on demand.

The system prompt gets one line per skill (name and description). The model
calls `read_skill(name)` when a description matches the task, and the full
body arrives as a tool message. That is progressive disclosure, the same
mechanism Cursor and Claude Code use.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from langchain_core.tools import BaseTool, tool

from orion_agent.rules import glob_matches, parse_frontmatter

SKILL_ROOTS = (".cursor/skills", ".claude/skills")


@dataclass
class Skill:
    """One SKILL.md: the line that goes in the prompt, and the file to load on demand."""

    name: str
    description: str
    paths: list[str]
    path: Path
    model_invocable: bool = True


def _as_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def load_skills(root: str | Path) -> list[Skill]:
    """Find every skill under the known skill roots of a repo."""
    root = Path(root).resolve()
    skills: list[Skill] = []
    for rel in SKILL_ROOTS:
        base = root / rel
        if not base.exists():
            continue
        for skill_file in sorted(base.rglob("SKILL.md")):
            meta, _ = parse_frontmatter(skill_file.read_text())
            skills.append(
                Skill(
                    name=str(meta.get("name") or skill_file.parent.name),
                    description=str(meta.get("description") or ""),
                    paths=_as_list(meta.get("paths")),
                    path=skill_file,
                    model_invocable=not bool(meta.get("disable-model-invocation", False)),
                )
            )
    return skills


def read_skill_body(skill: Skill) -> str:
    """Return a skill's instructions without its frontmatter."""
    _, body = parse_frontmatter(skill.path.read_text())
    return body


def skills_catalog(skills: list[Skill], for_path: str | None = None) -> str:
    """Render the one-line-per-skill catalog for the system prompt."""
    lines = []
    for s in skills:
        if not s.model_invocable:
            continue
        if for_path and s.paths and not any(glob_matches(g, for_path) for g in s.paths):
            continue
        lines.append(f"- {s.name}: {s.description}")
    if not lines:
        return ""
    return "Skills you can load with read_skill(name):\n" + "\n".join(lines)


def make_read_skill_tool(skills: list[Skill]) -> BaseTool:
    """Build the read_skill tool that loads one of these skills by name."""
    by_name = {s.name: s for s in skills}

    @tool
    def read_skill(name: str) -> str:
        """Load the full instructions of a skill by name. Call this when a skill in the catalog matches the task."""
        skill = by_name.get(name)
        if skill is None:
            return f"Error: unknown skill '{name}'. Available: {', '.join(sorted(by_name))}"
        return read_skill_body(skill)

    return read_skill
