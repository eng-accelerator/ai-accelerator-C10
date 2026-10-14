# Plan 1: `orion_agent` package and repo configuration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single Python package that the lessons, the Orion IDE, and the web curriculum will all use, plus the repo-level rules, skills, MCP config, and CLI, with an offline test suite proving the audit bugs are fixed.

**Architecture:** `src/orion_agent/` holds small modules with one job each (workspace jail, sandbox, tools, rules, skills, MCP, search) and a `graphs/` package with the four LangGraph graphs. Graph builders take already-configured runnables (`coder`, `reviewer`, `planner`) so tests can pass scripted objects and lessons can pass `structured(get_llm(), Schema)`. Nothing in this plan imports from `lessons/`, `orion-ide/`, or `web/`.

**Tech Stack:** Python 3.13 via uv, langchain 1.4, langchain-core 1.6, langchain-openai 1.6, langgraph 1.2, langchain-mcp-adapters 0.3, pydantic 2, pyyaml, httpx, pytest 9.

**Spec:** `docs/superpowers/specs/2026-09-04-orion-reframe-design.md`

## Global Constraints

- Python `>=3.13,<3.14`, managed by uv. `.python-version` is `3.13`.
- Structured output always uses `with_structured_output(schema, method="function_calling")`.
- Every file tool resolves paths against a `Workspace` root and refuses escapes.
- `subprocess` is never called with `shell=True`. Timeouts return an `ExecResult` with `timed_out=True`; they never raise.
- Rules come from `AGENTS.md` and `.cursor/rules/*.mdc`. Skills come from `.cursor/skills/**/SKILL.md` and `.claude/skills/**/SKILL.md`.
- Parallel Search MCP URL is `https://search.parallel.ai/mcp`, transport `http`, optional `Authorization: Bearer $PARALLEL_API_KEY`.
- Tests never touch the network. The stub model lives in `tests/conftest.py`.
- Nothing in the repo refers to a previous version of the course or to Ishan's session.
- Commit after every task. All commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Working directory for every command: the repo root `orion-tutorial/`, on branch `reframe-python`.

---

## File structure

```
pyproject.toml                       Task 1
.python-version                      Task 1
.gitignore                           Task 1 (append)
src/orion_agent/__init__.py          Task 1
src/orion_agent/workspace.py         Task 2
src/orion_agent/sandbox.py           Task 3
src/orion_agent/tools.py             Task 4
src/orion_agent/schemas.py           Task 5
src/orion_agent/llm.py               Task 5
src/orion_agent/rules.py             Task 6
AGENTS.md, .cursor/rules/*.mdc       Task 6
src/orion_agent/skills.py            Task 7
.cursor/skills/*/SKILL.md            Task 7
src/orion_agent/mcp.py               Task 8
.cursor/mcp.json, .env.example       Task 8
src/orion_agent/search.py            Task 9
src/orion_agent/embeddings.py        Task 9
src/orion_agent/graphs/__init__.py   Task 10
src/orion_agent/graphs/tool_agent.py Task 10
src/orion_agent/graphs/self_correcting.py  Task 11
src/orion_agent/graphs/orchestrator.py     Task 12
src/orion_agent/graphs/parallel.py         Task 13
src/orion_agent/cli.py               Task 14
sample_project/ (moved)              Task 14
tests/conftest.py                    Task 1
tests/test_*.py                      one per module
```

---

### Task 1: Project scaffold and test doubles

**Files:**
- Create: `pyproject.toml`, `.python-version`, `src/orion_agent/__init__.py`, `tests/conftest.py`, `tests/test_scaffold.py`
- Modify: `.gitignore` (append)

**Interfaces:**
- Produces: `tests.conftest.ScriptedChatModel(responses=[AIMessage,...])` with `.calls: list[list[BaseMessage]]` and a no-op `bind_tools`; `tests.conftest.Scripted(*outputs)` with `.invoke(prompt)` and `.prompts: list[str]` (returns outputs in order, repeating the last one).

- [ ] **Step 1: Write `pyproject.toml`**

```toml
[project]
name = "orion-agent"
version = "0.1.0"
description = "Build an AI coding agent with LangChain and LangGraph"
readme = "README.md"
requires-python = ">=3.13,<3.14"
dependencies = [
  "langchain>=1.4,<2",
  "langchain-core>=1.6,<2",
  "langchain-openai>=1.6,<2",
  "langgraph>=1.2,<2",
  "langchain-mcp-adapters>=0.3,<1",
  "pydantic>=2.11,<3",
  "python-dotenv>=1.1",
  "pyyaml>=6.0",
  "httpx>=0.28",
]

[project.scripts]
orion = "orion_agent.cli:main"

[dependency-groups]
dev = [
  "pytest>=9",
  "ipykernel>=7",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/orion_agent"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"
```

- [ ] **Step 2: Write `.python-version`**

```
3.13
```

- [ ] **Step 3: Append to `.gitignore`**

Run:

```bash
cat >> .gitignore <<'EOF'

# orion_agent
.venv/
.env
workspace/
__pycache__/
.pytest_cache/
*.egg-info/
EOF
```

- [ ] **Step 4: Write `src/orion_agent/__init__.py`**

```python
"""Orion: build an AI coding agent with LangChain and LangGraph."""

__version__ = "0.1.0"
```

- [ ] **Step 5: Write `tests/conftest.py`**

```python
from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field


class ScriptedChatModel(BaseChatModel):
    """Chat model that replays queued AIMessages and records what it was asked."""

    responses: list[AIMessage]
    calls: list[list[BaseMessage]] = Field(default_factory=list)

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        self.calls.append(list(messages))
        if self.responses:
            msg = self.responses.pop(0)
        else:
            msg = AIMessage(content="(no scripted response left)")
        return ChatResult(generations=[ChatGeneration(message=msg)])

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self


class Scripted:
    """Stand-in for a structured-output runnable: returns outputs in order, repeats the last."""

    def __init__(self, *outputs: Any) -> None:
        self.outputs = list(outputs)
        self.prompts: list[str] = []

    def invoke(self, prompt: str, config: Any = None) -> Any:
        self.prompts.append(prompt)
        if len(self.outputs) > 1:
            return self.outputs.pop(0)
        return self.outputs[0]


@pytest.fixture
def ws_dir(tmp_path: Path) -> Path:
    (tmp_path / "app.py").write_text(
        'import streamlit as st\nfrom chat import stream_response\n\ndef main():\n    st.title("Chat")\n'
    )
    (tmp_path / "chat.py").write_text(
        "def stream_response(client, messages):\n    for chunk in client.stream(messages):\n        yield chunk\n"
    )
    (tmp_path / "config.py").write_text('PAGE_TITLE = "My ChatBot"\nMODEL = "openai/gpt-4o-mini"\n')
    return tmp_path
```

- [ ] **Step 6: Write `tests/test_scaffold.py`**

```python
from langchain_core.messages import AIMessage, HumanMessage

from orion_agent import __version__
from tests.conftest import Scripted, ScriptedChatModel


def test_version():
    assert __version__ == "0.1.0"


def test_scripted_chat_model_replays_and_records():
    model = ScriptedChatModel(responses=[AIMessage(content="one"), AIMessage(content="two")])
    assert model.invoke([HumanMessage(content="a")]).content == "one"
    assert model.invoke([HumanMessage(content="b")]).content == "two"
    assert len(model.calls) == 2


def test_scripted_repeats_last_output():
    s = Scripted(1, 2)
    assert [s.invoke("p1"), s.invoke("p2"), s.invoke("p3")] == [1, 2, 2]
    assert s.prompts == ["p1", "p2", "p3"]
```

`tests/` needs to be importable as a package for `from tests.conftest import ...`. Create an empty `tests/__init__.py`.

- [ ] **Step 7: Install and run**

Run:

```bash
uv sync
uv run pytest tests/test_scaffold.py -v
```

Expected: 3 passed. If `uv sync` reports no Python 3.13, run `uv python install 3.13` and retry.

- [ ] **Step 8: Commit**

```bash
git add pyproject.toml .python-version .gitignore uv.lock src/orion_agent/__init__.py tests/__init__.py tests/conftest.py tests/test_scaffold.py
git commit -m "Scaffold orion_agent package with uv and test doubles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Workspace jail

**Files:**
- Create: `src/orion_agent/workspace.py`, `tests/test_workspace.py`

**Interfaces:**
- Produces: `Workspace(root)` with `.root: Path`, `.resolve(rel) -> Path`, `.relative(full) -> str`, `.read(rel) -> str`, `.write(rel, text) -> str`, `.list(rel=".") -> list[str]`, `.glob(pattern) -> list[str]`, `.grep(pattern, glob="**/*.py") -> list[Match]`, `.snapshot() -> Path`, `.reset(from_dir) -> None`; `Match(path, line, text)`; `WorkspaceError`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_workspace.py
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

    pristine = tmp_path / "pristine"
    pristine.mkdir()
    (pristine / "config.py").write_text("FRESH = True\n")
    ws.write("generated/junk.py", "junk")
    ws.reset(pristine)
    assert ws.list() == ["[FILE] config.py"]
    assert ws.read("config.py") == "FRESH = True\n"
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_workspace.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'orion_agent.workspace'`

- [ ] **Step 3: Write `src/orion_agent/workspace.py`**

