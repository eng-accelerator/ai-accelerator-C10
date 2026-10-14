"""The IDE's chat: the Lesson 1 loop with every tool, the repo rules, and the skills catalog."""

from __future__ import annotations

from config import REPO_ROOT, WORKSPACE_PATH
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import get_llm
from orion_agent.rules import load_rules
from orion_agent.sandbox import LocalSandbox
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace

PERSONA = "You are Orion, an expert AI coding assistant working inside the user's workspace."


def create_chat_graph(api_key: str, model: str):
    llm = get_llm(model, api_key=api_key, temperature=0.1)
    tools = make_tools(Workspace(WORKSPACE_PATH), LocalSandbox())
    skills = load_skills(REPO_ROOT)
    system_prompt = "\n\n".join(part for part in (PERSONA, load_rules(REPO_ROOT), skills_catalog(skills)) if part)
    return build_tool_agent(llm, [*tools.values(), make_read_skill_tool(skills)], system_prompt=system_prompt)
