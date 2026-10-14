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