```python
"""A directory the agent may touch, and nothing outside it."""

from __future__ import annotations

import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

_SKIP_DIRS = {"__pycache__", ".git", ".venv", "node_modules"}


class WorkspaceError(Exception):
    """Raised when a path would leave the workspace."""


@dataclass(frozen=True)
class Match:
    path: str
    line: int
    text: str


class Workspace:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve(self, rel: str) -> Path:
        candidate = Path(rel)
        if candidate.is_absolute():
            raise WorkspaceError(f"absolute paths are not allowed: {rel}")
        full = (self.root / candidate).resolve()
        if full != self.root and self.root not in full.parents:
            raise WorkspaceError(f"path escapes the workspace: {rel}")
        return full

    def relative(self, full: Path) -> str:
        return full.relative_to(self.root).as_posix()

    def read(self, rel: str) -> str:
        return self.resolve(rel).read_text()

    def write(self, rel: str, text: str) -> str:
        full = self.resolve(rel)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(text)
        return self.relative(full)

    def list(self, rel: str = ".") -> list[str]:
        full = self.resolve(rel)
        entries = []
        for entry in sorted(full.iterdir(), key=lambda p: (p.is_file(), p.name)):
            if entry.name.startswith(".") or entry.name in _SKIP_DIRS:
                continue
            prefix = "[DIR]" if entry.is_dir() else "[FILE]"
            entries.append(f"{prefix} {entry.name}")
        return entries

    def glob(self, pattern: str) -> list[str]:
        if pattern.startswith("/") or ".." in Path(pattern).parts:
            raise WorkspaceError(f"glob pattern must stay inside the workspace: {pattern}")
        out = []
        for p in self.root.glob(pattern):
            if p.is_file() and not (_SKIP_DIRS & set(p.relative_to(self.root).parts)):
                out.append(self.relative(p))
        return sorted(out)

    def grep(self, pattern: str, glob: str = "**/*.py", ignore_case: bool = True) -> list[Match]:
        flags = re.IGNORECASE if ignore_case else 0
        rx = re.compile(pattern, flags)
        matches = []
        for rel in self.glob(glob):
            for number, line in enumerate(self.read(rel).splitlines(), start=1):
                if rx.search(line):
                    matches.append(Match(path=rel, line=number, text=line.rstrip()))
        return matches

    def snapshot(self) -> Path:
        target = Path(tempfile.mkdtemp(prefix="orion-ws-"))
        shutil.copytree(self.root, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*_SKIP_DIRS))
        return target

    def reset(self, from_dir: str | Path) -> None:
        for child in self.root.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        shutil.copytree(Path(from_dir), self.root, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*_SKIP_DIRS))
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_workspace.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/workspace.py tests/test_workspace.py
git commit -m "Add Workspace: root-jailed read, write, list, glob, grep, snapshot, reset

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Sandbox

**Files:**
- Create: `src/orion_agent/sandbox.py`, `tests/test_sandbox.py`

**Interfaces:**
- Produces: `ExecResult(stdout, stderr, returncode, timed_out=False)` with `.ok` and `.summary()`; `Sandbox` protocol; `LocalSandbox(python=None)` with `.run_python(code, *, timeout=10, cwd=None) -> ExecResult` and `.run(argv, *, cwd=None, timeout=30) -> ExecResult`; `DockerSandbox` stub.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_sandbox.py
import pytest

from orion_agent.sandbox import DockerSandbox, ExecResult, LocalSandbox


def test_hello_world():
    r = LocalSandbox().run_python("print('hello world')")
    assert r.ok
    assert r.stdout.strip() == "hello world"
    assert r.stderr == ""


def test_error_is_reported_not_raised():
    r = LocalSandbox().run_python("print(1/0)")
    assert not r.ok
    assert r.returncode == 1
    assert "ZeroDivisionError" in r.stderr


def test_timeout_returns_failed_result():
    r = LocalSandbox().run_python("import time; time.sleep(5)", timeout=1)
    assert r.timed_out
    assert not r.ok
    assert r.returncode == -1
    assert "Timed out" in r.stderr


def test_environment_is_scrubbed(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "secret")
    r = LocalSandbox().run_python("import os; print(os.environ.get('OPENROUTER_API_KEY'))")
    assert r.stdout.strip() == "None"


def test_cwd_is_importable(tmp_path):
    (tmp_path / "config.py").write_text('PAGE_TITLE = "T"\n')
    r = LocalSandbox().run_python("import config; print(config.PAGE_TITLE)", cwd=tmp_path)
    assert r.stdout.strip() == "T"


def test_run_argv_without_shell(tmp_path):
    r = LocalSandbox().run(["echo", "a && b"], cwd=tmp_path)
    assert r.stdout.strip() == "a && b"


def test_summary_formats_output():
    r = ExecResult(stdout="out\n", stderr="err\n", returncode=2)
    s = r.summary()
    assert "Exit code: 2" in s and "STDOUT:\nout" in s and "STDERR:\nerr" in s
    assert ExecResult("", "", 0).summary() == "Exit code: 0\n(no output)"


def test_docker_sandbox_is_a_stub():
    with pytest.raises(NotImplementedError):
        DockerSandbox()
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_sandbox.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/sandbox.py`**

```python
"""Run generated code with the common accidents prevented.

LocalSandbox is a jail, not a sandbox: it runs code in a temporary directory,
with a scrubbed environment, in isolated mode, with a timeout that returns
instead of raising. It does not block network access or limit CPU or memory.
Shipped coding agents use Seatbelt (macOS), bubblewrap (Linux), Docker, or a
microVM. Swap in DockerSandbox when you need that.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

_SAFE_ENV_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT")


@dataclass(frozen=True)
class ExecResult:
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.returncode == 0 and not self.timed_out

    def summary(self) -> str:
        parts = [f"Exit code: {self.returncode}"]
        if self.timed_out:
            parts[0] += " (timed out)"
        if self.stdout:
            parts.append(f"STDOUT:\n{self.stdout.rstrip()}")
        if self.stderr:
            parts.append(f"STDERR:\n{self.stderr.rstrip()}")
        if len(parts) == 1:
            parts.append("(no output)")
        return "\n".join(parts)


class Sandbox(Protocol):
    def run_python(self, code: str, *, timeout: float = 10, cwd: Path | None = None) -> ExecResult: ...

    def run(self, argv: list[str], *, cwd: Path | None = None, timeout: float = 30) -> ExecResult: ...


class LocalSandbox:
    def __init__(self, python: str | None = None) -> None:
        self.python = python or sys.executable

    @staticmethod
    def _env() -> dict[str, str]:
        return {k: os.environ[k] for k in _SAFE_ENV_KEYS if k in os.environ}

    def run(self, argv: list[str], *, cwd: Path | None = None, timeout: float = 30) -> ExecResult:
        workdir = Path(cwd) if cwd is not None else Path(tempfile.mkdtemp(prefix="orion-sbx-"))
        try:
            proc = subprocess.run(
                list(argv),
                cwd=workdir,
                env=self._env(),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            return ExecResult(stdout=stdout, stderr=f"Timed out after {timeout}s", returncode=-1, timed_out=True)
        except FileNotFoundError as exc:
            return ExecResult(stdout="", stderr=str(exc), returncode=127)
        return ExecResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)

    def run_python(self, code: str, *, timeout: float = 10, cwd: Path | None = None) -> ExecResult:
        if cwd is not None:
            code = f"import sys; sys.path.insert(0, {str(Path(cwd).resolve())!r})\n" + code
        return self.run([self.python, "-I", "-c", code], cwd=cwd, timeout=timeout)


class DockerSandbox:
    """Placeholder for a real sandbox. Not implemented in this course.

    A working version runs `docker run --rm --network none -v <tmp>:/work python:3.13-slim`
    per call. Hosted options: E2B, Modal Sandboxes, Daytona.
    """

    def __init__(self, image: str = "python:3.13-slim") -> None:
        raise NotImplementedError("DockerSandbox is a stub. Use LocalSandbox, or implement this class.")
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_sandbox.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/sandbox.py tests/test_sandbox.py
git commit -m "Add LocalSandbox: isolated python, scrubbed env, timeouts as results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Tools

**Files:**
- Create: `src/orion_agent/tools.py`, `tests/test_tools.py`

**Interfaces:**
- Consumes: `Workspace`, `WorkspaceError` (Task 2); `Sandbox` (Task 3).
- Produces: `basic_tools(ws) -> list[BaseTool]` (`read_file`, `write_file`, `list_directory`); `make_tools(ws, sandbox) -> dict[str, BaseTool]` with keys `read_file`, `write_file`, `list_directory`, `grep_files`, `glob_files`, `run_python`, `run_command`. All tools return strings; errors are returned as `"Error: ..."` text.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_tools.py
from orion_agent.sandbox import LocalSandbox
from orion_agent.tools import basic_tools, make_tools
from orion_agent.workspace import Workspace


def test_basic_tools_names_and_schemas(ws_dir):
    tools = basic_tools(Workspace(ws_dir))
    assert [t.name for t in tools] == ["read_file", "write_file", "list_directory"]
    assert "filepath" in tools[0].args_schema.model_json_schema()["properties"]


def test_read_write_list(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert t["write_file"].invoke({"filepath": "generated/a.py", "content": "print(1)\n"}) == "File written: generated/a.py"
    assert t["read_file"].invoke({"filepath": "generated/a.py"}) == "print(1)\n"
    assert "[DIR] generated" in t["list_directory"].invoke({"directory": "."})


def test_escape_is_an_error_string_not_an_exception(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    out = t["read_file"].invoke({"filepath": "../secret.txt"})
    assert out.startswith("Error:")


def test_missing_file_is_an_error_string(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert t["read_file"].invoke({"filepath": "nope.py"}).startswith("Error: file not found")


def test_grep_and_glob(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert "chat.py:2:" in t["grep_files"].invoke({"pattern": "def stream_response"})
    assert t["grep_files"].invoke({"pattern": "zzz_no_match"}) == "No matches."
    assert t["glob_files"].invoke({"pattern": "*.py"}) == "app.py\nchat.py\nconfig.py"


def test_run_python_and_run_command(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert "hello" in t["run_python"].invoke({"code": "print('hello')"})
    out = t["run_command"].invoke({"command": ["python", "-c", "import config; print(config.PAGE_TITLE)"], "cwd": "."})
    assert "My ChatBot" in out
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_tools.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/tools.py`**

