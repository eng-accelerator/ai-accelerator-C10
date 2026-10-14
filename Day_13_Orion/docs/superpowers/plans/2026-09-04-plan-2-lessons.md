# Plan 2: Lessons as Python files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three notebooks with 18 Python lesson files that Dileep runs cell by cell in Cursor, in the same order and with the same cell numbers the instructor script references, on top of the `orion_agent` package from Plan 1.

**Architecture:** One file per web chapter under `lessons/`, each made of `# %%` cells. Cells are thin: they call the package and print. Definition cells print the relevant source with `inspect.getsource` so the code is on screen when the beat says "read the node." A small `orion_agent.lesson` module gives every file the same `setup()`, `run()`, and `show()` helpers so files work both in Cursor's interactive window and as plain scripts. Lesson 3 files share one cached orchestrator so ch16, ch17, and ch18 can run in the same kernel without rebuilding.

**Tech Stack:** Python 3.13 via uv, the `orion_agent` package, ipykernel for Cursor's interactive window, pytest.

**Spec:** `docs/superpowers/specs/2026-09-04-orion-reframe-design.md` (sections 2, 4, 11, 13)

## Global Constraints

- Every runnable cell starts with `# %% C<n> <label>` where `<n>` is the original notebook cell number, or `# %% N<n> <label>` for a cell that did not exist in the notebooks. Cell tags are unique within a file.
- Cells whose code the website shows carry a trailing ` web` on the tag line.
- Lessons never write outside `workspace/`. Generated files go to `workspace/generated/`. Lesson 3 edits `workspace/config.py`, `workspace/chat.py`, `workspace/app.py`.
- Lesson 1 and 2 use `FAST` (`openai/gpt-4o-mini`). Lesson 3 uses `STRONG` (`anthropic/claude-sonnet-4.5`).
- No top-level `await`. Async calls go through `orion_agent.lesson.run()`.
- No notebooks, no Colab links, no reference to a previous version of the course.
- Package interfaces used, exactly as they exist on `main`: `get_llm(model)`, `structured(llm, schema)`, `Workspace`, `LocalSandbox`, `basic_tools(ws)`, `make_tools(ws, sandbox)`, `load_rules(root, for_path)`, `list_rules(root)`, `load_skills(root)`, `skills_catalog(skills)`, `make_read_skill_tool(skills)`, `aget_mcp_tools()`, `search_codebase(ws, q)`, `repo_map(ws)`, `build_index`, `semantic_search`, `build_tool_agent(llm, tools, system_prompt=None, checkpointer=None)`, `prebuilt_agent(llm, tools, system_prompt=None)`, `build_bugbot(coder, sandbox, timeout=10)`, `build_full_agent(coder, reviewer, sandbox, timeout=10)`, `build_orchestrator(planner, coder, reviewer, ws, sandbox, *, planner_agent, rules_root, checkpointer, ...)`, `build_code_prompt`, `build_review_prompt`, `run_tests`, `check_task_paths`, `build_parallel_agent(planner, coder, ws, *, rules_root, checkpointer)`, `cli.reset(root)`.
- Commit after every task with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer. Work on `main` in `orion-tutorial/`.

---

## File structure

```
src/orion_agent/lesson.py            Task 1: repo_root, setup, run, show, print_messages, print_file, demo_orchestrator
tests/test_lesson_helpers.py         Task 1
sample_project/test_app.py           Task 2: the workspace's own tests (verification primitive)
lessons/01_hands/ch01_llm_setup.py … ch07_multi_turn.py        Task 3
lessons/02_self_awareness/ch08 … ch12                           Task 4
lessons/03_brain/ch13 … ch18                                    Task 5
tests/test_lessons_smoke.py          Task 6: every file parses, tags unique, required tags present
lessons/README.md, README.md         Task 7
Notebooks/*.ipynb, CONTENTS.md, README.md, test.csv  deleted in Task 7 (Notebooks/orion stays for Plan 3)
```

---

### Task 1: Lesson helpers

**Files:**
- Create: `src/orion_agent/lesson.py`, `tests/test_lesson_helpers.py`

**Interfaces:**
- Produces: `repo_root(start=None) -> Path`; `setup() -> tuple[Path, Workspace]` (loads `.env`, returns repo root and the `workspace/` Workspace); `run(coro)` (runs a coroutine whether or not a loop is already running); `show(graph, title="")` (mermaid PNG in the interactive window, mermaid text otherwise); `print_messages(messages, width=200)`; `print_file(ws, rel)`; `demo_orchestrator(root, ws, *, with_web=False) -> CompiledStateGraph` (cached per workspace root).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_lesson_helpers.py
import asyncio
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from orion_agent import lesson


def test_repo_root_walks_up_to_pyproject(tmp_path):
    (tmp_path / "pyproject.toml").write_text("[project]\nname='x'\n")
    (tmp_path / "src" / "orion_agent").mkdir(parents=True)
    deep = tmp_path / "lessons" / "01_hands"
    deep.mkdir(parents=True)
    assert lesson.repo_root(deep) == tmp_path.resolve()


def test_repo_root_raises_outside_repo(tmp_path):
    try:
        lesson.repo_root(tmp_path)
    except RuntimeError as exc:
        assert "orion-tutorial" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


async def _double(x):
    return x * 2


def test_run_without_a_loop():
    assert lesson.run(_double(2)) == 4


def test_run_inside_a_running_loop():
    async def outer():
        return lesson.run(_double(3))

    assert asyncio.run(outer()) == 6


def test_print_messages_formats_each_kind(capsys):
    lesson.print_messages([
        HumanMessage(content="hi"),
        AIMessage(content="", tool_calls=[{"name": "read_file", "args": {"filepath": "a.py"}, "id": "1", "type": "tool_call"}]),
        ToolMessage(content="x = 1", tool_call_id="1", name="read_file"),
        AIMessage(content="done"),
    ])
    out = capsys.readouterr().out
    assert "[human] hi" in out
    assert "[agent] calls read_file({'filepath': 'a.py'})" in out
    assert "[tool:read_file] x = 1" in out
    assert "[agent] done" in out


def test_demo_orchestrator_is_cached(ws_dir, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    root = ws_dir.parent
    a = lesson.demo_orchestrator(root, lesson.Workspace(ws_dir))
    b = lesson.demo_orchestrator(root, lesson.Workspace(ws_dir))
    assert a is b
    names = set(a.get_graph().nodes) - {"__start__", "__end__"}
    assert names == {"plan", "code", "test", "ai_review", "human_review", "apply", "verify"}
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_lesson_helpers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'orion_agent.lesson'`

- [ ] **Step 3: Write `src/orion_agent/lesson.py`**

```python
"""Helpers shared by the lesson files: paths, a sync runner, graph display."""

from __future__ import annotations

import asyncio
import concurrent.futures
from pathlib import Path
from typing import Any, Coroutine

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage
from langgraph.checkpoint.memory import InMemorySaver

from orion_agent.graphs.orchestrator import build_orchestrator
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import STRONG, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace

__all__ = ["Workspace", "repo_root", "setup", "run", "show", "print_messages", "print_file", "demo_orchestrator"]


def repo_root(start: Path | None = None) -> Path:
    """Walk up from `start` (default: cwd) to the folder that holds pyproject.toml and src/orion_agent."""
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "pyproject.toml").exists() and (candidate / "src" / "orion_agent").exists():
            return candidate
    raise RuntimeError("Run this from inside the orion-tutorial repository (open the repo folder in Cursor).")


