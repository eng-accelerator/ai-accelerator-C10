from pathlib import Path

from orion_agent.rules import glob_matches, list_rules, load_rules, parse_frontmatter


def make_repo(tmp_path: Path) -> Path:
    (tmp_path / "AGENTS.md").write_text("# Repo rules\nUse uv.\n")
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "AGENTS.md").write_text("# Test rules\nNo network in tests.\n")
    rules = tmp_path / ".cursor" / "rules"
    rules.mkdir(parents=True)
    (rules / "python.mdc").write_text(
        "---\ndescription: Python style\nglobs: **/*.py\nalwaysApply: false\n---\nType hints everywhere.\n"
    )
    (rules / "always.mdc").write_text(
        "---\ndescription: Always on\nglobs:\nalwaysApply: true\n---\nBe brief.\n"
    )
    (rules / "design.mdc").write_text(
        "---\ndescription: UI\nglobs:\n  - \"**/*.tsx\"\n  - \"**/*.css\"\nalwaysApply: false\n---\nFollow the tokens.\n@DESIGN.md\n"
    )
    (tmp_path / "DESIGN.md").write_text("canvas: #0B0B0D\n")
    return tmp_path


def test_parse_frontmatter():
    meta, body = parse_frontmatter("---\ndescription: d\nglobs: a, b\n---\nbody\n")
    assert meta == {"description": "d", "globs": "a, b"}
    assert body == "body\n"
    assert parse_frontmatter("no front") == ({}, "no front")
    meta, _ = parse_frontmatter("---\nglobs: **/*.py\n---\nx")
    assert meta == {"globs": "**/*.py"}


def test_glob_matches_handles_double_star():
    assert glob_matches("**/*.py", "app.py")
    assert glob_matches("**/*.py", "tests/test_app.py")
    assert not glob_matches("**/*.py", "index.tsx")
    assert glob_matches("tests/**/*.py", "tests/unit/test_x.py")


def test_list_rules_parses_globs_in_both_forms(tmp_path):
    root = make_repo(tmp_path)
    by_name = {r.name: r for r in list_rules(root)}
    assert by_name["python"].globs == ["**/*.py"]
    assert by_name["design"].globs == ["**/*.tsx", "**/*.css"]
    assert by_name["always"].always_apply is True
    assert by_name["always"].globs == []


def test_load_rules_layers_in_order(tmp_path):
    root = make_repo(tmp_path)
    text = load_rules(root, "tests/test_x.py")
    order = [text.index(s) for s in ("# From AGENTS.md", "# From tests/AGENTS.md", "# From .cursor/rules/always.mdc", "# From .cursor/rules/python.mdc")]
    assert order == sorted(order)
    assert "No network in tests." in text
    assert "Follow the tokens." not in text


def test_load_rules_without_path_gives_always_on_only(tmp_path):
    root = make_repo(tmp_path)
    text = load_rules(root)
    assert "Use uv." in text and "Be brief." in text
    assert "Type hints everywhere." not in text


def test_load_rules_inlines_file_references_once(tmp_path):
    root = make_repo(tmp_path)
    text = load_rules(root, "src/App.tsx")
    assert text.count("canvas: #0B0B0D") == 1
    assert "@DESIGN.md" not in text