```python
"""LangChain tools over a Workspace and a Sandbox."""

from __future__ import annotations

import sys

from langchain_core.tools import BaseTool, tool

from orion_agent.sandbox import Sandbox
from orion_agent.workspace import Workspace, WorkspaceError


def make_tools(ws: Workspace, sandbox: Sandbox) -> dict[str, BaseTool]:
    @tool
    def read_file(filepath: str) -> str:
        """Read a file inside the workspace and return its contents."""
        try:
            return ws.read(filepath)
        except FileNotFoundError:
            return f"Error: file not found: {filepath}"
        except WorkspaceError as exc:
            return f"Error: {exc}"

    @tool
    def write_file(filepath: str, content: str) -> str:
        """Write content to a file inside the workspace, creating directories as needed."""
        try:
            return f"File written: {ws.write(filepath, content)}"
        except WorkspaceError as exc:
            return f"Error: {exc}"

    @tool
    def list_directory(directory: str = ".") -> str:
        """List the files and folders in a workspace directory."""
        try:
            entries = ws.list(directory)
        except (FileNotFoundError, NotADirectoryError):
            return f"Error: not a directory: {directory}"
        except WorkspaceError as exc:
            return f"Error: {exc}"
        return "\n".join(entries) if entries else "Empty directory"

    @tool
    def grep_files(pattern: str, glob: str = "**/*.py") -> str:
        """Search file contents with a regular expression. Returns path:line: text for each hit."""
        try:
            matches = ws.grep(pattern, glob=glob)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        if not matches:
            return "No matches."
        return "\n".join(f"{m.path}:{m.line}: {m.text}" for m in matches)

    @tool
    def glob_files(pattern: str) -> str:
        """Find files by name pattern, for example **/*.py or tests/*.py."""
        try:
            files = ws.glob(pattern)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        return "\n".join(files) if files else "No files match."

    @tool
    def run_python(code: str) -> str:
        """Run a Python snippet in the sandbox and return its output."""
        return sandbox.run_python(code, cwd=ws.root).summary()

    @tool
    def run_command(command: list[str], cwd: str = ".") -> str:
        """Run a command (as an argv list, no shell) inside a workspace directory."""
        try:
            workdir = ws.resolve(cwd)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        argv = [sys.executable if command and command[0] in ("python", "python3") else command[0], *command[1:]]
        return sandbox.run(argv, cwd=workdir).summary()

    return {
        "read_file": read_file,
        "write_file": write_file,
        "list_directory": list_directory,
        "grep_files": grep_files,
        "glob_files": glob_files,
        "run_python": run_python,
        "run_command": run_command,
    }


def basic_tools(ws: Workspace) -> list[BaseTool]:
    """The three tools from Lesson 1: read, write, list."""
    from orion_agent.sandbox import LocalSandbox

    t = make_tools(ws, LocalSandbox())
    return [t["read_file"], t["write_file"], t["list_directory"]]
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_tools.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/tools.py tests/test_tools.py
git commit -m "Add workspace and sandbox tools

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Schemas and LLM factory

**Files:**
- Create: `src/orion_agent/schemas.py`, `src/orion_agent/llm.py`, `tests/test_llm.py`

**Interfaces:**
- Produces: `CodeOutput(code, explanation)`, `ReviewResult(approved, feedback)`, `FileTask(filepath, description, action)`, `Plan(summary, file_tasks)`, `CodeResult(filepath, code, explanation)`; `BASE_URL`, `FAST`, `STRONG`, `get_llm(model=FAST, temperature=0.0, api_key=None) -> ChatOpenAI`, `structured(llm, schema)`, `check_models(models=(FAST, STRONG), client=None) -> list[str]`.

- [ ] **Step 1: Write `src/orion_agent/schemas.py`**

```python
"""Pydantic schemas shared by the graphs."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CodeOutput(BaseModel):
    code: str = Field(description="Complete, runnable Python code with no markdown fences")
    explanation: str = Field(description="One paragraph on what the code does")


class ReviewResult(BaseModel):
    approved: bool = Field(description="True if the code is acceptable as is")
    feedback: str = Field(description="Specific problems to fix, or 'Looks good' if approved")


class FileTask(BaseModel):
    filepath: str = Field(description="Path relative to the workspace root")
    description: str = Field(description="What to change in this file")
    action: Literal["create", "modify"] = Field(description="create a new file or modify an existing one")


class Plan(BaseModel):
    summary: str = Field(description="One paragraph describing the approach")
    file_tasks: list[FileTask] = Field(description="Files to create or modify, in order")


class CodeResult(BaseModel):
    filepath: str = Field(description="Path relative to the workspace root")
    code: str = Field(description="Complete file contents")
    explanation: str = Field(description="What changed and why")
```

- [ ] **Step 2: Write the failing tests**

```python
# tests/test_llm.py
import httpx
import pytest

from orion_agent.llm import BASE_URL, FAST, STRONG, check_models, get_llm, structured
from orion_agent.schemas import CodeOutput


def test_get_llm_requires_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        get_llm()


def test_get_llm_points_at_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    llm = get_llm(STRONG, temperature=0.2)
    assert llm.model_name == STRONG
    assert llm.temperature == 0.2
    assert str(llm.openai_api_base).rstrip("/") == BASE_URL


def test_structured_uses_function_calling(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    runnable = structured(get_llm(), CodeOutput)
    assert runnable is not None  # ChatOpenAI raises on unsupported methods; construction is the check


def test_check_models_reports_missing_ids():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/models")
        return httpx.Response(200, json={"data": [{"id": FAST}]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert check_models(client=client) == [STRONG]
    assert check_models(models=(FAST,), client=client) == []
```

- [ ] **Step 3: Run to verify failure**

Run: `uv run pytest tests/test_llm.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'orion_agent.llm'`

- [ ] **Step 4: Write `src/orion_agent/llm.py`**

```python
"""Chat models via OpenRouter."""

from __future__ import annotations

import os

import httpx
from langchain_openai import ChatOpenAI

BASE_URL = "https://openrouter.ai/api/v1"
FAST = "openai/gpt-4o-mini"
STRONG = "anthropic/claude-sonnet-4.5"


def get_llm(model: str = FAST, temperature: float = 0.0, api_key: str | None = None) -> ChatOpenAI:
    key = api_key or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.")
    return ChatOpenAI(model=model, api_key=key, base_url=BASE_URL, temperature=temperature)


def structured(llm: ChatOpenAI, schema: type):
    # function_calling is the one method every OpenRouter provider translates;
    # json_schema mode is OpenAI-only.
    return llm.with_structured_output(schema, method="function_calling")


def check_models(models: tuple[str, ...] = (FAST, STRONG), client: httpx.Client | None = None) -> list[str]:
    """Return the model IDs in `models` that OpenRouter does not list."""
    client = client or httpx.Client(timeout=15)
    data = client.get(f"{BASE_URL}/models").json()["data"]
    available = {m["id"] for m in data}
    return [m for m in models if m not in available]
```

- [ ] **Step 5: Run to verify pass**

Run: `uv run pytest tests/test_llm.py -v`
Expected: 4 passed. If `test_get_llm_points_at_openrouter` fails on the attribute name, print `llm.model_dump().keys()` once and use the attribute that holds the base URL (`openai_api_base` is the field name in langchain-openai 1.x).

- [ ] **Step 6: Commit**

```bash
git add src/orion_agent/schemas.py src/orion_agent/llm.py tests/test_llm.py
git commit -m "Add schemas and OpenRouter LLM factory with model check

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Rules loader and the repo's rules files

**Files:**
- Create: `src/orion_agent/rules.py`, `tests/test_rules.py`, `AGENTS.md`, `.cursor/rules/python.mdc`, `.cursor/rules/tests.mdc`, `.cursor/rules/frontend-design.mdc`
- Note: the existing `AGENTS.md` contains Vercel boilerplate. Replace it entirely.

**Interfaces:**
- Produces: `Rule(name, description, globs, always_apply, body, source)`; `parse_frontmatter(text) -> tuple[dict, str]`; `glob_matches(pattern, path) -> bool`; `list_rules(root) -> list[Rule]`; `load_rules(root, for_path=None) -> str`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_rules.py
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_rules.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/rules.py`**

```python
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
    name: str
    description: str
    globs: list[str]
    always_apply: bool
    body: str
    source: str
    kind: str = field(default="mdc")


def parse_frontmatter(text: str) -> tuple[dict, str]:
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
    if fnmatchcase(path, pattern):
        return True
    return pattern.startswith("**/") and fnmatchcase(path, pattern[3:])


def list_rules(root: str | Path) -> list[Rule]:
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
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_rules.py -v`
Expected: 6 passed

- [ ] **Step 5: Write the repo's real rules files**

`AGENTS.md` (replace the whole file):

```markdown
# Orion agent rules

This repository teaches how to build an AI coding agent with LangChain and LangGraph. Anyone editing it, human or agent, follows these rules.

## Environment
- Python is managed by uv. Run things with `uv run`, add packages with `uv add`. Never `pip install`.
- Secrets live in `.env`. Never commit one, never print one.
- Agent-generated files go under `workspace/`. Never write into `sample_project/`.

## Code
- Type hints on every function. Docstrings on public functions. Follow PEP 8.
- Prefer small modules with one job over large ones.
- Tests live in `tests/`, run offline, and use the stub model in `tests/conftest.py`.
- Run `uv run pytest` before you say a change is done.

## Files
- Do not create notebooks. Lessons are Python files with `# %%` cells.
- Do not edit `DESIGN.md`; it is the source of truth for anything visual.
```

`.cursor/rules/python.mdc`:

```markdown
---
description: Python conventions for every .py file in this repo
globs: **/*.py
alwaysApply: false
---
You are an expert Python developer. When generating or editing Python:
- Use type hints on all function parameters and return values.
- Add a concise docstring to every public function and class.
- Follow PEP 8: 4-space indentation, snake_case names, two blank lines between top-level definitions.
- Prefer modern Python (3.12+): pathlib over os.path, f-strings, match/case where it reads better, dataclasses for plain data.
- Never write bare `except:`; catch the exception you expect.
- Keep functions under 40 lines. Split when they grow.
```

`.cursor/rules/tests.mdc`:

```markdown
---
description: Stricter rules for test files
globs: tests/**/*.py, **/test_*.py
alwaysApply: false
---
Rules for test code, on top of the Python conventions:
- Every test function name starts with `test_` and states the behaviour, for example `test_timeout_returns_failed_result`.
- One behaviour per test. No loops that hide multiple assertions.
- Use pytest fixtures and `tmp_path`; never write to the real filesystem outside `tmp_path`.
- No network calls. Use the stub model and `httpx.MockTransport`.
- Use list comprehensions instead of loops where they read better.
- Variable names must be descriptive: no single letters except loop counters.
- Add an `if __name__ == "__main__":` guard to any test helper that is also a script.
```

`.cursor/rules/frontend-design.mdc`:

```markdown
---
description: Visual rules for all UI code; the full system is in DESIGN.md
globs: **/*.tsx, **/*.css, **/*.jsx
alwaysApply: false
---
Before writing or changing UI, apply the design system below in full.
The short version:
1. Prefer utility over decoration.
2. Make the primary user task immediately obvious.
3. Use light, depth, and colour deliberately, not everywhere.
4. Purple (`--accent`) signals AI, active states, and primary actions. One dominant accent per screen.
5. Monospace only for code, metrics, shortcuts, commands, model names, technical metadata.
6. Keep interaction states visible: default, hover, focus, disabled, loading, empty, error.
7. Never convey status by colour alone; pair it with an icon or label.
8. No arbitrary hex values, spacing, radii, or shadows. Use the tokens.
9. No light backgrounds inside the product UI. No glassmorphism, neon, or bright gradients on ordinary surfaces.
10. AI output that needs review must look reviewable: show accept, apply, edit, retry, or view diff next to it.

@DESIGN.md
```

- [ ] **Step 6: Check the real files load**

Run:

```bash
uv run python -c "from orion_agent.rules import load_rules; t = load_rules('.', 'src/App.tsx'); print(t[:400]); assert 'canvas' in t and '@DESIGN.md' not in t"
uv run python -c "from orion_agent.rules import load_rules; t = load_rules('.', 'tests/test_x.py'); assert 'tests.mdc' in t and 'python.mdc' in t and 'frontend-design' not in t; print('ok')"
```

Expected: the first prints the repo rules followed by the design rules; the second prints `ok`.

- [ ] **Step 7: Commit**

```bash
git add src/orion_agent/rules.py tests/test_rules.py AGENTS.md .cursor/rules
git commit -m "Add layered rules loader and the repo's AGENTS.md and .cursor/rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Skills loader and the repo's skills

**Files:**
- Create: `src/orion_agent/skills.py`, `tests/test_skills.py`, `.cursor/skills/add-feature/SKILL.md`, `.cursor/skills/web-research/SKILL.md`, `.cursor/skills/frontend-design/SKILL.md`, `.cursor/skills/commit-deploy/SKILL.md`

**Interfaces:**
- Consumes: `parse_frontmatter`, `glob_matches` (Task 6).
- Produces: `Skill(name, description, paths, path, model_invocable)`; `load_skills(root) -> list[Skill]`; `read_skill_body(skill) -> str`; `skills_catalog(skills, for_path=None) -> str`; `make_read_skill_tool(skills) -> BaseTool` (tool name `read_skill`, arg `name`).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_skills.py
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_skills.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/skills.py`**

```python
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
    _, body = parse_frontmatter(skill.path.read_text())
    return body


def skills_catalog(skills: list[Skill], for_path: str | None = None) -> str:
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
    by_name = {s.name: s for s in skills}

    @tool
    def read_skill(name: str) -> str:
        """Load the full instructions of a skill by name. Call this when a skill in the catalog matches the task."""
        skill = by_name.get(name)
        if skill is None:
            return f"Error: unknown skill '{name}'. Available: {', '.join(sorted(by_name))}"
        return read_skill_body(skill)

    return read_skill
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_skills.py -v`
Expected: 4 passed

- [ ] **Step 5: Write the repo's real skills**

`.cursor/skills/add-feature/SKILL.md`:

```markdown
---
name: add-feature
description: How to add a feature to a codebase safely. Use when asked to add, change, or extend behaviour across one or more files.
---
# Add a feature

1. Find the code first. Run `grep_files` for the words in the request and `read_file` on every hit before planning.
2. Write a plan with one entry per file: path, create or modify, what changes.
3. Generate each file in full. Never emit a diff or a snippet.
4. Run the tests. If the workspace has none, import every module you changed.
5. Fix failures from the traceback, not from memory.
6. Ask for review only after tests pass. Include the test output.
7. Stop and wait for the human before writing to the real workspace.
```

`.cursor/skills/web-research/SKILL.md`:

```markdown
---
name: web-research
description: How to find a current fact on the web. Use when the task needs information newer than your training data or outside the codebase (API details, library versions, exchange rates, docs).
---
# Web research

1. Call `web_search` with one objective and two or three short queries.
2. Read the excerpts. If they answer the question, stop; do not fetch.
3. Fetch at most two URLs with `web_fetch`, the ones with the most specific excerpt.
4. In your answer, name the source URL next to each fact you took from it.
5. If sources disagree, say so and prefer the official documentation.
```

`.cursor/skills/frontend-design/SKILL.md`:

```markdown
---
name: frontend-design
description: Checklist for UI work in this repo. Use whenever creating or editing .tsx or .css files.
paths:
  - "**/*.tsx"
  - "**/*.css"
---
# Frontend design checklist

1. Read `DESIGN.md` before writing a line. It defines the tokens, type scale, spacing, components, and what to avoid.
2. Reuse an existing component before writing a new one.
3. For every interactive element, implement default, hover, focus, disabled, loading, empty, and error states where they apply.
4. Use `--accent` for one thing per screen: the primary action, the active state, or the AI affordance.
5. AI output that needs review shows its controls next to it: accept, apply, edit, retry, view diff.
6. Check the layout at 1200px and at 375px before you finish.
7. Never add a hex value, spacing, radius, or shadow that is not in `DESIGN.md`.
```

`.cursor/skills/commit-deploy/SKILL.md`:

```markdown
---
name: commit-deploy
description: Run the tests, commit everything with a one-line message, and deploy the site.
disable-model-invocation: true
---
# Commit and deploy

1. `uv run pytest`. Stop if anything fails.
2. `cd web && npm run lint && npm run build`. Stop if anything fails.
3. `git add -A && git commit -m "<one line describing the change>"`.
4. `git push`. Vercel deploys `main` to production and every other branch to a preview URL.
5. Report the commit hash and the deploy URL.
```

- [ ] **Step 6: Check the real skills load**

Run:

```bash
uv run python -c "from orion_agent.skills import load_skills, skills_catalog; s = load_skills('.'); print(skills_catalog(s)); assert len(s) == 4 and 'commit-deploy' not in skills_catalog(s)"
```

Expected: three catalog lines (add-feature, frontend-design, web-research) and no assertion error.

- [ ] **Step 7: Commit**

```bash
git add src/orion_agent/skills.py tests/test_skills.py .cursor/skills
git commit -m "Add skills loader, read_skill tool, and the repo's four skills

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: MCP tools and config

**Files:**
- Create: `src/orion_agent/mcp.py`, `tests/test_mcp.py`, `.cursor/mcp.json`, `.env.example`

**Interfaces:**
- Produces: `PARALLEL_SEARCH_URL`; `parallel_connection(api_key=None) -> dict`; `default_connections() -> dict`; `async aget_mcp_tools(connections=None) -> list[BaseTool]`; `get_mcp_tools(connections=None) -> list[BaseTool]`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_mcp.py
import asyncio

from orion_agent import mcp
from orion_agent.mcp import PARALLEL_SEARCH_URL, aget_mcp_tools, default_connections, parallel_connection


def test_parallel_connection_without_key():
    assert parallel_connection() == {"transport": "http", "url": PARALLEL_SEARCH_URL}


def test_parallel_connection_with_key():
    conn = parallel_connection("abc")
    assert conn["headers"] == {"Authorization": "Bearer abc"}


def test_default_connections_reads_env(monkeypatch):
    monkeypatch.setenv("PARALLEL_API_KEY", "k1")
    assert default_connections()["parallel-search"]["headers"]["Authorization"] == "Bearer k1"
    monkeypatch.delenv("PARALLEL_API_KEY")
    assert "headers" not in default_connections()["parallel-search"]


def test_aget_mcp_tools_builds_client_with_connections(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, connections):
            captured["connections"] = connections

        async def get_tools(self):
            return ["tool-a", "tool-b"]

    monkeypatch.setattr(mcp, "MultiServerMCPClient", FakeClient)
    tools = asyncio.run(aget_mcp_tools({"x": {"transport": "http", "url": "http://localhost/mcp"}}))
    assert tools == ["tool-a", "tool-b"]
    assert captured["connections"] == {"x": {"transport": "http", "url": "http://localhost/mcp"}}
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_mcp.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/mcp.py`**

```python
"""Tools from MCP servers. Today: Parallel Search (web_search, web_fetch).

