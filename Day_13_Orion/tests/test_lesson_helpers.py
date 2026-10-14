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


def test_fresh_llm_reloads_current_fast(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    llm = lesson.fresh_llm()
    assert llm.model_name == "openai/gpt-4.1-mini"
    assert llm.extra_body["route"] == "fallback"
    assert "google/gemini-2.5-flash" in llm.extra_body["models"]


def test_demo_orchestrator_is_cached(ws_dir, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    root = ws_dir.parent
    a = lesson.demo_orchestrator(root, lesson.Workspace(ws_dir))
    b = lesson.demo_orchestrator(root, lesson.Workspace(ws_dir))
    assert a is b
    names = set(a.get_graph().nodes) - {"__start__", "__end__"}
    assert names == {"plan", "code", "test", "ai_review", "human_review", "apply", "verify"}


# --- helpers for the human gate --------------------------------------------------------------

from langgraph.checkpoint.memory import InMemorySaver

from orion_agent.graphs.orchestrator import build_orchestrator
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, FileTask, Plan, ReviewResult
from tests.conftest import Scripted

_PLAN = Plan(summary="s", file_tasks=[FileTask(filepath="config.py", description="d", action="modify")])
_GOOD = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = "S"\n', explanation="added")
_OK = ReviewResult(approved=True, feedback="Looks good")


def _paused_graph(ws_dir):
    graph = build_orchestrator(
        Scripted(_PLAN), Scripted(_GOOD, _GOOD), Scripted(_OK), lesson.Workspace(ws_dir), LocalSandbox(),
        checkpointer=InMemorySaver(),
    )
    config = {"configurable": {"thread_id": "h1"}}
    lesson.run(graph.ainvoke({"feature_request": "x"}, config))
    return graph, config


def test_pending_review_returns_the_payload_while_paused(ws_dir):
    graph, config = _paused_graph(ws_dir)
    payload = lesson.pending_review(graph, config)
    assert payload is not None
    assert payload["changes"][0]["filepath"] == "config.py"
    assert lesson.pending_review(graph, {"configurable": {"thread_id": "never-ran"}}) is None


def test_approve_helper_applies_and_then_refuses_to_run_twice(ws_dir):
    graph, config = _paused_graph(ws_dir)
    result = lesson.approve(graph, config)
    assert result["status"] == "done"
    assert lesson.pending_review(graph, config) is None
    try:
        lesson.approve(graph, config)
    except RuntimeError as exc:
        assert "not waiting" in str(exc)
    else:
        raise AssertionError("approve on a finished thread must raise a clear error")


def test_reject_helper_needs_a_reason_and_pauses_again(ws_dir):
    graph, config = _paused_graph(ws_dir)
    try:
        lesson.reject(graph, config, "")
    except ValueError as exc:
        assert "reason" in str(exc)
    else:
        raise AssertionError("an empty reason must be refused")
    result = lesson.reject(graph, config, "call it TAGLINE")
    assert "__interrupt__" in result
    assert lesson.pending_review(graph, config) is not None
