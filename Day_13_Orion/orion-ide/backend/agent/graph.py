"""The IDE's orchestrator: the lesson graph, plus a hook that records skill loads for the trace."""

from __future__ import annotations

from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from config import REPO_ROOT, WORKSPACE_PATH
from orion_agent.graphs.orchestrator import build_orchestrator
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.skills import load_skills, read_skill_body, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace


def _recording_read_skill(skills, loaded: list[str]):
    by_name = {s.name: s for s in skills}

    @tool
    def read_skill(name: str) -> str:
        """Load the full instructions of a skill by name. Call this when a skill in the catalog matches the task."""
        skill = by_name.get(name)
        if skill is None:
            return f"Error: unknown skill '{name}'. Available: {', '.join(sorted(by_name))}"
        loaded.append(name)
        return read_skill_body(skill)

    return read_skill


def create_orchestrator(api_key: str, model: str):
    """Return (compiled graph, list that fills with loaded skill names as the planner works)."""
    llm = get_llm(model, api_key=api_key)
    ws = Workspace(WORKSPACE_PATH)
    sandbox = LocalSandbox()
    tools = make_tools(ws, sandbox)
    skills = load_skills(REPO_ROOT)
    loaded: list[str] = []
    research = build_tool_agent(
        llm,
        [tools["grep_files"], tools["glob_files"], tools["read_file"], _recording_read_skill(skills, loaded)],
        system_prompt=skills_catalog(skills) or None,
    )
    graph = build_orchestrator(
        structured(llm, Plan),
        structured(llm, CodeResult),
        structured(llm, ReviewResult),
        ws,
        sandbox,
        planner_agent=research,
        rules_root=REPO_ROOT,
        checkpointer=InMemorySaver(),
    )
    return graph, loaded