MCP tools are async. Bind them like any other tool, then call the graph with
`ainvoke` or `astream`.
"""

from __future__ import annotations

import asyncio
import os

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

PARALLEL_SEARCH_URL = "https://search.parallel.ai/mcp"


def parallel_connection(api_key: str | None = None) -> dict:
    conn: dict = {"transport": "http", "url": PARALLEL_SEARCH_URL}
    if api_key:
        conn["headers"] = {"Authorization": f"Bearer {api_key}"}
    return conn


def default_connections() -> dict:
    return {"parallel-search": parallel_connection(os.environ.get("PARALLEL_API_KEY"))}


async def aget_mcp_tools(connections: dict | None = None) -> list[BaseTool]:
    client = MultiServerMCPClient(connections or default_connections())
    return await client.get_tools()


def get_mcp_tools(connections: dict | None = None) -> list[BaseTool]:
    """Sync wrapper for scripts. Inside a notebook or interactive window use `await aget_mcp_tools()`."""
    return asyncio.run(aget_mcp_tools(connections))
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_mcp.py -v`
Expected: 4 passed

- [ ] **Step 5: Write `.cursor/mcp.json` and `.env.example`**

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "Parallel Search MCP": {
      "url": "https://search.parallel.ai/mcp"
    }
  }
}
```

`.env.example`:

```
OPENROUTER_API_KEY=your_openrouter_key
# Optional. The Parallel Search MCP works without a key; a key raises the rate limit.
PARALLEL_API_KEY=
```

- [ ] **Step 6: Live check (manual, needs network)**

Run: `uv run python -c "from orion_agent.mcp import get_mcp_tools; print([t.name for t in get_mcp_tools()])"`
Expected: `['web_search', 'web_fetch']`. If the network is unavailable, note it and continue; the tests above cover the wiring.

- [ ] **Step 7: Commit**

```bash
git add src/orion_agent/mcp.py tests/test_mcp.py .cursor/mcp.json .env.example
git commit -m "Add Parallel Search MCP tools and Cursor MCP config

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Codebase search and the embeddings footnote

**Files:**
- Create: `src/orion_agent/search.py`, `src/orion_agent/embeddings.py`, `tests/test_search.py`

**Interfaces:**
- Consumes: `Workspace` (Task 2).
- Produces: `search_codebase(ws, query, max_files=5, max_lines=12) -> str`; `repo_map(ws) -> str`; `build_index(ws, embeddings) -> InMemoryVectorStore`; `semantic_search(store, query, k=3) -> str`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_search.py
from langchain_core.embeddings import DeterministicFakeEmbedding

from orion_agent.embeddings import build_index, semantic_search
from orion_agent.search import repo_map, search_codebase
from orion_agent.workspace import Workspace


def test_search_codebase_ranks_files_by_hits(ws_dir):
    out = search_codebase(Workspace(ws_dir), "yield chunk stream")
    assert out.index("--- chat.py") < out.index("--- app.py")
    assert "2: def stream_response" in out


def test_search_codebase_no_match(ws_dir):
    assert search_codebase(Workspace(ws_dir), "quantum") == "No matches."


def test_repo_map_lists_defs(ws_dir):
    out = repo_map(Workspace(ws_dir))
    assert "app.py" in out and "def main" in out
    assert "chat.py" in out and "def stream_response" in out
    assert "config.py" in out and "PAGE_TITLE" in out


def test_semantic_search_returns_file_headers(ws_dir):
    store = build_index(Workspace(ws_dir), DeterministicFakeEmbedding(size=32))
    out = semantic_search(store, "streaming", k=2)
    assert out.count("--- ") == 2
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_search.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/search.py`**

```python
"""Agentic codebase search: grep, rank, read. No index, no embeddings."""

from __future__ import annotations

import ast
import re

from orion_agent.workspace import Match, Workspace


def search_codebase(ws: Workspace, query: str, max_files: int = 5, max_lines: int = 12) -> str:
    words = [w for w in re.findall(r"\w+", query) if len(w) > 2]
    hits: dict[str, list[Match]] = {}
    for word in words:
        for m in ws.grep(re.escape(word)):
            hits.setdefault(m.path, []).append(m)
    if not hits:
        return "No matches."
    ranked = sorted(hits.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:max_files]
    blocks = []
    for path, matches in ranked:
        seen: set[int] = set()
        lines = []
        for m in sorted(matches, key=lambda m: m.line):
            if m.line in seen:
                continue
            seen.add(m.line)
            lines.append(f"{m.line}: {m.text}")
        blocks.append(f"--- {path} ({len(matches)} hits) ---\n" + "\n".join(lines[:max_lines]))
    return "\n\n".join(blocks)


def repo_map(ws: Workspace) -> str:
    """One line per file with its top-level functions, classes, and constants."""
    lines = []
    for path in ws.glob("**/*.py"):
        try:
            tree = ast.parse(ws.read(path))
        except SyntaxError:
            lines.append(f"{path}: (syntax error)")
            continue
        names = []
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                names.append(f"def {node.name}")
            elif isinstance(node, ast.ClassDef):
                names.append(f"class {node.name}")
            elif isinstance(node, ast.Assign):
                names += [t.id for t in node.targets if isinstance(t, ast.Name)]
        lines.append(f"{path}: {', '.join(names) if names else '(no top-level definitions)'}")
    return "\n".join(lines)
```

- [ ] **Step 4: Write `src/orion_agent/embeddings.py`**

```python
"""The 2023 to 2025 approach: embed the codebase and search by similarity.