def setup() -> tuple[Path, Workspace]:
    """Load .env and return (repo root, the workspace/ Workspace)."""
    root = repo_root()
    load_dotenv(root / ".env")
    return root, Workspace(root / "workspace")


def run(coro: Coroutine[Any, Any, Any]) -> Any:
    """Run a coroutine to completion, in a script or inside Cursor's interactive window."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


def show(graph, title: str = "") -> None:
    """Draw a compiled graph: a PNG in the interactive window, mermaid text in a terminal."""
    try:
        from IPython import get_ipython
        from IPython.display import Image, display

        if get_ipython() is not None:
            display(Image(graph.get_graph().draw_mermaid_png()))
            return
    except Exception:  # noqa: BLE001 - any display failure falls back to text
        pass
    if title:
        print(title)
    print(graph.get_graph().draw_mermaid())


def print_messages(messages: list[BaseMessage], width: int = 200) -> None:
    """Print a message list the way the lessons narrate it: one line per step."""
    for i, msg in enumerate(messages):
        kind = msg.type
        if kind == "system":
            print(f"Step {i}: [system] (system prompt)")
        elif kind == "human":
            print(f"Step {i}: [human] {str(msg.content)[:width]}")
        elif kind == "ai":
            calls = getattr(msg, "tool_calls", None) or []
            if calls:
                for call in calls:
                    args = {k: str(v)[:60] for k, v in call["args"].items()}
                    print(f"Step {i}: [agent] calls {call['name']}({args})")
            else:
                print(f"Step {i}: [agent] {str(msg.content)[:width]}")
        elif kind == "tool":
            print(f"Step {i}: [tool:{msg.name}] {str(msg.content)[:width]}")
        print()


def print_file(ws: Workspace, rel: str) -> None:
    """Print one workspace file with a header."""
    print(f"--- {rel} ---")
    print(ws.read(rel))


_DEMO_CACHE: dict[Path, Any] = {}


def demo_orchestrator(root: Path, ws: Workspace, *, with_web: bool = False):
    """The Lesson 3 agent, built once per workspace so ch16, ch17, and ch18 share its checkpoints."""
    key = ws.root
    if key in _DEMO_CACHE:
        return _DEMO_CACHE[key]
    llm = get_llm(STRONG)
    sandbox = LocalSandbox()
    tools = make_tools(ws, sandbox)
    skills = load_skills(root)
    research_tools = [tools["grep_files"], tools["glob_files"], tools["read_file"], make_read_skill_tool(skills)]
    if with_web:
        from orion_agent.mcp import aget_mcp_tools

        research_tools += run(aget_mcp_tools())
    research = build_tool_agent(llm, research_tools, system_prompt=skills_catalog(skills) or None)
    agent = build_orchestrator(
        structured(llm, Plan),
        structured(llm, CodeResult),
        structured(llm, ReviewResult),
        ws,
        sandbox,
        planner_agent=research,
        rules_root=root,
        checkpointer=InMemorySaver(),
    )
    _DEMO_CACHE[key] = agent
    return agent
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_lesson_helpers.py -v`
Expected: 6 passed. If `test_demo_orchestrator_is_cached` fails because `ws_dir` and its parent share a cache key with another test, clear `lesson._DEMO_CACHE` at the top of that test.

- [ ] **Step 5: Commit**

```bash
git add src/orion_agent/lesson.py tests/test_lesson_helpers.py
git commit -m "Add lesson helpers: repo root, runner, graph display, demo orchestrator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The sample project's own tests

**Files:**
- Create: `sample_project/test_app.py`
- Modify: `tests/test_cli.py` (one assertion)

The orchestrator's `run_tests` uses pytest when a workspace has test files and smoke-imports otherwise. `app.py` cannot be smoke-imported (it runs Streamlit at import time), so the sample project ships a test file that exercises `config` and `chat` without importing `app`. This is also what beat 46 shows: "tests pass" after apply.

- [ ] **Step 1: Write `sample_project/test_app.py`**

```python
"""Tests the agent runs before and after it changes this project."""

from types import SimpleNamespace

import config
from chat import get_client, stream_response


def test_config_points_at_openrouter() -> None:
    assert config.MODEL
    assert config.BASE_URL.startswith("https://")


def test_get_client_uses_the_configured_base_url() -> None:
    client = get_client("test-key")
    assert str(client.base_url).startswith(config.BASE_URL)


def test_stream_response_yields_only_text_chunks() -> None:
    class FakeStream:
        def __iter__(self):
            for text in ("Hel", "lo", None):
                yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: FakeStream())))
    assert "".join(stream_response(fake_client, [{"role": "user", "content": "hi"}])) == "Hello"
```

- [ ] **Step 2: Prove it runs the way the agent runs it**

Run:

```bash
uv run orion reset
uv run python -c "
from orion_agent.graphs.orchestrator import run_tests
from orion_agent.sandbox import LocalSandbox
from orion_agent.workspace import Workspace
out, ok = run_tests(Workspace('workspace'), LocalSandbox(), ['config.py'])
print(out); assert ok, out"
```

Expected: pytest output with `3 passed` and no assertion error.

- [ ] **Step 3: Extend the CLI test**

In `tests/test_cli.py`, inside `make_root`, add `(tmp_path / "sample_project" / "test_app.py").write_text("def test_x():\n    assert True\n")` after the `config.py` write, and in `test_reset_restores_workspace_from_sample_project` change the sorted-names assertion to `["config.py", "test_app.py"]`.

Run: `uv run pytest tests/test_cli.py -v`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add sample_project/test_app.py tests/test_cli.py
git commit -m "Give the sample project its own tests so the agent verifies with pytest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Lesson 1 files (ch01 to ch07)

**Files:**
- Create: `lessons/01_hands/ch01_llm_setup.py`, `ch02_tools.py`, `ch03_agent_graph.py`, `ch04_code_generation.py`, `ch05_rules.py`, `ch06_streaming.py`, `ch07_multi_turn.py`, `lessons/__init__.py` (empty), `lessons/01_hands/__init__.py` (empty)

Every file begins with the same setup cell. Write it exactly once per file:

```python
# %% setup
"""<one line naming the chapter>"""
from orion_agent.lesson import setup, run, show, print_messages, print_file

ROOT, ws = setup()
```

- [ ] **Step 1: Write `ch01_llm_setup.py`**

```python
# %% setup
"""Chapter 1: the LLM, through OpenRouter."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C1 api key web
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found: copy .env.example to .env")

# %% C2 say hello web
from orion_agent.llm import FAST, get_llm

