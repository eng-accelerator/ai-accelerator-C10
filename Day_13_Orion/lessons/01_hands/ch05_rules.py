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