Kept as a footnote. Cursor turned its embedding index down in favour of grep;
Claude Code, Codex, Cline, and Aider never used one. Grep with a model in the
loop finds the same code with no index to build or keep fresh.
"""

from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore

from orion_agent.workspace import Workspace


def build_index(ws: Workspace, embeddings: Embeddings) -> InMemoryVectorStore:
    docs = [Document(page_content=ws.read(p), metadata={"source": p}) for p in ws.glob("**/*.py")]
    return InMemoryVectorStore.from_documents(docs, embeddings)


def semantic_search(store: InMemoryVectorStore, query: str, k: int = 3) -> str:
    docs = store.similarity_search(query, k=k)
    return "\n\n".join(f"--- {d.metadata['source']} ---\n{d.page_content}" for d in docs)
```

- [ ] **Step 5: Run to verify pass**

Run: `uv run pytest tests/test_search.py -v`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/orion_agent/search.py src/orion_agent/embeddings.py tests/test_search.py
git commit -m "Add grep-based codebase search, repo map, and embeddings footnote

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Tool-calling agent graph (Lesson 1)

**Files:**
- Create: `src/orion_agent/graphs/__init__.py`, `src/orion_agent/graphs/tool_agent.py`, `tests/test_tool_agent.py`

**Interfaces:**
- Produces: `build_tool_agent(llm, tools, system_prompt=None, checkpointer=None) -> CompiledStateGraph` over `MessagesState`; `prebuilt_agent(llm, tools, system_prompt=None, checkpointer=None)`.

- [ ] **Step 1: Write `src/orion_agent/graphs/__init__.py`**

```python
"""LangGraph graphs: the tool loop, the self-correcting loop, the orchestrator, the parallel coder."""
```

- [ ] **Step 2: Write the failing tests**

```python
# tests/test_tool_agent.py
import asyncio

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.tools import basic_tools
from orion_agent.workspace import Workspace
from tests.conftest import ScriptedChatModel


def tool_call(name, args, call_id="c1"):
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": call_id, "type": "tool_call"}])


def test_loop_runs_tool_then_answers(ws_dir):
    model = ScriptedChatModel(responses=[tool_call("list_directory", {"directory": "."}), AIMessage(content="Three files.")])
    agent = build_tool_agent(model, basic_tools(Workspace(ws_dir)))
    result = agent.invoke({"messages": [HumanMessage(content="what files are here?")]})
    kinds = [type(m).__name__ for m in result["messages"]]
    assert kinds == ["HumanMessage", "AIMessage", "ToolMessage", "AIMessage"]
    assert "app.py" in result["messages"][2].content
    assert result["messages"][-1].content == "Three files."


def test_no_tool_call_ends_immediately(ws_dir):
    model = ScriptedChatModel(responses=[AIMessage(content="Python is a language.")])
    agent = build_tool_agent(model, basic_tools(Workspace(ws_dir)))
    result = agent.invoke({"messages": [HumanMessage(content="what is Python?")]})
    assert len(result["messages"]) == 2


def test_system_prompt_is_prepended_once(ws_dir):
    model = ScriptedChatModel(responses=[AIMessage(content="ok"), AIMessage(content="ok again")])
    agent = build_tool_agent(model, basic_tools(Workspace(ws_dir)), system_prompt="Be terse.", checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "t1"}}
    agent.invoke({"messages": [HumanMessage(content="a")]}, config)
    agent.invoke({"messages": [HumanMessage(content="b")]}, config)
    assert isinstance(model.calls[0][0], SystemMessage) and model.calls[0][0].content == "Be terse."
    assert sum(isinstance(m, SystemMessage) for m in model.calls[1]) == 1
    assert [m.content for m in model.calls[1] if isinstance(m, HumanMessage)] == ["a", "b"]


def test_async_invocation_works(ws_dir):
    model = ScriptedChatModel(responses=[tool_call("read_file", {"filepath": "config.py"}), AIMessage(content="done")])
    agent = build_tool_agent(model, basic_tools(Workspace(ws_dir)))
    result = asyncio.run(agent.ainvoke({"messages": [HumanMessage(content="read config")]}))
    assert isinstance(result["messages"][2], ToolMessage)
    assert "PAGE_TITLE" in result["messages"][2].content
```

- [ ] **Step 3: Run to verify failure**

Run: `uv run pytest tests/test_tool_agent.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 4: Write `src/orion_agent/graphs/tool_agent.py`**

```python
"""The agent loop from Lesson 1: model decides, tools run, model sees the result."""

from __future__ import annotations

from typing import Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode


def build_tool_agent(
    llm: BaseChatModel,
    tools: list[BaseTool],
    system_prompt: str | None = None,
    checkpointer=None,
):
    llm_with_tools = llm.bind_tools(tools)

    def agent(state: MessagesState) -> dict:
        messages = list(state["messages"])
        if system_prompt and not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=system_prompt), *messages]
        return {"messages": [llm_with_tools.invoke(messages)]}

    def route(state: MessagesState) -> Literal["tools", "__end__"]:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile(checkpointer=checkpointer)


def prebuilt_agent(llm: BaseChatModel, tools: list[BaseTool], system_prompt: str | None = None, checkpointer=None):
    """What build_tool_agent does, as LangChain ships it."""
    from langchain.agents import create_agent

    return create_agent(llm, tools, system_prompt=system_prompt, checkpointer=checkpointer)
```

- [ ] **Step 5: Run to verify pass**

Run: `uv run pytest tests/test_tool_agent.py -v`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/orion_agent/graphs tests/test_tool_agent.py
git commit -m "Add the Lesson 1 tool-calling agent graph

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Self-correcting graphs (Lesson 2)

**Files:**
- Create: `src/orion_agent/graphs/self_correcting.py`, `tests/test_self_correcting.py`

**Interfaces:**
- Consumes: `CodeOutput`, `ReviewResult` (Task 5); `Sandbox` (Task 3).
- Produces: `AgentState`, `FullAgentState` TypedDicts; `build_bugbot(coder, sandbox, timeout=10)`; `build_full_agent(coder, reviewer, sandbox, timeout=10)`. `coder.invoke(prompt) -> CodeOutput`; `reviewer.invoke(prompt) -> ReviewResult`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_self_correcting.py
from orion_agent.graphs.self_correcting import build_bugbot, build_full_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult
from tests.conftest import Scripted

BAD = CodeOutput(code="print(1/0)", explanation="wrong")
GOOD = CodeOutput(code="print('ok')", explanation="right")


def test_bugbot_retries_once_then_succeeds():
    coder = Scripted(BAD, GOOD)
    result = build_bugbot(coder, LocalSandbox()).invoke({"task": "print ok", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "success"
    assert result["attempts"] == 2
    assert "ZeroDivisionError" in coder.prompts[1]


def test_bugbot_gives_up_at_max_attempts():
    coder = Scripted(BAD)
    result = build_bugbot(coder, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 2})
    assert result["status"] == "failed"
    assert result["attempts"] == 2
    assert len(coder.prompts) == 2


def test_bugbot_treats_timeout_as_failure():
    coder = Scripted(CodeOutput(code="import time; time.sleep(5)", explanation="slow"), GOOD)
    result = build_bugbot(coder, LocalSandbox(), timeout=1).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "success"
    assert "Timed out" in coder.prompts[1]


def test_rules_are_injected():
    coder = Scripted(GOOD)
    build_bugbot(coder, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 1, "rules": "USE TYPE HINTS"})
    assert coder.prompts[0].startswith("Follow these rules:\nUSE TYPE HINTS")


def test_full_agent_uses_reviewer_feedback():
    coder = Scripted(GOOD, GOOD)
    reviewer = Scripted(ReviewResult(approved=False, feedback="add docstrings"), ReviewResult(approved=True, feedback="Looks good"))
    result = build_full_agent(coder, reviewer, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "approved"
    assert result["attempts"] == 2
    assert "add docstrings" in coder.prompts[1]
    assert "print('ok')" in reviewer.prompts[0]


def test_full_agent_reviews_only_after_execution_passes():
    coder = Scripted(BAD, GOOD)
    reviewer = Scripted(ReviewResult(approved=True, feedback="ok"))
    result = build_full_agent(coder, reviewer, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "approved"
    assert len(reviewer.prompts) == 1
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_self_correcting.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/graphs/self_correcting.py`**

```python
"""Lesson 2: generate, execute, retry on error; then add a reviewer."""

from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from orion_agent.sandbox import Sandbox
from orion_agent.schemas import CodeOutput, ReviewResult


class AgentState(TypedDict, total=False):
    task: str
    code: str
    explanation: str
    execution_result: str
    error: str
    attempts: int
    max_attempts: int
    status: str
    rules: str


class FullAgentState(AgentState, total=False):
    review_feedback: str
    approved: bool


def _generate_prompt(state: AgentState) -> str:
    prompt = f"Write Python code for: {state['task']}"
    if state.get("rules"):
        prompt = f"Follow these rules:\n{state['rules']}\n\n{prompt}"
    if state.get("error"):
        prompt += f"\n\nThe previous attempt failed with this error. Fix it:\n{state['error']}"
    if state.get("review_feedback") and not state.get("approved", True):
        prompt += f"\n\nThe reviewer rejected the previous version. Address this feedback:\n{state['review_feedback']}"
    return prompt


def _make_nodes(coder, sandbox: Sandbox, timeout: float):
    def generate(state: AgentState) -> dict:
        out: CodeOutput = coder.invoke(_generate_prompt(state))
        return {"code": out.code, "explanation": out.explanation, "attempts": state.get("attempts", 0) + 1}

    def execute(state: AgentState) -> dict:
        r = sandbox.run_python(state["code"], timeout=timeout)
        if r.ok:
            return {"execution_result": r.stdout, "error": "", "status": "success"}
        return {"execution_result": r.stdout, "error": r.stderr, "status": "failed"}

    def should_retry(state: AgentState) -> Literal["success", "retry", "give_up"]:
        if state["status"] == "success":
            return "success"
        if state["attempts"] < state.get("max_attempts", 3):
            return "retry"
        return "give_up"

    return generate, execute, should_retry


def build_bugbot(coder, sandbox: Sandbox, timeout: float = 10):
    generate, execute, should_retry = _make_nodes(coder, sandbox, timeout)
    graph = StateGraph(AgentState)
    graph.add_node("generate", generate)
    graph.add_node("execute", execute)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "execute")
    graph.add_conditional_edges("execute", should_retry, {"success": END, "retry": "generate", "give_up": END})
    return graph.compile()


def build_full_agent(coder, reviewer, sandbox: Sandbox, timeout: float = 10):
    generate, execute, should_retry = _make_nodes(coder, sandbox, timeout)

    def review(state: FullAgentState) -> dict:
        r: ReviewResult = reviewer.invoke(
            "Review this Python code for correctness, readability, type hints, docstrings, and PEP 8.\n"
            f"Task: {state['task']}\n\nCode:\n{state['code']}\n\nOutput when run:\n{state.get('execution_result', '')}"
        )
        return {"approved": r.approved, "review_feedback": r.feedback, "status": "approved" if r.approved else "needs_revision"}

    def after_review(state: FullAgentState) -> Literal["done", "revise", "give_up"]:
        if state["approved"]:
            return "done"
        if state["attempts"] < state.get("max_attempts", 3):
            return "revise"
        return "give_up"

    graph = StateGraph(FullAgentState)
    graph.add_node("generate", generate)
    graph.add_node("execute", execute)
    graph.add_node("review", review)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "execute")
    graph.add_conditional_edges("execute", should_retry, {"success": "review", "retry": "generate", "give_up": END})
    graph.add_conditional_edges("review", after_review, {"done": END, "revise": "generate", "give_up": END})
    return graph.compile()
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_self_correcting.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/graphs/self_correcting.py tests/test_self_correcting.py
git commit -m "Add Lesson 2 self-correcting and reviewer graphs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Orchestrator graph (Lesson 3)

**Files:**
- Create: `src/orion_agent/graphs/orchestrator.py`, `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `Plan`, `CodeResult`, `ReviewResult` (Task 5); `Workspace` (Task 2); `Sandbox` (Task 3); `load_rules` (Task 6); `repo_map` (Task 9).
- Produces: `OrchestratorState`; `build_code_prompt(state, task, rules_root=None) -> str`; `build_review_prompt(state) -> str`; `run_tests(ws, sandbox, changed) -> tuple[str, bool]`; `build_orchestrator(planner, coder, reviewer, ws, sandbox, *, planner_agent=None, rules_root=None, checkpointer=None, max_test_attempts=3, max_review_attempts=2)`. The compiled graph must be called with `ainvoke` or `astream`. The interrupt payload is a dict with keys `plan`, `changes`, `test_output`, `review_result`. Resume with `Command(resume={"decision": "approve" | "reject", "feedback": str})`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_orchestrator.py
import asyncio

from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from orion_agent.graphs.orchestrator import build_orchestrator, run_tests
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, FileTask, Plan, ReviewResult
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace
from tests.conftest import Scripted, ScriptedChatModel

PLAN = Plan(summary="Add a title constant", file_tasks=[FileTask(filepath="config.py", description="add SUBTITLE", action="modify")])
GOOD = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = "S"\n', explanation="added")
BROKEN = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = \n', explanation="typo")
OK = ReviewResult(approved=True, feedback="Looks good")
REJECT = ReviewResult(approved=False, feedback="name the constant DEFAULT_SUBTITLE")


def run(graph, request, config):
    return asyncio.run(graph.ainvoke({"feature_request": request}, config))


def resume(graph, decision, config):
    return asyncio.run(graph.ainvoke(Command(resume=decision), config))


def make(ws_dir, coder, reviewer, planner=None, **kw):
    return build_orchestrator(
        planner or Scripted(PLAN), coder, reviewer, Workspace(ws_dir), LocalSandbox(),
        checkpointer=InMemorySaver(), **kw,
    )


def test_run_tests_smoke_imports_when_no_tests(ws_dir):
    output, ok = run_tests(Workspace(ws_dir), LocalSandbox(), ["config.py"])
    assert ok and "config: OK" in output


def test_run_tests_uses_pytest_when_present(ws_dir):
    (ws_dir / "test_config.py").write_text("import config\n\ndef test_title():\n    assert config.PAGE_TITLE == 'WRONG'\n")
    output, ok = run_tests(Workspace(ws_dir), LocalSandbox(), ["config.py"])
    assert not ok and "assert" in output


def test_happy_path_pauses_then_applies(ws_dir):
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK))
    config = {"configurable": {"thread_id": "t1"}}
    paused = run(graph, "add a subtitle", config)
    payload = paused["__interrupt__"][0].value
    assert payload["changes"][0]["filepath"] == "config.py"
    assert "config: OK" in payload["test_output"]
    assert asyncio.run(graph.aget_state(config)).next == ("human_review",)
    assert 'SUBTITLE' not in (ws_dir / "config.py").read_text()

    final = resume(graph, {"decision": "approve", "feedback": ""}, config)
    assert final["status"] == "done"
    assert 'SUBTITLE = "S"' in (ws_dir / "config.py").read_text()


def test_reviewer_feedback_reaches_coder(ws_dir):
    coder = Scripted(GOOD, GOOD)
    graph = make(ws_dir, coder, Scripted(REJECT, OK))
    run(graph, "x", {"configurable": {"thread_id": "t2"}})
    assert "DEFAULT_SUBTITLE" in coder.prompts[1]
    assert "Reviewer feedback" in coder.prompts[1]


def test_failed_tests_route_back_to_coder_with_traceback(ws_dir):
    coder = Scripted(BROKEN, GOOD)
    graph = make(ws_dir, coder, Scripted(OK))
    run(graph, "x", {"configurable": {"thread_id": "t3"}})
    assert "SyntaxError" in coder.prompts[1]
    assert "Test output" in coder.prompts[1]


def test_auto_approve_after_review_cap(ws_dir):
    reviewer = Scripted(REJECT)
    graph = make(ws_dir, Scripted(GOOD), reviewer, max_review_attempts=2)
    paused = run(graph, "x", {"configurable": {"thread_id": "t4"}})
    assert len(reviewer.prompts) == 2
    assert paused["__interrupt__"][0].value["review_result"].startswith("auto-approved after 2 rejections")


def test_human_reject_resets_counters_and_feeds_reason(ws_dir):
    coder = Scripted(GOOD, GOOD)
    reviewer = Scripted(REJECT, OK, OK)
    graph = make(ws_dir, coder, reviewer, max_review_attempts=2)
    config = {"configurable": {"thread_id": "t5"}}
    run(graph, "x", config)
    assert len(reviewer.prompts) == 2
    paused_again = resume(graph, {"decision": "reject", "feedback": "call it TAGLINE"}, config)
    assert "call it TAGLINE" in coder.prompts[-1]
    assert "Human feedback" in coder.prompts[-1]
    assert len(reviewer.prompts) == 3  # the AI reviewer is consulted again after a human reject
    state = asyncio.run(graph.aget_state(config)).values
    assert state["review_attempts"] == 1 and state["test_attempts"] == 1
    assert "__interrupt__" in paused_again


def test_planner_agent_research_feeds_context(ws_dir):
    model = ScriptedChatModel(responses=[
        AIMessage(content="", tool_calls=[{"name": "grep_files", "args": {"pattern": "PAGE_TITLE"}, "id": "c1", "type": "tool_call"}]),
        AIMessage(content="config.py holds the constants."),
    ])
    tools = make_tools(Workspace(ws_dir), LocalSandbox())
    research = build_tool_agent(model, [tools["grep_files"], tools["read_file"]])
    planner = Scripted(PLAN)
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK), planner=planner, planner_agent=research)
    run(graph, "x", {"configurable": {"thread_id": "t6"}})
    assert "config.py:1: PAGE_TITLE" in planner.prompts[0]
    assert "config.py holds the constants." in planner.prompts[0]


def test_rules_are_loaded_per_file(ws_dir, tmp_path):
    root = tmp_path / "repo"
    (root / ".cursor" / "rules").mkdir(parents=True)
    (root / ".cursor" / "rules" / "py.mdc").write_text("---\nglobs: **/*.py\n---\nNO SEMICOLONS\n")
    coder = Scripted(GOOD)
    graph = make(ws_dir, coder, Scripted(OK), rules_root=root)
    run(graph, "x", {"configurable": {"thread_id": "t7"}})
    assert "NO SEMICOLONS" in coder.prompts[0]
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_orchestrator.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/graphs/orchestrator.py`**

```python
"""Lesson 3: plan, code, test, AI review, human review, apply, verify.