llm = get_llm(FAST)
print(llm.invoke("Say hello in one sentence.").content)
```

- [ ] **Step 2: Write `ch02_tools.py`**

```python
# %% setup
"""Chapter 2: three tools, and the schema the decorator builds for each."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C3 three tools web
from orion_agent.tools import basic_tools

tools = basic_tools(ws)
# The decorator turns the docstring and type hints into the schema the model sees.
for t in tools:
    print(f"{t.name}: {t.description}")
    print(f"  schema: {t.args_schema.model_json_schema()['properties']}\n")

# Open src/orion_agent/tools.py to read the three functions. Every path is resolved
# against workspace/ and an escape comes back as an "Error: ..." string.
```

- [ ] **Step 3: Write `ch03_agent_graph.py`**

```python
# %% setup
"""Chapter 3: the agent loop. The model decides, the tools run, the model sees the result."""
from orion_agent.lesson import setup, show, print_messages

ROOT, ws = setup()

from orion_agent.llm import FAST, get_llm
from orion_agent.tools import basic_tools

llm = get_llm(FAST)
tools = basic_tools(ws)

# %% C4 bind_tools: the model picks a tool web
llm_with_tools = llm.bind_tools(tools)
response = llm_with_tools.invoke("What files are in the current directory?")
print("Content:", response.content)
print("Tool calls:", response.tool_calls)

# %% C5 no tool needed
response = llm_with_tools.invoke("What is Python?")
print("Content:", response.content[:200])
print("Tool calls:", response.tool_calls)

# %% C6 the graph web
import inspect

from orion_agent.graphs import tool_agent

# Two nodes: agent and tools. One conditional edge: tool_calls or done.
print(inspect.getsource(tool_agent.build_tool_agent))
agent = tool_agent.build_tool_agent(llm, tools)
print("Graph compiled")

# %% C7 draw it
show(agent, "agent loop")

# %% C8 run it and read the trace web
from langchain_core.messages import HumanMessage

result = agent.invoke({"messages": [HumanMessage(content="List the files in the current directory")]})
print_messages(result["messages"])

# %% N1 the same loop, prebuilt
from orion_agent.graphs.tool_agent import prebuilt_agent

built_in = prebuilt_agent(llm, tools)
result = built_in.invoke({"messages": [HumanMessage(content="List the files in the current directory")]})
print(result["messages"][-1].content)
```

- [ ] **Step 4: Write `ch04_code_generation.py`**

```python
# %% setup
"""Chapter 4: generate code and write it to a file."""
from orion_agent.lesson import setup, print_messages, print_file

ROOT, ws = setup()

from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.tools import basic_tools

agent = build_tool_agent(get_llm(FAST), basic_tools(ws))

# %% C9 the calculator web
result = agent.invoke({"messages": [HumanMessage(content="""
Create a Python file called 'generated/calculator.py' with a Calculator class that has:
- add, subtract, multiply, divide methods
- A history list that tracks all operations
- A get_history method that returns the history

Write the file using the write_file tool.
""")]})
print_messages(result["messages"])

# %% C10 the file
print_file(ws, "generated/calculator.py")
```

- [ ] **Step 5: Write `ch05_rules.py`**

```python
# %% setup
"""Chapter 5: the system prompt, and where it comes from now: rules files."""
from orion_agent.lesson import setup, print_messages, print_file

ROOT, ws = setup()

from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.rules import list_rules, load_rules
from orion_agent.tools import basic_tools

llm = get_llm(FAST)
tools = basic_tools(ws)

# %% N1 which rules apply to this file web
for rule in list_rules(ROOT):
    print(f"{rule.source:40} always={rule.always_apply!s:5} globs={rule.globs}")

SYSTEM_PROMPT = load_rules(ROOT, "workspace/generated/data_processor.py")
print("\n" + SYSTEM_PROMPT)

# %% C11 the same agent, with rules web
agent = build_tool_agent(llm, tools, system_prompt=SYSTEM_PROMPT)
result = agent.invoke({"messages": [HumanMessage(content="""
Create a file 'generated/data_processor.py' with a DataProcessor class that:
- Takes a list of dictionaries in __init__
- Has filter_by(key, value) -> returns filtered list
- Has group_by(key) -> returns dict of grouped items
- Has summarize() -> returns count, keys present, sample row
""")]})
for msg in result["messages"]:
    if msg.type == "ai" and not msg.tool_calls:
        print(msg.content)

# %% C12 the file
print_file(ws, "generated/data_processor.py")
```

- [ ] **Step 6: Write `ch06_streaming.py`**

```python
# %% setup
"""Chapter 6: streaming. Tokens as they are produced, tool calls as they start and end."""
from orion_agent.lesson import setup, run

ROOT, ws = setup()

from langchain_core.messages import HumanMessage, SystemMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.rules import load_rules
from orion_agent.tools import basic_tools

SYSTEM_PROMPT = load_rules(ROOT, "workspace/generated/calculator.py")
agent = build_tool_agent(get_llm(FAST), basic_tools(ws))

# %% C13 astream_events web
async def stream_agent(user_message: str) -> None:
    inputs = {"messages": [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)]}
    async for event in agent.astream_events(inputs, version="v2"):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                print(chunk.content, end="", flush=True)
        elif event["event"] == "on_tool_start":
            print(f"\n--- calling tool: {event['name']} ---")
        elif event["event"] == "on_tool_end":
            print("--- tool done ---\n")


run(stream_agent("List files in the 'generated' directory and read calculator.py"))

# %% N1 the simpler API: stream_mode="messages"
async def stream_messages(user_message: str) -> None:
    inputs = {"messages": [HumanMessage(content=user_message)]}
    async for token, _metadata in agent.astream(inputs, stream_mode="messages"):
        if token.content:
            print(token.content, end="", flush=True)
    print()


run(stream_messages("In one sentence, what is in generated/calculator.py?"))
```

- [ ] **Step 7: Write `ch07_multi_turn.py`**

```python
# %% setup
"""Chapter 7: memory across turns, then the step trace."""
from orion_agent.lesson import setup, print_messages, print_file

ROOT, ws = setup()

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import InMemorySaver

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.rules import load_rules
from orion_agent.tools import basic_tools

llm = get_llm(FAST)
tools = basic_tools(ws)
SYSTEM_PROMPT = load_rules(ROOT, "workspace/generated/logger.py")
agent = build_tool_agent(llm, tools)

# %% C14 turn one web
messages = [
    SystemMessage(content=SYSTEM_PROMPT),
    HumanMessage(content="Create 'generated/logger.py' with a SimpleLogger class that writes timestamped messages to a log file."),
]
result = agent.invoke({"messages": messages})
messages = result["messages"]
print("=== Turn 1 complete ===")
print(ws.read("generated/logger.py")[:300])

# %% C15 turn two, carrying the history by hand web
messages.append(HumanMessage(content="""
Now read the logger.py file and add these features:
- Log levels: INFO, WARNING, ERROR
- A method to filter logs by level
Write the updated file.
"""))
result = agent.invoke({"messages": messages})
print("=== Turn 2 complete ===")
print_file(ws, "generated/logger.py")

# %% N1 the native way: a checkpointer and a thread_id
remembering = build_tool_agent(llm, tools, system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
thread = {"configurable": {"thread_id": "logger-chat"}}
remembering.invoke({"messages": [HumanMessage(content="Read generated/logger.py and tell me its class name.")]}, thread)
result = remembering.invoke({"messages": [HumanMessage(content="Add a clear() method to that class and write the file.")]}, thread)
print(result["messages"][-1].content)
print(f"messages on this thread: {len(result['messages'])}")

# %% C16 the six-step trace web
result = agent.invoke({"messages": [
    SystemMessage(content=SYSTEM_PROMPT),
    HumanMessage(content="Read generated/calculator.py, then create generated/test_calculator.py with pytest tests for all methods."),
]})
print_messages(result["messages"], width=100)

# %% C17 the test file
print_file(ws, "generated/test_calculator.py")

# %% C18 reset the workspace (do not run during the session)
from orion_agent.cli import reset

print(f"restored: {reset(ROOT)}")
```

- [ ] **Step 8: Run each file top to bottom once**

Run, with a real key in `.env`:

```bash
uv run orion reset
for f in lessons/01_hands/ch0*.py; do echo "== $f"; uv run python "$f" || break; done
```

Expected: each file runs to the end. ch07's C18 resets the workspace at the end, so run `uv run orion reset` again before Lesson 2. If a model refuses to call a tool for a prompt, tighten the prompt wording in that cell; do not change the package.

- [ ] **Step 9: Commit**

```bash
git add lessons/__init__.py lessons/01_hands
git commit -m "Add Lesson 1: tools, the agent loop, rules, streaming, multi-turn

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Lesson 2 files (ch08 to ch12)

**Files:**
- Create: `lessons/02_self_awareness/__init__.py` (empty), `ch08_structured_output.py`, `ch09_self_correction.py`, `ch10_reflection.py`, `ch11_rules_and_skills.py`, `ch12_inline_edit.py`

- [ ] **Step 1: Write `ch08_structured_output.py`**

```python
# %% setup
"""Chapter 8: structured output. The code and the explanation arrive as separate fields."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C1 api key
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found")

