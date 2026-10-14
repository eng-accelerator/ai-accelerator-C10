"""Copy each lesson's `web`-tagged cells into its chapter's backendCode on the site."""

from __future__ import annotations

import re
import sys
from pathlib import Path

TAG = re.compile(r"^# %% (\S+)(.*)$")
BEGIN = "/* lesson:begin */"
END = "/* lesson:end */"

CHAPTER_MAP: dict[str, str] = {
    "ch01.ts": "lessons/01_hands/ch01_llm_setup.py",
    "ch02.ts": "lessons/01_hands/ch02_tools.py",
    "ch03.ts": "lessons/01_hands/ch03_agent_graph.py",
    "ch04.ts": "lessons/01_hands/ch04_code_generation.py",
    "ch05.ts": "lessons/01_hands/ch05_rules.py",
    "ch06.ts": "lessons/01_hands/ch06_streaming.py",
    "ch07.ts": "lessons/01_hands/ch07_multi_turn.py",
    "ch08.ts": "lessons/02_self_awareness/ch08_structured_output.py",
    "ch09.ts": "lessons/02_self_awareness/ch09_self_correction.py",
    "ch10.ts": "lessons/02_self_awareness/ch10_reflection.py",
    "ch11.ts": "lessons/02_self_awareness/ch11_rules_and_skills.py",
    "ch12.ts": "lessons/02_self_awareness/ch12_inline_edit.py",
    "ch13.ts": "lessons/03_brain/ch13_codebase_search.py",
    "ch14.ts": "lessons/03_brain/ch14_toolkit_and_planner.py",
    "ch15.ts": "lessons/03_brain/ch15_specialists.py",
    "ch16.ts": "lessons/03_brain/ch16_human_in_the_loop.py",
    "ch17.ts": "lessons/03_brain/ch17_parallel.py",
    "ch18.ts": "lessons/03_brain/ch18_time_travel.py",
}


def web_cells(lesson_path: Path) -> str:
    """Return the code of every cell whose tag line ends with `web`, joined by blank lines."""
    blocks: list[str] = []
    current: list[str] | None = None
    for line in lesson_path.read_text().splitlines():
        match = TAG.match(line)
        if match:
            if current is not None:
                blocks.append("\n".join(current).strip("\n"))
            current = [] if match.group(2).split() and match.group(2).split()[-1] == "web" else None
            continue
        if current is not None:
            current.append(line)
    if current is not None:
        blocks.append("\n".join(current).strip("\n"))
    return "\n\n".join(b for b in blocks if b)


def _escape(code: str) -> str:
    return code.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def sync(repo_root: Path, chapter_map: dict[str, str] = CHAPTER_MAP) -> list[str]:
    changed: list[str] = []
    for chapter, lesson in chapter_map.items():
        ts_path = repo_root / "web" / "lib" / "chapters" / chapter
        text = ts_path.read_text()
        if BEGIN not in text or END not in text:
            raise ValueError(f"{chapter} has no {BEGIN} / {END} markers")
        start = text.index(BEGIN) + len(BEGIN)
        end = text.index(END)
        code = _escape(web_cells(repo_root / lesson))
        new = text[:start] + "\n" + code + "\n" + text[end:]
        if new != text:
            ts_path.write_text(new)
            changed.append(chapter)
    return changed


if __name__ == "__main__":
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    for name in sync(root):
        print(f"synced {name}")
