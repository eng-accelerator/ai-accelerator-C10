from pathlib import Path

from orion_agent.skills import load_skills, make_read_skill_tool, read_skill_body, skills_catalog


def make_repo(tmp_path: Path) -> Path:
    def write(base: str, name: str, front: str, body: str) -> None:
        d = tmp_path / base / name
        d.mkdir(parents=True)
        (d / "SKILL.md").write_text(f"---\n{front}---\n{body}")

    write(".cursor/skills", "web-research", "name: web-research\ndescription: Search then fetch.\n", "# Web research\n1. Search.\n2. Fetch winners.\n")
    write(".cursor/skills", "frontend-design", "name: frontend-design\ndescription: UI checklist.\npaths:\n  - \"**/*.tsx\"\n", "# UI\nRead DESIGN.md.\n")
    write(".cursor/skills", "commit-deploy", "name: commit-deploy\ndescription: Ship it.\ndisable-model-invocation: true\n", "# Ship\nrun tests, commit, deploy\n")
    write(".claude/skills", "add-feature", "name: add-feature\ndescription: Plan, code, test, review.\n", "# Add feature\nplan first\n")
    return tmp_path


def test_load_skills_finds_both_roots(tmp_path):
    names = sorted(s.name for s in load_skills(make_repo(tmp_path)))
    assert names == ["add-feature", "commit-deploy", "frontend-design", "web-research"]


def test_catalog_excludes_disabled_and_filters_by_path(tmp_path):
    skills = load_skills(make_repo(tmp_path))
    everywhere = skills_catalog(skills)
    assert "web-research: Search then fetch." in everywhere
    assert "commit-deploy" not in everywhere
    assert "frontend-design" in everywhere  # no path given: path-scoped skills are listed
    assert "frontend-design" not in skills_catalog(skills, for_path="app.py")
    assert "frontend-design" in skills_catalog(skills, for_path="src/App.tsx")


def test_read_skill_tool_returns_body_or_error(tmp_path):
    skills = load_skills(make_repo(tmp_path))
    read_skill = make_read_skill_tool(skills)
    assert read_skill.name == "read_skill"
    assert read_skill.invoke({"name": "web-research"}) == "# Web research\n1. Search.\n2. Fetch winners.\n"
    assert read_skill.invoke({"name": "nope"}).startswith("Error: unknown skill 'nope'")


def test_read_skill_body_strips_frontmatter(tmp_path):
    skill = next(s for s in load_skills(make_repo(tmp_path)) if s.name == "add-feature")
    assert read_skill_body(skill) == "# Add feature\nplan first\n"