# %% C2 ready
from orion_agent.llm import FAST, get_llm

llm = get_llm(FAST)
print(llm.invoke("Say 'ready' if you can hear me.").content)

# %% C3 raw: one blob web
result = llm.invoke("Write a Python function that checks if a number is prime")
print(result.content)

# %% C4 structured: a CodeOutput web
from orion_agent.llm import structured
from orion_agent.schemas import CodeOutput

structured_llm = structured(llm, CodeOutput)
result = structured_llm.invoke("Write a Python function that checks if a number is prime")

# %% C5 it is an object
print(f"Type: {type(result)}")

# %% C6 the explanation
print(f"\nExplanation: {result.explanation}")

# %% C7 the code
print(f"\nCode:\n{result.code}")
```

- [ ] **Step 2: Write `ch09_self_correction.py`**

```python
# %% setup
"""Chapter 9: run the code, read the error, try again. Bounded."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import FAST, get_llm, structured
from orion_agent.schemas import CodeOutput

llm = get_llm(FAST)
coder = structured(llm, CodeOutput)

# %% C8 execute in the sandbox web
from orion_agent.sandbox import LocalSandbox

sandbox = LocalSandbox()
# Open src/orion_agent/sandbox.py: isolated interpreter, scrubbed environment, temp cwd,
# and a timeout that returns a result instead of raising.

# %% C9 working code
out = sandbox.run_python("print('hello world')")
print("Working code:", out)

# %% C10 broken code
out = sandbox.run_python("print(1/0)")
print("Broken code:", out)

# %% N1 a hang becomes a failed attempt, not a crash web
out = sandbox.run_python("import time; time.sleep(20)", timeout=3)
print(out)
print("ok:", out.ok, "timed_out:", out.timed_out)

# %% N2 this is a jail, not a sandbox
print("""
LocalSandbox stops the common accidents: no access to your environment variables,
no user site-packages, a temp working directory, a timeout.
It does NOT stop network access or resource exhaustion.
Shipped agents run generated code in a real sandbox:
  Claude Code: Seatbelt (macOS) / bubblewrap (Linux)   Codex: the same, network off by default
  Cursor cloud agents: Firecracker microVMs             OpenHands: Docker
DockerSandbox in sandbox.py is the stub to fill in when you need that.
""")

# %% C11 the state web
from orion_agent.graphs.self_correcting import AgentState

for name, kind in AgentState.__annotations__.items():
    print(f"  {name}: {kind}")

# %% C12 the nodes web
import inspect

from orion_agent.graphs import self_correcting

print(inspect.getsource(self_correcting._generate_prompt))
print(inspect.getsource(self_correcting._make_nodes))

# %% C13 compile web
from orion_agent.graphs.self_correcting import build_bugbot

bugbot = build_bugbot(coder, sandbox)
print("Self-correcting graph compiled")

# %% C14 draw it
show(bugbot, "generate -> execute -> retry")

# %% C15 easy task: first try web
result = bugbot.invoke({"task": "Print the first 10 Fibonacci numbers", "attempts": 0, "max_attempts": 3})
print(f"Status: {result['status']}")
print(f"Attempts: {result['attempts']}")
print(f"Explanation: {result['explanation']}")
print(f"Output: {result['execution_result']}")
print(f"Code:\n{result['code']}")

# %% C16 hard task: watch the retries web
inputs = {
    "task": "Write the diffusers code to generate an image of a cat using the model 'CompVis/stable-diffusion-v1-4'",
    "attempts": 0,
    "max_attempts": 3,
}
for step in bugbot.stream(inputs):
    node_name, state = next(iter(step.items()))
    if node_name == "generate":
        print(f"[generate] Attempt {state.get('attempts', '?')}")
        print(f"  Code preview: {state['code'][:80]}...")
    elif node_name == "execute":
        if state.get("error"):
            print(f"[execute] FAILED: {state['error'][:100]}")
        else:
            print(f"[execute] SUCCESS: {state['execution_result'][:100]}")
    print()
```

- [ ] **Step 3: Write `ch10_reflection.py`**

```python
# %% setup
"""Chapter 10: a reviewer with fresh eyes, after the code runs."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import FAST, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
coder = structured(llm, CodeOutput)
sandbox = LocalSandbox()

# %% C17 the reviewer, on its own web
reviewer = structured(llm, ReviewResult)
test_code = "x = [1,2,3]\nfor i in x:\n  print(i)"
review = reviewer.invoke(f"Review this Python code for quality (type hints, naming, PEP 8, efficiency):\n\n{test_code}")
print(f"Approved: {review.approved}")
print(f"Feedback: {review.feedback}")

# %% C18 the full state and the review node web
import inspect

from orion_agent.graphs import self_correcting

for name, kind in self_correcting.FullAgentState.__annotations__.items():
    print(f"  {name}: {kind}")
