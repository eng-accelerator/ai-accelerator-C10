# %% setup
"""Chapter 4: generate code and write it to a file."""
from orion_agent.lesson import setup, print_messages, print_file

ROOT, ws = setup()

from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.tools import basic_tools

agent = build_tool_agent(get_llm(FAST), basic_tools(ws))

# %% C9 the calculator web
result = agent.invoke({"messages": [HumanMessage(content="""
Create a Python file called 'generated/calculator.py' with a Calculator class that has:
- add, subtract, multiply, divide methods
- A history list that tracks all operations
- A get_history method that returns the history

Write the file using the write_file tool.
""")]})
print_messages(result["messages"])

# %% C10 the file
print_file(ws, "generated/calculator.py")

# %%
