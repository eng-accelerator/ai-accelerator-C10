"""Helpers shared by the lesson files: paths, a sync runner, graph display, the human gate.

For learners: every lesson file starts with `ROOT, ws = setup()`. That one line
finds the repository root, loads your `.env` (with OPENROUTER_API_KEY), and
returns the `workspace/` folder the agent is allowed to touch.

The three helpers at the bottom (`pending_review`, `approve`, `reject`) are for
the human gate in Lesson 3. They are wrappers over LangGraph's `Command(resume=...)`
that first check the graph really is waiting for you, so a cell run twice gives a
clear message instead of quietly re-doing the whole run.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import importlib
import inspect
from pathlib import Path
from typing import Any, Coroutine

from dotenv import load_dotenv
from langchain_core.messages import BaseMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from orion_agent.graphs.orchestrator import build_orchestrator
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import STRONG, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace

__all__ = [
    "Workspace",
    "repo_root",
    "setup",
    "fresh_llm",
    "run",
    "show",
    "print_messages",
    "print_file",
    "demo_orchestrator",
    "pending_review",
    "approve",
    "reject",
]


def repo_root(start: Path | None = None) -> Path:
    """Walk up from `start` (default: cwd) to the folder that holds pyproject.toml and src/orion_agent."""
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "pyproject.toml").exists() and (candidate / "src" / "orion_agent").exists():
            return candidate
    raise RuntimeError("Run this from inside the orion-tutorial repository (open the repo folder in Cursor).")


def setup() -> tuple[Path, Workspace]:
    """Load .env and return (repo root, the workspace/ Workspace)."""
    start = Path.cwd()
    frame = inspect.currentframe()
    caller = frame.f_back if frame else None
    if caller:
        caller_file = Path(caller.f_code.co_filename)
        if caller_file.is_file():
            start = caller_file
    root = repo_root(start)
    load_dotenv(root / ".env")
    _reload_llm()
    return root, Workspace(root / "workspace")


def _reload_llm() -> None:
    from orion_agent import llm as llm_mod

    importlib.reload(llm_mod)


def fresh_llm(model: str | None = None, temperature: float = 0.0):
    """Reload orion_agent.llm and return a new OpenRouter client.

    Cursor's interactive window keeps `from orion_agent.llm import get_llm`
    bound to the function object from the first run. Without a reload, a
    later edit to FAST never reaches an already-open kernel.
    """
    _reload_llm()
    from orion_agent import llm as llm_mod

    return llm_mod.get_llm(model or llm_mod.FAST, temperature=temperature)


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


# --- the human gate ------------------------------------------------------------------------


def pending_review(agent, config: dict) -> dict | None:
    """Return the review payload if the graph is paused at the human gate, else None.

    The payload is what `interrupt()` handed back: plan, changes (with full code
    and a diff), test output, and the AI review. Reading it does not resume anything.
    """
    try:
        snapshot = agent.get_state(config)
    except Exception:  # noqa: BLE001 - an unknown thread has no state
        return None
    for task in getattr(snapshot, "tasks", ()) or ():
        for pending in getattr(task, "interrupts", ()) or ():
            return pending.value
    return None


def _resume(agent, config: dict, decision: dict) -> Any:
    if pending_review(agent, config) is None:
        thread = config.get("configurable", {}).get("thread_id", "?")
        raise RuntimeError(
            f"The agent is not waiting for a decision on thread {thread!r}. "
            "Either it already finished (check the workspace files) or it never paused. "
            "Run the feature request cell first, then approve or reject once."
        )
    return run(agent.ainvoke(Command(resume=decision), config))


def approve(agent, config: dict) -> Any:
    """Resume a paused run with an approval: apply the files, then verify with the tests."""
    return _resume(agent, config, {"decision": "approve", "feedback": ""})


def reject(agent, config: dict, reason: str) -> Any:
    """Resume a paused run with a reject and a reason. The coder reads the reason verbatim."""
    if not reason or not reason.strip():
        raise ValueError("reject() needs a reason: it is what the coder reads before trying again.")
    return _resume(agent, config, {"decision": "reject", "feedback": reason.strip()})