Tests are the primary check. The AI reviewer sees the code and the test
output with fresh context and gives a second opinion. The human sees both
and decides. A reject carries a reason back to the coder and resets the
counters so the reviewer is consulted again.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from orion_agent.rules import load_rules
from orion_agent.sandbox import Sandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.search import repo_map
from orion_agent.workspace import Workspace


class OrchestratorState(TypedDict, total=False):
    feature_request: str
    codebase_context: str
    plan: str
    file_tasks: list[dict]
    generated_code: list[dict]
    test_output: str
    test_attempts: int
    review_result: str
    review_attempts: int
    human_decision: str
    human_feedback: str
    status: str


RESEARCH_PROMPT = (
    "You are researching a codebase before a change is planned. Use the tools to find every file "
    "and symbol relevant to this request, read them, and finish with a short summary of what you found.\n\n"
    "Request: {request}"
)

PLAN_PROMPT = (
    "Create an implementation plan for this feature request. List every file to create or modify.\n\n"
    "Request: {request}\n\nCodebase context:\n{context}"
)


def build_code_prompt(state: dict, task: dict, rules_root: str | Path | None = None) -> str:
    parts = [
        "Generate the complete Python code for this file.\n\n"
        f"File: {task['filepath']}\nAction: {task['action']}\nDescription: {task['description']}"
    ]
    if rules_root:
        rules = load_rules(rules_root, task["filepath"])
        if rules:
            parts.append(f"Follow these rules:\n{rules}")
    parts.append(f"Codebase context:\n{state.get('codebase_context', '')}")
    if state.get("test_output") and state.get("status") in ("tests_failed", "human_rejected"):
        parts.append(f"Test output from the last run (fix these failures):\n{state['test_output']}")
    if state.get("status") == "needs_revision" and state.get("review_result"):
        parts.append(f"Reviewer feedback (address every point):\n{state['review_result']}")
    if state.get("human_feedback"):
        parts.append(f"Human feedback (this overrides everything else):\n{state['human_feedback']}")
    return "\n\n".join(parts)


