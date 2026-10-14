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
