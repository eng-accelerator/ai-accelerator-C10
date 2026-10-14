# %% setup
"""Chapter 16: plan, code, test, review, then stop and ask.

How to read this file: each `# %%` cell runs on its own (Shift+Enter in Cursor).
Run them top to bottom, once each. The important moment is C15: the agent
stops before it writes anything and waits for you. C17 is where you say yes.

If you get lost, `pending_review(agent, config)` tells you whether the agent is
still waiting (it returns the review payload) or not (it returns None).
"""
from orion_agent.lesson import setup, run, show, print_file, demo_orchestrator, pending_review, approve, reject

ROOT, ws = setup()

# %% C12 the human node web
import inspect

from orion_agent.graphs import orchestrator

source = inspect.getsource(orchestrator.build_orchestrator)
start = source.index("def human_review_node")
print(source[start : source.index("def route_after_human")])

# %% C13 compile web
agent = demo_orchestrator(ROOT, ws)
nodes = set(agent.get_graph().nodes) - {"__start__", "__end__"}
print(f"Agent compiled: {len(nodes)} nodes, 4 conditional routes, checkpointing enabled")
print(sorted(nodes))

# %% C14 draw it
show(agent, "plan -> code -> test -> ai_review -> human_review -> apply -> verify")

# %% C15 watch it think, then pause web
# One call. The graph plans, codes, runs the tests on a *copy* of the workspace,
# asks the AI reviewer, and then hits interrupt() in human_review_node. The call
# returns with an `__interrupt__` key instead of a finished result.
# Run this cell ONCE. Running it again starts the whole run over on the same thread.
FEATURE = (
    "Add a system prompt feature to the chatbot. "
    "Add a DEFAULT_SYSTEM_PROMPT constant in config.py. "
    "Modify chat.py so stream_response accepts an optional system_prompt parameter "
    "and prepends it as a system message. "
    "Modify app.py to add a sidebar text area where users can edit the system prompt, "
    "and pass it to stream_response."
)
config = {"configurable": {"thread_id": "demo-1"}}
print("Sending feature request to the agent...\n")
result = run(agent.ainvoke({"feature_request": FEATURE}, config))

payload = result["__interrupt__"][0].value  # what interrupt() handed back to us
print("=" * 60)
print("Agent paused. Waiting for human review")
print("=" * 60)
print(f"Plan: {payload['plan']}")
print(f"Review: {payload['review_result'][:200]}")
print(f"Tests:\n{payload['test_output'][:400]}")
for change in payload["changes"]:
    print(f"  [{change['action']}] {change['filepath']}: {change['explanation'][:80]}")

# %% N2 what would change on disk, as a diff web
# The payload carries every file in full (`code`) and a unified diff against the
# file that is on disk right now (`diff`). Nothing has been written yet.
for change in payload["changes"]:
    print(change["diff"] or f"(no changes to {change['filepath']})")

# %% C16 the frozen state web
state = run(agent.aget_state(config))
print(f"Agent is waiting at node: {state.next}\n")
for item in state.values["generated_code"]:
    print("=" * 60)
    print(f"  {item['filepath']}")
    print("=" * 60)
    print(item["code"])
    print()

# %% C17 approve, apply, verify web
# Command(resume=...) is LangGraph's way of answering an interrupt. The graph
# wakes up inside human_review_node with our decision, routes to apply (writes
# the files) and verify (runs the tests on the real workspace), then ends.
from langgraph.types import Command

result = run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config))
print(f"Status: {result['status']}")
print(f"\nTest output:\n{result['test_output']}")

# %% N3 the safe way to say yes or no
# approve(agent, config) and reject(agent, config, reason) do the same thing as
# C17, but first check that the agent is really waiting. Try it now: the run above
# already finished, so this raises a clear message instead of silently doing nothing.
try:
    approve(agent, config)
except RuntimeError as exc:
    print("approve() refused:", exc)
print("pending_review:", pending_review(agent, config))

# %% C18 the applied files
for rel in ("config.py", "chat.py", "app.py"):
    print_file(ws, rel)

# %% N1 reject with a reason, on a second thread web
# A reject carries a reason. The coder gets it verbatim ("Human feedback (this
# overrides everything else)"), both attempt counters go back to 0, and the loop
# runs again: code, test, AI review, and back to you. This runs on a copy of the
# workspace so the files you just approved stay as they are.
config_b = {"configurable": {"thread_id": "demo-1b"}}
snapshot = ws.snapshot()  # keep the approved files; this thread works on a copy
from orion_agent.workspace import Workspace

scratch_agent = demo_orchestrator(ROOT, Workspace(snapshot))
paused = run(scratch_agent.ainvoke({"feature_request": "Add a PAGE_SUBTITLE constant to config.py and show it under the title in app.py."}, config_b))
print("paused with:", [c["filepath"] for c in paused["__interrupt__"][0].value["changes"]])

paused_again = reject(scratch_agent, config_b, "Call the constant TAGLINE, not PAGE_SUBTITLE, and keep it under 40 characters.")
state_b = run(scratch_agent.aget_state(config_b))
print("attempt counters after the reject:", state_b.values["review_attempts"], state_b.values["test_attempts"])
for change in paused_again["__interrupt__"][0].value["changes"]:
    print(f"--- {change['filepath']} ---\n{change['diff']}\n")

# %% N4 clean up the scratch copy
import shutil

shutil.rmtree(snapshot, ignore_errors=True)
print("scratch copy removed; workspace/ still has the approved files")
