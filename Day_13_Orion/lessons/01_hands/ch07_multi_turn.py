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
