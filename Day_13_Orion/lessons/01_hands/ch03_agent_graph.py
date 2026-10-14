# %% setup
"""Chapter 3: the agent loop. The model decides, the tools run, the model sees the result."""
from orion_agent.lesson import setup, fresh_llm, show, print_messages

ROOT, ws = setup()

from orion_agent.tools import basic_tools

# fresh_llm() re-reads orion_agent/llm.py, so editing FAST there takes effect
# without restarting the kernel. get_llm(FAST) would also work in a fresh kernel.
llm = fresh_llm()
tools = basic_tools(ws)
print("model:", llm.model_name)

# %% C4 bind_tools: the model picks a tool web
# bind_tools hands the model the *schemas* (name, arguments, docstring) of the tools.
# Watch: the answer is empty and tool_calls is filled. The model decided; nothing ran.
llm_with_tools = llm.bind_tools(tools)
response = llm_with_tools.invoke("What files are in the current directory?")
print("Content:", response.content)
print("Tool calls:", response.tool_calls)

# %% C5 no tool needed
# A question that needs no tool gets a plain answer in one turn.
response = llm_with_tools.invoke("What is Python?")
print("Content:", response.content[:200])
print("Tool calls:", response.tool_calls)

# %% C6 the graph web
import inspect

from orion_agent.graphs import tool_agent

# Two nodes: agent and tools. One conditional edge: tool_calls or done.
print(inspect.getsource(tool_agent.build_tool_agent))
agent = tool_agent.build_tool_agent(llm, tools)
print("Graph compiled")

# %% C7 draw it
show(agent, "agent loop")

# %% C8 run it and read the trace web
from langchain_core.messages import HumanMessage

result = agent.invoke({"messages": [HumanMessage(content="List the files in the current directory")]})
print_messages(result["messages"])

# %% N1 the same loop, prebuilt
from orion_agent.graphs.tool_agent import prebuilt_agent

built_in = prebuilt_agent(llm, tools)
result = built_in.invoke({"messages": [HumanMessage(content="List the files in the current directory")]})
print(result["messages"][-1].content)