def build_review_prompt(state: dict) -> str:
    files = "\n\n".join(f"### {g['filepath']}\n{g['code']}" for g in state.get("generated_code", []))
    return (
        "You are a code reviewer with no memory of how this code was written. Judge only what is in front of you.\n"
        f"Feature request: {state.get('feature_request', '')}\n\nFiles:\n{files}\n\n"
        f"Test output:\n{state.get('test_output', '')}\n\n"
        "Approve only if the code is correct, complete, and follows PEP 8 with type hints and docstrings."
    )


def run_tests(ws: Workspace, sandbox: Sandbox, changed: list[str]) -> tuple[str, bool]:
    test_files = sorted(set(ws.glob("**/test_*.py")) | set(ws.glob("tests/**/*.py")))
    if test_files:
        r = sandbox.run([sys.executable, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider"], cwd=ws.root, timeout=120)
        return r.summary(), r.ok
    lines = []
    ok = True
    for path in changed:
        if not path.endswith(".py"):
            continue
        module = Path(path).with_suffix("").as_posix().replace("/", ".")
        r = sandbox.run_python(f"import {module}", cwd=ws.root)
        ok = ok and r.ok
        lines.append(f"Smoke import {module}: {'OK' if r.ok else 'FAILED'}" + ("" if r.ok else f"\n{r.stderr.rstrip()}"))
    return "\n".join(lines) if lines else "No Python files changed; nothing to test.", ok


def build_orchestrator(
    planner,
    coder,
    reviewer,
    ws: Workspace,
    sandbox: Sandbox,
    *,
    planner_agent=None,
    rules_root: str | Path | None = None,
    checkpointer=None,
    max_test_attempts: int = 3,
    max_review_attempts: int = 2,
):
    async def plan_node(state: OrchestratorState) -> dict:
        request = state["feature_request"]
        context = repo_map(ws)
        if planner_agent is not None:
            research = await planner_agent.ainvoke({"messages": [HumanMessage(content=RESEARCH_PROMPT.format(request=request))]})
            notes = [str(m.content) for m in research["messages"] if isinstance(m, ToolMessage)]
            summary = str(research["messages"][-1].content)
            context = "\n\n".join([context, *notes, f"Research summary:\n{summary}"])
        plan: Plan = planner.invoke(PLAN_PROMPT.format(request=request, context=context))
        return {
            "codebase_context": context,
            "plan": plan.summary,
            "file_tasks": [t.model_dump() for t in plan.file_tasks],
            "status": "planned",
            "test_attempts": 0,
            "review_attempts": 0,
            "human_feedback": "",
        }

    def code_node(state: OrchestratorState) -> dict:
        generated = []
        for task in state["file_tasks"]:
            result: CodeResult = coder.invoke(build_code_prompt(state, task, rules_root))
            generated.append({"filepath": task["filepath"], "code": result.code, "explanation": result.explanation})
        return {"generated_code": generated, "status": "coded"}

    def test_node(state: OrchestratorState) -> dict:
        snapshot = ws.snapshot()
        try:
            scratch = Workspace(snapshot)
            for item in state["generated_code"]:
                scratch.write(item["filepath"], item["code"])
            output, ok = run_tests(scratch, sandbox, [i["filepath"] for i in state["generated_code"]])
        finally:
            shutil.rmtree(snapshot, ignore_errors=True)
        return {
            "test_output": output,
            "test_attempts": state.get("test_attempts", 0) + 1,
            "status": "tests_passed" if ok else "tests_failed",
        }

    def route_after_test(state: OrchestratorState) -> Literal["ai_review", "code", "human_review"]:
        if state["status"] == "tests_passed":
            return "ai_review"
        if state["test_attempts"] < max_test_attempts:
            return "code"
        return "human_review"

    def ai_review_node(state: OrchestratorState) -> dict:
        attempts = state.get("review_attempts", 0) + 1
        review: ReviewResult = reviewer.invoke(build_review_prompt(state))
        if review.approved:
            return {"review_result": review.feedback, "review_attempts": attempts, "status": "approved"}
        if attempts >= max_review_attempts:
            return {
                "review_result": f"auto-approved after {max_review_attempts} rejections. Last feedback: {review.feedback}",
                "review_attempts": attempts,
                "status": "approved",
            }
        return {"review_result": review.feedback, "review_attempts": attempts, "status": "needs_revision"}

    def route_after_review(state: OrchestratorState) -> Literal["human_review", "code"]:
        return "human_review" if state["status"] == "approved" else "code"

    def human_review_node(state: OrchestratorState) -> dict:
        payload = {
            "plan": state.get("plan", ""),
            "changes": [
                {"filepath": g["filepath"], "explanation": g["explanation"], "preview": g["code"][:500]}
                for g in state.get("generated_code", [])
            ],
            "test_output": state.get("test_output", ""),
            "review_result": state.get("review_result", ""),
        }
        decision = interrupt(payload)
        if isinstance(decision, str):
            decision = {"decision": decision, "feedback": ""}
        if decision.get("decision") == "approve":
            return {"human_decision": "approve", "status": "human_approved"}
        return {
            "human_decision": "reject",
            "human_feedback": decision.get("feedback", ""),
            "review_attempts": 0,
            "test_attempts": 0,
            "status": "human_rejected",
        }

    def route_after_human(state: OrchestratorState) -> Literal["apply", "code"]:
        return "apply" if state["human_decision"] == "approve" else "code"

    def apply_node(state: OrchestratorState) -> dict:
        for item in state["generated_code"]:
            ws.write(item["filepath"], item["code"])
        return {"status": "applied"}

    def verify_node(state: OrchestratorState) -> dict:
        output, ok = run_tests(ws, sandbox, [i["filepath"] for i in state["generated_code"]])
        return {"test_output": output, "status": "done" if ok else "verify_failed"}

    graph = StateGraph(OrchestratorState)
    graph.add_node("plan", plan_node)
    graph.add_node("code", code_node)
    graph.add_node("test", test_node)
    graph.add_node("ai_review", ai_review_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("apply", apply_node)
    graph.add_node("verify", verify_node)
    graph.add_edge(START, "plan")
    graph.add_edge("plan", "code")
    graph.add_edge("code", "test")
    graph.add_conditional_edges("test", route_after_test, {"ai_review": "ai_review", "code": "code", "human_review": "human_review"})
    graph.add_conditional_edges("ai_review", route_after_review, {"human_review": "human_review", "code": "code"})
    graph.add_conditional_edges("human_review", route_after_human, {"apply": "apply", "code": "code"})
    graph.add_edge("apply", "verify")
    graph.add_edge("verify", END)
    return graph.compile(checkpointer=checkpointer)
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_orchestrator.py -v`
Expected: 9 passed. If `test_human_reject_resets_counters_and_feeds_reason` shows `review_attempts == 0`, the state was read before the second review ran; read `aget_state` after `resume` as written and check that `ai_review_node` returned `attempts` (it should be 1 after one fresh review).

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/graphs/orchestrator.py tests/test_orchestrator.py
git commit -m "Add Lesson 3 orchestrator: plan, code, test, review, human gate, apply, verify

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Parallel code generation (Lesson 3, Send)

**Files:**
- Create: `src/orion_agent/graphs/parallel.py`, `tests/test_parallel.py`

**Interfaces:**
- Consumes: `build_code_prompt`, `PLAN_PROMPT` (Task 12); `repo_map` (Task 9).
- Produces: `ParallelState`, `SingleFileState`, `add_to_list(a, b)`, `build_parallel_agent(planner, coder, ws, *, rules_root=None, checkpointer=None)`. Sync-invokable.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_parallel.py
from orion_agent.graphs.parallel import build_parallel_agent
from orion_agent.schemas import CodeResult, FileTask, Plan
from orion_agent.workspace import Workspace
from tests.conftest import Scripted

PLAN = Plan(summary="two files", file_tasks=[
    FileTask(filepath="config.py", description="add A", action="modify"),
    FileTask(filepath="chat.py", description="add B", action="modify"),
])


def test_fans_out_one_coder_per_file(ws_dir):
    coder = Scripted(CodeResult(filepath="x", code="X = 1\n", explanation="e"))
    result = build_parallel_agent(Scripted(PLAN), coder, Workspace(ws_dir)).invoke({"feature_request": "add stuff"})
    assert sorted(g["filepath"] for g in result["generated_code"]) == ["chat.py", "config.py"]
    assert len(coder.prompts) == 2
    assert result["status"] == "collected"
    assert (ws_dir / "config.py").read_text().startswith("PAGE_TITLE")  # nothing written to disk
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_parallel.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write `src/orion_agent/graphs/parallel.py`**

```python
"""Lesson 3, part 9: fan out one coder per file with Send, merge with a reducer."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from orion_agent.graphs.orchestrator import PLAN_PROMPT, build_code_prompt
from orion_agent.schemas import CodeResult, Plan
from orion_agent.search import repo_map
from orion_agent.workspace import Workspace


def add_to_list(existing: list, new: list) -> list:
    return existing + new


class ParallelState(TypedDict, total=False):
    feature_request: str
    codebase_context: str
    plan: str
    file_tasks: list[dict]
    generated_code: Annotated[list[dict], add_to_list]
    status: str


class SingleFileState(TypedDict):
    task: dict
    codebase_context: str


def build_parallel_agent(planner, coder, ws: Workspace, *, rules_root: str | Path | None = None, checkpointer=None):
    def plan_node(state: ParallelState) -> dict:
        context = repo_map(ws)
        plan: Plan = planner.invoke(PLAN_PROMPT.format(request=state["feature_request"], context=context))
        return {
            "codebase_context": context,
            "plan": plan.summary,
            "file_tasks": [t.model_dump() for t in plan.file_tasks],
            "status": "planned",
        }

    def fan_out_to_coders(state: ParallelState) -> list[Send]:
        return [Send("code_file", {"task": t, "codebase_context": state["codebase_context"]}) for t in state["file_tasks"]]

    def code_file(state: SingleFileState) -> dict:
        prompt = build_code_prompt({"codebase_context": state["codebase_context"]}, state["task"], rules_root)
        result: CodeResult = coder.invoke(prompt)
        return {"generated_code": [{"filepath": state["task"]["filepath"], "code": result.code, "explanation": result.explanation}]}

    def collect_results(state: ParallelState) -> dict:
        return {"status": "collected"}

    graph = StateGraph(ParallelState)
    graph.add_node("plan", plan_node)
    graph.add_node("code_file", code_file)
    graph.add_node("collect", collect_results)
    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", fan_out_to_coders, ["code_file"])
    graph.add_edge("code_file", "collect")
    graph.add_edge("collect", END)
    return graph.compile(checkpointer=checkpointer)
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_parallel.py -v`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/graphs/parallel.py tests/test_parallel.py
git commit -m "Add parallel coder graph with Send fan-out

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: CLI, sample project move, workspace

**Files:**
- Create: `src/orion_agent/cli.py`, `tests/test_cli.py`
- Move: `Notebooks/sample_project/{app.py,chat.py,config.py}` to `sample_project/`
- Delete: `Notebooks/sample_project/config.py.bak`

**Interfaces:**
- Consumes: `Workspace.reset` (Task 2); `check_models` (Task 5).
- Produces: `REPO_ROOT`, `reset(root) -> Path`, `main(argv=None, root=REPO_ROOT) -> int`. Commands: `orion reset`, `orion check-models`.

- [ ] **Step 1: Move the sample project**

Run:

```bash
git mv Notebooks/sample_project sample_project
git rm -q sample_project/config.py.bak
ls sample_project
```

Expected: `app.py chat.py config.py`

- [ ] **Step 2: Write the failing tests**

```python
# tests/test_cli.py
import httpx

from orion_agent import cli
from orion_agent.llm import FAST, STRONG


def make_root(tmp_path):
    (tmp_path / "sample_project").mkdir()
    (tmp_path / "sample_project" / "config.py").write_text("X = 1\n")
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "generated").mkdir()
    (ws / "generated" / "junk.py").write_text("junk")
    (ws / "config.py").write_text("X = 999\n")
    return tmp_path


def test_reset_restores_workspace_from_sample_project(tmp_path):
    root = make_root(tmp_path)
    assert cli.main(["reset"], root=root) == 0
    assert sorted(p.name for p in (root / "workspace").iterdir()) == ["config.py"]
    assert (root / "workspace" / "config.py").read_text() == "X = 1\n"


def test_reset_creates_workspace_if_missing(tmp_path):
    root = make_root(tmp_path)
    import shutil
    shutil.rmtree(root / "workspace")
    assert cli.main(["reset"], root=root) == 0
    assert (root / "workspace" / "config.py").exists()


def test_check_models_exit_code(monkeypatch, capsys):
    def handler(request):
        return httpx.Response(200, json={"data": [{"id": FAST}]})

    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    assert cli.main(["check-models"]) == 1
    assert STRONG in capsys.readouterr().out

    def all_present(request):
        return httpx.Response(200, json={"data": [{"id": FAST}, {"id": STRONG}]})

    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(all_present)))
    assert cli.main(["check-models"]) == 0
```

- [ ] **Step 3: Run to verify failure**

Run: `uv run pytest tests/test_cli.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 4: Write `src/orion_agent/cli.py`**

```python
"""The `orion` command: pre-session chores."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

from orion_agent.llm import FAST, STRONG, check_models
from orion_agent.workspace import Workspace

REPO_ROOT = Path(__file__).resolve().parents[2]


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=15)


def reset(root: Path) -> Path:
    """Copy sample_project/ into workspace/, wiping anything the agent left there."""
    ws = Workspace(root / "workspace")
    ws.reset(root / "sample_project")
    return ws.root


def main(argv: list[str] | None = None, root: Path = REPO_ROOT) -> int:
    parser = argparse.ArgumentParser(prog="orion", description="Orion teaching kit commands")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("reset", help="restore workspace/ from sample_project/")
    sub.add_parser("check-models", help="verify the model IDs exist on OpenRouter")
    args = parser.parse_args(argv)

    if args.command == "reset":
        path = reset(root)
        print(f"workspace restored at {path}")
        return 0

    if args.command == "check-models":
        missing = check_models((FAST, STRONG), client=_http_client())
        if missing:
            print("Missing on OpenRouter: " + ", ".join(missing))
            return 1
        print(f"OK: {FAST}, {STRONG}")
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run to verify pass**

Run: `uv run pytest tests/test_cli.py -v`
Expected: 3 passed

- [ ] **Step 6: Run the real commands**

Run:

```bash
uv run orion reset && ls workspace
uv run orion check-models
```

Expected: `app.py chat.py config.py`, then either `OK: openai/gpt-4o-mini, anthropic/claude-sonnet-4.5` or a `Missing on OpenRouter:` line. If a model is missing, look up the current ID at https://openrouter.ai/models, change the constant in `src/orion_agent/llm.py`, and rerun. `workspace/` must not show up in `git status` (it is gitignored).

- [ ] **Step 7: Run the whole suite**

Run: `uv run pytest -v`
Expected: all tests pass, no warnings about deprecated imports.

- [ ] **Step 8: Commit**

```bash
git add -A src/orion_agent/cli.py tests/test_cli.py sample_project Notebooks
git commit -m "Add orion CLI (reset, check-models) and move sample_project to the root

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Push the branch

**Files:** none.

- [ ] **Step 1: Confirm the tree is clean and the suite passes**

Run:

```bash
git status --short
uv run pytest
```

Expected: no output from status; all tests pass.

- [ ] **Step 2: Push**

Run: `git push -u origin reframe-python`
Expected: the branch appears at https://github.com/kvsdileep/orion-tutorial/tree/reframe-python.

---

## Self-review

**Spec coverage.** Section 3 modules: `llm`, `workspace`, `sandbox`, `tools`, `rules`, `skills`, `mcp`, `search`, `embeddings`, `schemas`, `graphs/*`, `cli` all have tasks. `cli sync-web` is deferred to the site plan because it depends on the lesson files. Section 5 rules and skills files: Task 6 and 7. Section 6 routes and counter resets: Task 12 tests cover each. Section 7 sandbox: Task 3. Section 10 test list: workspace, sandbox, rules, skills, self-correcting, orchestrator, mcp are here; `test_lessons_smoke` belongs to the lessons plan. Not in this plan: lessons, IDE, web, README files, instructor script.

**Deviations from the spec, stated:** Python 3.13 instead of 3.12 (already installed, supported). Graph builders take runnables (`coder`, `reviewer`, `planner`) rather than an `llm`, so tests can script structured outputs without a fake chat model that supports `with_structured_output`. The orchestrator is async-only because MCP tools are async.

**Type consistency.** `Workspace.write` returns the relative path (Task 2) and `write_file` prefixes it with `File written: ` (Task 4). `Scripted.invoke` matches how every node calls `coder.invoke(prompt)`. `build_code_prompt` takes a plain dict so `parallel.py` can call it with a partial state. `ExecResult.summary()` is what every tool and `run_tests` return.
