import ast
import re
from pathlib import Path

import pytest

LESSONS = Path(__file__).resolve().parents[1] / "lessons"
TAG = re.compile(r"^# %% (setup|[CN]\d+)\b(.*)$")

REQUIRED = {
    "01_hands/ch01_llm_setup.py": ["C1", "C2"],
    "01_hands/ch02_tools.py": ["C3"],
    "01_hands/ch03_agent_graph.py": ["C4", "C5", "C6", "C7", "C8", "N1"],
    "01_hands/ch04_code_generation.py": ["C9", "C10"],
    "01_hands/ch05_rules.py": ["N1", "C11", "C12"],
    "01_hands/ch06_streaming.py": ["C13", "N1"],
    "01_hands/ch07_multi_turn.py": ["C14", "C15", "N1", "C16", "C17", "C18"],
    "02_self_awareness/ch08_structured_output.py": ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
    "02_self_awareness/ch09_self_correction.py": ["C8", "C9", "C10", "N1", "N2", "C11", "C12", "C13", "C14", "C15", "C16"],
    "02_self_awareness/ch10_reflection.py": ["C17", "C18", "C19", "C20", "C21", "C22"],
    "02_self_awareness/ch11_rules_and_skills.py": ["C23", "N1", "N2"],
    "02_self_awareness/ch12_inline_edit.py": ["C24", "C25"],
    "03_brain/ch13_codebase_search.py": ["C1", "C2", "C3", "C4", "N1"],
    "03_brain/ch14_toolkit_and_planner.py": ["C5", "C6", "N1", "C7", "C8"],
    "03_brain/ch15_specialists.py": ["C9", "C10", "C11"],
    "03_brain/ch16_human_in_the_loop.py": ["C12", "C13", "C14", "C15", "C16", "C17", "C18", "N1"],
    "03_brain/ch17_parallel.py": ["C19", "C20", "C21", "C22"],
    "03_brain/ch18_time_travel.py": ["N0", "C23", "C24", "C25", "C26"],
}


def tags_of(path: Path) -> list[str]:
    return [m.group(1) for line in path.read_text().splitlines() if (m := TAG.match(line))]


@pytest.mark.parametrize("rel", sorted(REQUIRED))
def test_lesson_file_parses_and_has_its_cells(rel):
    path = LESSONS / rel
    assert path.exists(), f"missing lesson file {rel}"
    ast.parse(path.read_text(), filename=str(path))
    tags = tags_of(path)
    assert tags[0] == "setup"
    assert len(tags) == len(set(tags)), f"duplicate cell tags in {rel}: {tags}"
    missing = [t for t in REQUIRED[rel] if t not in tags]
    assert not missing, f"{rel} lacks cells {missing}"


def test_every_lesson_file_is_listed():
    on_disk = sorted(p.relative_to(LESSONS).as_posix() for p in LESSONS.glob("*/ch*.py"))
    assert on_disk == sorted(REQUIRED)


def test_no_top_level_await_and_no_notebook_words():
    for rel in REQUIRED:
        text = (LESSONS / rel).read_text()
        assert not re.search(r"^await ", text, re.M), f"{rel} uses top-level await; use run()"
        assert "Notebook" not in text and "colab" not in text.lower(), f"{rel} refers to notebooks"
