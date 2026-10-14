# tests/test_tool_agent.py
import asyncio
from typing import Any

import langchain.agents
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver

from orion_agent.graphs.tool_agent import build_tool_agent, prebuilt_agent
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


def test_prebuilt_agent_answers_and_passes_through_its_arguments(ws_dir, monkeypatch):
    captured: dict[str, Any] = {}
    create_agent = langchain.agents.create_agent

    def spy(model, tools=None, **kwargs):
        captured["kwargs"] = kwargs
        captured["tool_names"] = [t.name for t in tools]
        return create_agent(model, tools, **kwargs)

    monkeypatch.setattr(langchain.agents, "create_agent", spy)
    model = ScriptedChatModel(responses=[AIMessage(content="Nothing to change.")])
    agent = prebuilt_agent(model, basic_tools(Workspace(ws_dir)), system_prompt="Be terse.")

    result = agent.invoke({"messages": [HumanMessage(content="anything to change?")]})

    assert isinstance(result["messages"][-1], AIMessage)
    assert result["messages"][-1].content == "Nothing to change."
    assert captured["kwargs"] == {"system_prompt": "Be terse.", "checkpointer": None}
    assert captured["tool_names"] == ["read_file", "write_file", "list_directory"]