print(inspect.getsource(self_correcting.build_full_agent))

# %% C19 compile
full_agent = self_correcting.build_full_agent(coder, reviewer, sandbox)
print("Full agent compiled")

# %% C20 draw it
show(full_agent, "generate -> execute -> review")

# %% C21 the sieve web
result = full_agent.invoke({
    "task": "Write a function to find all prime numbers up to n using the Sieve of Eratosthenes. Test it by printing primes up to 50.",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (after {result['attempts']} attempt(s))")
print(f"Output: {result['execution_result']}")
print(f"\nCode:\n{result['code']}")

# %% C22 trace the pipeline web
for step in full_agent.stream({
    "task": "Create a dataclass called 'Point' with x,y coordinates. Add methods for distance_to(other), midpoint(other), and __str__. Test with Point(3,4) and Point(0,0).",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
}):
    node_name, state = next(iter(step.items()))
    if node_name == "generate":
        print(f"[generate] Attempt {state.get('attempts', '?')}: {state.get('explanation', '')[:100]}")
    elif node_name == "execute":
        if state.get("error"):
            print(f"[execute] FAILED: {state['error'][:150]}")
        else:
            print(f"[execute] OK: {state['execution_result'][:150]}")
    elif node_name == "review":
        print(f"[review] {state.get('status', '')}: {state.get('review_feedback', '')[:150]}")
    print()
```

- [ ] **Step 4: Write `ch11_rules_and_skills.py`**

```python
# %% setup
"""Chapter 11: rules are always on and scoped by path. Skills load on demand."""
from orion_agent.lesson import setup, print_messages

ROOT, ws = setup()

from orion_agent.graphs.self_correcting import build_full_agent
from orion_agent.llm import FAST, get_llm, structured
from orion_agent.rules import load_rules
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
full_agent = build_full_agent(structured(llm, CodeOutput), structured(llm, ReviewResult), LocalSandbox())

# %% C23 rules from files, scoped by glob web
# .cursor/rules/python.mdc applies to every .py file. .cursor/rules/tests.mdc applies only to test files.
app_rules = load_rules(ROOT, "workspace/app.py")
test_rules = load_rules(ROOT, "workspace/tests/test_sort.py")
print("rules for app.py mention tests.mdc:", "tests.mdc" in app_rules)
print("rules for tests/test_sort.py mention tests.mdc:", "tests.mdc" in test_rules)

result_with_rules = full_agent.invoke({
    "task": "Write a function to sort a list of dictionaries by a given key. Test with sample data.",
    "rules": test_rules,
    "attempts": 0,
    "max_attempts": 3,
})
print("=== With the test-file rules ===")
print(result_with_rules["code"])

# %% N1 the skills catalog web
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog

skills = load_skills(ROOT)
print(skills_catalog(skills))
# The agent sees only these lines. It loads a body when a description matches.

# %% N2 watch the agent load a skill web
from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent

skill_agent = build_tool_agent(llm, [make_read_skill_tool(skills)], system_prompt=skills_catalog(skills))
result = skill_agent.invoke({"messages": [HumanMessage(content=(
    "I am about to add a feature to an unfamiliar codebase. Load the skill that covers this "
    "and give me its steps, one line each."
))]})
print_messages(result["messages"], width=300)
```

- [ ] **Step 5: Write `ch12_inline_edit.py`**

```python
# %% setup
"""Chapter 12: edit existing code, then edit it under rules."""
from orion_agent.lesson import setup

ROOT, ws = setup()

from orion_agent.graphs.self_correcting import build_full_agent
from orion_agent.llm import FAST, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
full_agent = build_full_agent(structured(llm, CodeOutput), structured(llm, ReviewResult), LocalSandbox())

# %% C24 inline edit web
existing_code = """
def greet(name):
    print("Hello " + name)

greet("World")
"""
result = full_agent.invoke({
    "task": f"""Modify this existing code:
```python
{existing_code}
```

Changes requested:
- Add type hints
- Add a docstring
- Support an optional greeting parameter (default "Hello")
- Return the string instead of printing it
- Add tests that verify the output""",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (attempts: {result['attempts']})")
print(f"Output: {result['execution_result']}")
print(f"\nModified code:\n{result['code']}")

# %% C25 rules plus inline edit web
legacy_code = """
import csv

def read_data(file):
    f = open(file)
    r = csv.reader(f)
    data = []
    for row in r:
        data.append(row)
    f.close()
    return data

d = read_data("test.csv")
print(d)
"""
MODERNIZE_RULES = """- Use context managers (with statement) for file handling
- Use pathlib.Path instead of string paths
- Use list comprehensions where appropriate
- Add proper error messages
- Use type hints everywhere"""
result = full_agent.invoke({
    "task": f"""Modernize this legacy code:
```python
{legacy_code}
```
Rewrite it following modern Python best practices. Create a small test CSV inline using io.StringIO for testing.""",
    "rules": MODERNIZE_RULES,
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (attempts: {result['attempts']})")
print(f"Output: {result['execution_result']}")
print(f"\nModernized code:\n{result['code']}")
```

- [ ] **Step 6: Run each file once**

Run:

```bash
uv run orion reset
for f in lessons/02_self_awareness/ch*.py; do echo "== $f"; uv run python "$f" || break; done
```

Expected: every file completes. ch09 C16 is expected to show failed attempts (the diffusers package is not installed in the sandbox); that is the demo.

- [ ] **Step 7: Commit**

```bash
git add lessons/02_self_awareness
git commit -m "Add Lesson 2: structured output, sandboxed self-correction, review, rules, skills, inline edit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Lesson 3 files (ch13 to ch18)

**Files:**
- Create: `lessons/03_brain/__init__.py` (empty), `ch13_codebase_search.py`, `ch14_toolkit_and_planner.py`, `ch15_specialists.py`, `ch16_human_in_the_loop.py`, `ch17_parallel.py`, `ch18_time_travel.py`

- [ ] **Step 1: Write `ch13_codebase_search.py`**

```python
# %% setup
"""Chapter 13: the codebase brain is grep, glob, and read, with a model in the loop."""
from orion_agent.lesson import setup, print_messages

ROOT, ws = setup()

# %% C1 api key
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found")

# %% C2 a stronger model for this lesson
from orion_agent.llm import STRONG, get_llm

llm = get_llm(STRONG)
print(llm.invoke("Say 'Agent Mode activated' if you can hear me.").content)

# %% C3 grep and a repo map web
from orion_agent.search import repo_map, search_codebase

for match in ws.grep("stream"):
    print(f"{match.path}:{match.line}: {match.text}")
print()
print(repo_map(ws))
print()
print(search_codebase(ws, "streaming chat response"))

# %% C4 an agent that searches on its own web
from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.tools import make_tools

tools = make_tools(ws, LocalSandbox())
searcher = build_tool_agent(llm, [tools["grep_files"], tools["glob_files"], tools["read_file"]])
result = searcher.invoke({"messages": [HumanMessage(content=(
    "How does the streaming response work in this project? Name the file and the function, in brief."
))]})
print_messages(result["messages"], width=160)

# %% N1 the 2023-2025 way: embeddings
from langchain_openai import OpenAIEmbeddings

from orion_agent.embeddings import build_index, semantic_search
from orion_agent.llm import BASE_URL

embeddings = OpenAIEmbeddings(model="openai/text-embedding-3-small", api_key=os.environ["OPENROUTER_API_KEY"], base_url=BASE_URL)
store = build_index(ws, embeddings)
print(semantic_search(store, "streaming chat response", k=2))
print("""
This is what Cursor's @codebase did until it turned the embedding index off.
An index has to be built, kept fresh, and paid for. grep plus a model that
decides what to read finds the same code with none of that. Claude Code, Codex,
Cline, and Aider never used embeddings.
""")
```

- [ ] **Step 2: Write `ch14_toolkit_and_planner.py`**

```python
# %% setup
"""Chapter 14: the toolkit, tools from an MCP server, and the planner."""
from orion_agent.lesson import setup, run, print_messages

ROOT, ws = setup()

from orion_agent.llm import STRONG, get_llm, structured
from orion_agent.sandbox import LocalSandbox

llm = get_llm(STRONG)
sandbox = LocalSandbox()

# %% C5 local tools plus MCP tools web
from orion_agent.mcp import PARALLEL_SEARCH_URL, aget_mcp_tools
from orion_agent.tools import make_tools

local = make_tools(ws, sandbox)
web = run(aget_mcp_tools())  # Parallel Search MCP: web_search, web_fetch
print(f"MCP server: {PARALLEL_SEARCH_URL}")
for t in [*local.values(), *web]:
    print(f"  {t.name}: {t.description[:70]}")
# .cursor/mcp.json gives Cursor the same server. Same tool, two agents.

# %% C6 run a command, no shell web
print(local["run_command"].invoke({"command": ["python", "-c", "import config; print(config.PAGE_TITLE, config.MODEL)"], "cwd": "."}))

# %% N1 research with the web web
from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent

researcher = build_tool_agent(llm, [local["grep_files"], local["read_file"], *web])
result = run(researcher.ainvoke({"messages": [HumanMessage(content=(
    "chat.py streams completions with the openai package. Search the web for the current way to "
    "stream chat completions with the OpenAI Python SDK, then read chat.py and say whether it matches. Cite the URL."
))]}))
print_messages(result["messages"], width=300)

# %% C7 the planner web
from orion_agent.schemas import Plan

planner = structured(llm, Plan)
plan = planner.invoke(
    "You are a coding planner. Create a plan.\n\n"
    "Feature: Add a system prompt setting to the chatbot\n"
    "Codebase: config.py has PAGE_TITLE, PAGE_ICON, MODEL, BASE_URL. "
    "chat.py has get_client(api_key) and stream_response(client, messages). "
    "app.py is the Streamlit UI with chat history and streaming."
)
print(f"Plan: {plan.summary}")
for ft in plan.file_tasks:
    print(f"  [{ft.action}] {ft.filepath}: {ft.description[:80]}")

# %% C8 the orchestrator state web
from orion_agent.graphs.orchestrator import OrchestratorState

for name, kind in OrchestratorState.__annotations__.items():
    print(f"  {name}: {kind}")
```

- [ ] **Step 3: Write `ch15_specialists.py`**

```python
# %% setup
"""Chapter 15: three specialists. What each one is told."""
from orion_agent.lesson import setup

ROOT, ws = setup()

import inspect

from orion_agent.graphs import orchestrator

# %% C9 the planner researches first web
print(orchestrator.RESEARCH_PROMPT)
print(orchestrator.PLAN_PROMPT)
print(inspect.getsource(orchestrator.check_task_paths))

# %% C10 the coder prompt, with feedback folded in web
print(inspect.getsource(orchestrator.build_code_prompt))
task = {"filepath": "config.py", "action": "modify", "description": "add DEFAULT_SYSTEM_PROMPT"}
state = {
    "codebase_context": "config.py: PAGE_TITLE, PAGE_ICON, MODEL, BASE_URL",
    "status": "needs_revision",
    "review_result": "Name the constant DEFAULT_SYSTEM_PROMPT and add a docstring.",
    "human_feedback": "",
}
print(orchestrator.build_code_prompt(state, task, rules_root=ROOT))

# %% C11 the reviewer sees only the diff and the tests web
print(inspect.getsource(orchestrator.build_review_prompt))
print(inspect.getsource(orchestrator.run_tests))
```

- [ ] **Step 4: Write `ch16_human_in_the_loop.py`**

```python
# %% setup
"""Chapter 16: plan, code, test, review, then stop and ask."""
from orion_agent.lesson import setup, run, show, print_file, demo_orchestrator

ROOT, ws = setup()

# %% C12 the human node web
import inspect

from orion_agent.graphs import orchestrator

source = inspect.getsource(orchestrator.build_orchestrator)
start = source.index("def human_review_node")
print(source[start : source.index("def route_after_human")])

# %% C13 compile web
agent = demo_orchestrator(ROOT, ws)
nodes = set(agent.get_graph().nodes) - {"__start__", "__end__"}
print(f"Agent compiled: {len(nodes)} nodes, 4 conditional routes, checkpointing enabled")
print(sorted(nodes))

# %% C14 draw it
show(agent, "plan -> code -> test -> ai_review -> human_review -> apply -> verify")

# %% C15 watch it think, then pause web
FEATURE = (
    "Add a system prompt feature to the chatbot. "
    "Add a DEFAULT_SYSTEM_PROMPT constant in config.py. "
    "Modify chat.py so stream_response accepts an optional system_prompt parameter "
    "and prepends it as a system message. "
    "Modify app.py to add a sidebar text area where users can edit the system prompt, "
    "and pass it to stream_response."
)
config = {"configurable": {"thread_id": "demo-1"}}
print("Sending feature request to the agent...\n")
result = run(agent.ainvoke({"feature_request": FEATURE}, config))

payload = result["__interrupt__"][0].value  # what interrupt() handed back to us
print("=" * 60)
print("Agent paused. Waiting for human review")
print("=" * 60)
print(f"Plan: {payload['plan']}")
print(f"Review: {payload['review_result'][:200]}")
print(f"Tests:\n{payload['test_output'][:400]}")
for change in payload["changes"]:
    print(f"  {change['filepath']}: {change['explanation'][:80]}")

# %% C16 the frozen state web
state = run(agent.aget_state(config))
print(f"Agent is waiting at node: {state.next}\n")
for item in state.values["generated_code"]:
    print("=" * 60)
    print(f"  {item['filepath']}")
    print("=" * 60)
    print(item["code"])
    print()

# %% C17 approve, apply, verify web
from langgraph.types import Command

result = run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config))
print(f"Status: {result['status']}")
print(f"\nTest output:\n{result['test_output']}")

# %% C18 the applied files
for rel in ("config.py", "chat.py", "app.py"):
    print_file(ws, rel)

# %% N1 reject with a reason, on a second thread web
config_b = {"configurable": {"thread_id": "demo-1b"}}
snapshot = ws.snapshot()  # keep the approved files; this thread works on a copy
from orion_agent.workspace import Workspace

scratch_agent = demo_orchestrator(ROOT, Workspace(snapshot))
paused = run(scratch_agent.ainvoke({"feature_request": "Add a PAGE_SUBTITLE constant to config.py and show it under the title in app.py."}, config_b))
print("paused with:", [c["filepath"] for c in paused["__interrupt__"][0].value["changes"]])

paused_again = run(scratch_agent.ainvoke(
    Command(resume={"decision": "reject", "feedback": "Call the constant TAGLINE, not PAGE_SUBTITLE, and keep it under 40 characters."}),
    config_b,
))
state_b = run(scratch_agent.aget_state(config_b))
print("attempt counters after the reject:", state_b.values["review_attempts"], state_b.values["test_attempts"])
for change in paused_again["__interrupt__"][0].value["changes"]:
    print(f"--- {change['filepath']} ---\n{change['preview']}\n")
```

- [ ] **Step 5: Write `ch17_parallel.py`**

```python
# %% setup
"""Chapter 17: one coder per file, at the same time."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import STRONG, get_llm, structured
from orion_agent.schemas import CodeResult, Plan

llm = get_llm(STRONG)

# %% C19 a clean copy, and the parallel state web
import inspect

from orion_agent.graphs import parallel
from orion_agent.workspace import Workspace

snapshot = Workspace(ws.snapshot())  # the parallel demo works on a copy of the workspace
for name, kind in parallel.ParallelState.__annotations__.items():
    print(f"  {name}: {kind}")
print(inspect.getsource(parallel.add_to_list))
print(inspect.getsource(parallel.build_parallel_agent))

# %% C20 compile and draw
parallel_agent = parallel.build_parallel_agent(structured(llm, Plan), structured(llm, CodeResult), snapshot, rules_root=ROOT)
print("Parallel agent compiled\n")
show(parallel_agent, "plan -> Send(code_file) x N -> collect")

# %% C21 fan out web
result = parallel_agent.invoke({"feature_request": (
    "Add two features to the chatbot: "
    "1) A conversation export button in the sidebar that saves chat history as a .txt file. "
    "2) A model selector dropdown in the sidebar that lets users pick from 3 models. "
    "Update config.py with available models, chat.py to accept a model parameter, "
    "and app.py for the UI controls. Accept the API key from the sidebar as before, do not change it."
)})
print("=" * 60)
print(f"  {len(result['generated_code'])} files generated in parallel")
print("=" * 60)
for item in result["generated_code"]:
    print(f"\n--- {item['filepath']} ---")
    print(f"  {item['explanation'][:120]}")
    print(item["code"][:300])
    if len(item["code"]) > 300:
        print("  ...")

# %% C22 apply to the copy and verify web
from orion_agent.graphs.orchestrator import run_tests
from orion_agent.sandbox import LocalSandbox

for item in result["generated_code"]:
    snapshot.write(item["filepath"], item["code"])
    print(f"  Applied: {item['filepath']}")
output, ok = run_tests(snapshot, LocalSandbox(), [i["filepath"] for i in result["generated_code"]])
print("\nTests:", "PASS" if ok else "FAIL")
print(output)
```

- [ ] **Step 6: Write `ch18_time_travel.py`**

```python
# %% setup
"""Chapter 18: every checkpoint, then a second feature end to end."""
from orion_agent.lesson import setup, run, demo_orchestrator

ROOT, ws = setup()

from langgraph.types import Command

agent = demo_orchestrator(ROOT, ws)
config = {"configurable": {"thread_id": "demo-1"}}

# %% N0 make sure demo-1 has a history (only needed when ch16 did not run in this kernel)
if not list(agent.get_state_history(config)):
    FEATURE = (
        "Add a system prompt feature to the chatbot. Add a DEFAULT_SYSTEM_PROMPT constant in config.py. "
        "Modify chat.py so stream_response accepts an optional system_prompt parameter and prepends it as a system message. "
        "Modify app.py to add a sidebar text area where users can edit the system prompt, and pass it to stream_response."
    )
    run(agent.ainvoke({"feature_request": FEATURE}, config))
    run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config))
    print("demo-1 replayed")

# %% C23 walk the checkpoints web
history = list(agent.get_state_history(config))
print(f"Total checkpoints for demo-1: {len(history)}\n")
for i, snapshot in enumerate(reversed(history)):
    values = snapshot.values
    print(
        f"  Step {i}: status={values.get('status', 'initial')}, files={len(values.get('generated_code', []))}, "
        f"tests={values.get('test_attempts', 0)}, reviews={values.get('review_attempts', 0)}, next={snapshot.next}"
    )

# %% C24 a second feature, streamed web
config2 = {"configurable": {"thread_id": "demo-2"}}


async def stream_second_feature() -> None:
    async for step in agent.astream({"feature_request": (
        "Add a 'Clear Chat' button to the sidebar in app.py that resets st.session_state.messages "
        "to an empty list and reruns the app. Also add a message counter in the sidebar that shows "
        "how many messages are in the conversation."
    )}, config2):
        node_name, output = next(iter(step.items()))
        if node_name == "__interrupt__":
            print("\n[PAUSED] waiting for your approval")
            continue
        if not isinstance(output, dict):
            continue
        if node_name == "plan":
            print(f"[PLAN] {output.get('plan', '')}")
            for ft in output.get("file_tasks", []):
                print(f"  [{ft['action']}] {ft['filepath']}")
        elif node_name == "code":
            for item in output.get("generated_code", []):
                print(f"[CODE] {item['filepath']}: {item['explanation'][:80]}")
        elif node_name == "test":
            print(f"[TEST] {output.get('status')}")
        elif node_name == "ai_review":
            print(f"[REVIEW] {output.get('status')}: {output.get('review_result', '')[:100]}")


run(stream_second_feature())

# %% C25 approve
result2 = run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config2))
print(f"Status: {result2['status']}")
print(f"\nTest output:\n{result2['test_output']}")

# %% C26 the files after two features
for rel in ("config.py", "chat.py", "app.py"):
    content = ws.read(rel)
    funcs = [line.strip() for line in content.splitlines() if line.strip().startswith("def ")]
    print(f"  {rel}: {content.count(chr(10)) + 1} lines, {len(funcs)} functions")
    for f in funcs:
        print(f"    {f[:70]}")
    print()
```

- [ ] **Step 7: Run Lesson 3 end to end once**

Run:

```bash
uv run orion reset
for f in lessons/03_brain/ch1*.py; do echo "== $f"; uv run python "$f" || break; done
```

Expected: every file completes. ch16 pauses and resumes inside the file. ch18's N0 replays demo-1 because a fresh process has no history. Note the wall-clock time of ch16 and ch18 in your report; they are the long ones.

- [ ] **Step 8: Commit**

```bash
git add lessons/03_brain
git commit -m "Add Lesson 3: search, toolkit with MCP, planner, specialists, human gate, parallel, time travel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Lesson smoke test

**Files:**
- Create: `tests/test_lessons_smoke.py`

- [ ] **Step 1: Write the test**

```python
# tests/test_lessons_smoke.py
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
```

- [ ] **Step 2: Run it**

Run: `uv run pytest tests/test_lessons_smoke.py -v`
Expected: 20 passed. A failure names the file and the missing or duplicated tag; fix the lesson file, not the test.

- [ ] **Step 3: Commit**

```bash
git add tests/test_lessons_smoke.py
git commit -m "Add lesson smoke test: files parse, cell tags unique and complete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: READMEs and notebook removal

**Files:**
- Create: `lessons/README.md`
- Modify: `README.md` (replace)
- Delete: `Notebooks/01_code_generator_with_tools.ipynb`, `Notebooks/02_self_correcting_code_agent.ipynb`, `Notebooks/03_production_coding_agent.ipynb`, `Notebooks/CONTENTS.md`, `Notebooks/README.md`, `Notebooks/test.csv`

- [ ] **Step 1: Write `lessons/README.md`**

```markdown
# Lessons

Three lessons, eighteen files, run live from Cursor. Each file is a sequence of `# %%` cells. Put the cursor in a cell and press Shift+Enter to run it in the interactive window; the output appears next to the code. A file also runs top to bottom with `uv run python lessons/<lesson>/<file>.py`.

| Lesson | Files | What it gives the agent |
|---|---|---|
| 1 Hands | ch01 to ch07 | Tools, the agent loop, rules, streaming, memory |
| 2 Self-awareness | ch08 to ch12 | Structured output, sandboxed execution, retries, a reviewer, rules and skills, inline edits |
| 3 Brain | ch13 to ch18 | Codebase search, MCP tools, a planner, a human gate, parallel coders, time travel |

## Setup on the teaching machine

```bash
uv sync
cp .env.example .env        # add OPENROUTER_API_KEY; PARALLEL_API_KEY is optional
uv run orion check-models   # both model IDs must resolve on OpenRouter
uv run orion reset          # copies sample_project/ into workspace/
```

Open the repository folder in Cursor (not a subfolder) and select the `.venv` interpreter when the interactive window asks.

## Cell tags

`# %% C3` is the third cell of the original lesson; `# %% N1` is a cell added later. The instructor script refers to these tags. A trailing `web` on a tag marks a cell whose code appears on the curriculum site.

## Before the session

1. `uv run orion reset`. The workspace must contain only `app.py`, `chat.py`, `config.py`, and `test_app.py`.
2. Run Lesson 1 and Lesson 2 files end to end once so the outputs are cached in your head and the models are warm.
3. Run ch16 once. It pauses; approve it. Then run ch18. Note how long each takes.
4. `uv run orion reset` again.
5. `uv run pytest` must be green.

## During the session

- ch07's last cell resets the workspace. Do not run it live.
- ch16, ch17, and ch18 share one agent when they run in the same interactive window. If you restart the kernel between them, ch18 replays the first feature on its own (cell N0).
- ch14 and ch16's research step call the Parallel Search MCP server. It works without a key; if the network is down, ch14 N1 is the only cell that fails.
```

- [ ] **Step 2: Replace the root `README.md`**

```markdown
# Orion

Build an AI coding agent with LangChain and LangGraph, one capability at a time: tools, a self-correcting loop, then a planner, a reviewer, a human gate, and parallel coders, all working on a small Streamlit app.

**Site:** the curriculum companion (URL in `web/README.md` once deployed).

## What is here

| Path | What |
|---|---|
| `src/orion_agent/` | The agent: workspace jail, sandbox, tools, rules, skills, MCP, search, and the LangGraph graphs |
| `lessons/` | Eighteen Python files with `# %%` cells, taught live from Cursor |
| `sample_project/` | The Streamlit chatbot the agent modifies; copied into `workspace/` by `orion reset` |
| `.cursor/rules/`, `.cursor/skills/`, `AGENTS.md`, `DESIGN.md` | The rules and skills the agent (and Cursor) read |
| `orion-ide/` | A FastAPI + React IDE that runs the same agent |
| `web/` | The Next.js curriculum site |
| `tests/` | Offline tests against a stub model |

## Setup

```bash
uv sync
cp .env.example .env   # add OPENROUTER_API_KEY
uv run orion reset
uv run pytest
```

Then open `lessons/README.md`.

## Stack

Python 3.13 with uv. langchain 1.x, langgraph 1.x, langchain-mcp-adapters, pydantic 2. OpenRouter for models. Parallel Search MCP for web research. Next.js 15 and React 19 for the site.
```

- [ ] **Step 3: Delete the notebooks**

Run:

```bash
git rm -q Notebooks/01_code_generator_with_tools.ipynb Notebooks/02_self_correcting_code_agent.ipynb Notebooks/03_production_coding_agent.ipynb Notebooks/CONTENTS.md Notebooks/README.md Notebooks/test.csv
ls Notebooks
```

Expected: only `orion` remains (Plan 3 moves it).

- [ ] **Step 4: Check nothing references the notebooks**

Run: `grep -rn "ipynb\|Notebooks/" --include=*.py --include=*.md --include=*.toml . | grep -v node_modules | grep -v "^./docs/" | grep -v "^./Notebooks/orion"`
Expected: no output. Fix any hit.

- [ ] **Step 5: Full suite and commit**

Run: `uv run pytest`
Expected: all green.

```bash
git add README.md lessons/README.md
git commit -m "Replace the notebooks with the lessons README and a fresh root README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Section 4's cell map is implemented file by file with the same tags, including the new cells (ch03 N1 prebuilt, ch05 N1 rule sources, ch06 N1 messages stream, ch07 N1 checkpointer, ch09 N1 timeout and N2 warning, ch11 N1 catalog and N2 skill load, ch13 N1 embeddings, ch14 N1 web research, ch16 N1 reject with reason, ch18 N0 replay). Section 2's `lessons/README.md` and root README: Task 7. Section 10's `test_lessons_smoke`: Task 6. Section 11 step 6 (delete notebooks, write READMEs): Task 7.

**Deviations, stated.** ch16 C13 prints "7 nodes, 4 conditional routes" because the hardening commit added a `plan` route for rejected paths; the spec said 3. ch16's reject demo (N1) runs on a workspace snapshot so the approved demo-1 files survive for ch17 and ch18. ch17 works on a snapshot for the same reason; the spec's C22 "apply to disk" applies to that copy. `sample_project/test_app.py` is new: without it the orchestrator would smoke-import `app.py`, which runs Streamlit at import time and fails.

**Type consistency.** `run()` returns the coroutine's value; every `ainvoke`/`aget_state` call goes through it. `demo_orchestrator(root, ws, *, with_web=False)` is called with two positional args everywhere. `print_messages(messages, width)` matches its definition. `Command(resume={"decision": ..., "feedback": ...})` matches `human_review_node`'s dict contract. `ws.snapshot()` returns a `Path`, wrapped in `Workspace(...)` before use.
