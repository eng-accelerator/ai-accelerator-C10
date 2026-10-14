# tests/test_sync_web.py
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))

import sync_web_chapters as sync  # noqa: E402


def test_web_cells_keeps_only_tagged_cells(tmp_path):
    lesson = tmp_path / "ch01.py"
    lesson.write_text(
        "# %% setup\nfrom x import y\n\n# %% C1 hello web\nprint('a')\n\n# %% C2 not shown\nprint('b')\n\n# %% N1 also web\nprint('c')\n"
    )
    assert sync.web_cells(lesson) == "print('a')\n\nprint('c')"


def test_sync_replaces_between_markers_and_escapes(tmp_path):
    (tmp_path / "lessons").mkdir()
    (tmp_path / "lessons" / "ch01.py").write_text("# %% C1 web\nx = f\"`{a}` ${b}\"\n")
    chapters = tmp_path / "web" / "lib" / "chapters"
    chapters.mkdir(parents=True)
    ts = chapters / "ch01.ts"
    ts.write_text('export const ch01 = {\n  backendCode: `/* lesson:begin */\nold\n/* lesson:end */`,\n};\n')
    changed = sync.sync(tmp_path, {"ch01.ts": "lessons/ch01.py"})
    assert changed == ["ch01.ts"]
    out = ts.read_text()
    assert "old" not in out
    assert 'x = f"\\`{a}\\` \\${b}"' in out
    assert out.count("/* lesson:begin */") == 1 and out.count("/* lesson:end */") == 1


def test_sync_fails_loudly_without_markers(tmp_path):
    (tmp_path / "lessons").mkdir()
    (tmp_path / "lessons" / "ch01.py").write_text("# %% C1 web\nprint(1)\n")
    chapters = tmp_path / "web" / "lib" / "chapters"
    chapters.mkdir(parents=True)
    (chapters / "ch01.ts").write_text("export const ch01 = { backendCode: `no markers` };\n")
    try:
        sync.sync(tmp_path, {"ch01.ts": "lessons/ch01.py"})
    except ValueError as exc:
        assert "ch01.ts" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_chapter_map_matches_files():
    for chapter, lesson in sync.CHAPTER_MAP.items():
        assert (REPO / "web" / "lib" / "chapters" / chapter).exists(), chapter
        assert (REPO / lesson).exists(), lesson
