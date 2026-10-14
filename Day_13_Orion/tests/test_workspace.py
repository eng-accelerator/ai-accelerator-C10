import shutil
from pathlib import Path

import pytest

from orion_agent.workspace import Match, Workspace, WorkspaceError


def test_read_and_write_relative(ws_dir):
    ws = Workspace(ws_dir)
    assert "PAGE_TITLE" in ws.read("config.py")
    assert ws.write("generated/new.py", "x = 1\n") == "generated/new.py"
    assert (ws_dir / "generated" / "new.py").read_text() == "x = 1\n"


def test_rejects_escapes_and_absolute_paths(ws_dir):
    ws = Workspace(ws_dir)
    with pytest.raises(WorkspaceError):
        ws.read("../etc/passwd")
    with pytest.raises(WorkspaceError):
        ws.write("/tmp/evil.py", "x")
    with pytest.raises(WorkspaceError):
        ws.resolve("sub/../../outside.py")


def test_list_marks_dirs_and_files(ws_dir):
    (ws_dir / "pkg").mkdir()
    (ws_dir / "__pycache__").mkdir()
    (ws_dir / ".hidden").write_text("")
    ws = Workspace(ws_dir)
    assert ws.list() == ["[DIR] pkg", "[FILE] app.py", "[FILE] chat.py", "[FILE] config.py"]


def test_glob_returns_relative_sorted_paths(ws_dir):
    (ws_dir / "tests").mkdir()
    (ws_dir / "tests" / "test_app.py").write_text("")
    ws = Workspace(ws_dir)
    assert ws.glob("**/*.py") == ["app.py", "chat.py", "config.py", "tests/test_app.py"]
    with pytest.raises(WorkspaceError):
        ws.glob("../*.py")


def test_grep_returns_matches_with_line_numbers(ws_dir):
    ws = Workspace(ws_dir)
    matches = ws.grep("stream")
    assert Match(path="app.py", line=2, text="from chat import stream_response") in matches
    assert all(isinstance(m, Match) for m in matches)
    assert any(m.path == "chat.py" for m in matches)


def test_snapshot_and_reset(ws_dir, tmp_path):
    ws = Workspace(ws_dir)
    snap = ws.snapshot()
    assert (snap / "config.py").read_text() == ws.read("config.py")
    assert snap != ws.root
    shutil.rmtree(snap, ignore_errors=True)

    pristine = tmp_path / "pristine"
    pristine.mkdir()
    (pristine / "config.py").write_text("FRESH = True\n")
    ws.write("generated/junk.py", "junk")
    ws.reset(pristine)
    assert ws.list() == ["[FILE] config.py"]
    assert ws.read("config.py") == "FRESH = True\n"
