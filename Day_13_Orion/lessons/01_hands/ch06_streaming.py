# %% setup
"""Chapter 6: streaming. Tokens as they are produced, tool calls as they start and end."""
from orion_agent.lesson import setup, run

ROOT, ws = setup()

from langchain_core.messages import HumanMessage, SystemMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import FAST, get_llm
from orion_agent.rules import load_rules
from orion_agent.tools import basic_tools

SYSTEM_PROMPT = load_rules(ROOT, "workspace/generated/calculator.py")
agent = build_tool_agent(get_llm(FAST), basic_tools(ws))

# %% C13 astream_events web
async def stream_agent(user_message: str) -> None:
    inputs = {"messages": [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)]}
    async for event in agent.astream_events(inputs, version="v2"):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                print(chunk.content, end="", flush=True)
        elif event["event"] == "on_tool_start":
            print(f"\n--- calling tool: {event['name']} ---")
        elif event["event"] == "on_tool_end":
            print("--- tool done ---\n")


run(stream_agent("List files in the 'generated' directory and read calculator.py"))

# %% N1 the simpler API: stream_mode="messages"
async def stream_messages(user_message: str) -> None:
    inputs = {"messages": [HumanMessage(content=user_message)]}
    async for token, _metadata in agent.astream(inputs, stream_mode="messages"):
        if token.content:
            print(token.content, end="", flush=True)
    print()


run(stream_messages("In one sentence, what is in generated/calculator.py?"))

# %%
