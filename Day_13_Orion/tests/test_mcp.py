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
