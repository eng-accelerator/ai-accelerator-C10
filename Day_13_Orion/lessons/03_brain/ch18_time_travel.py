# %% setup
"""Chapter 18: every checkpoint, then a second feature end to end."""
from orion_agent.lesson import setup, run, demo_orchestrator

ROOT, ws = setup()

from langgraph.types import Command

agent = demo_orchestrator(ROOT, ws)
config = {"configurable": {"thread_id": "demo-1"}}

# %% N0 make sure demo-1 has a history (only needed when ch16 did not run in this kernel)
if not list(agent.get_state_history(config)):
    FEATURE = (
        "Add a system prompt feature to the chatbot. Add a DEFAULT_SYSTEM_PROMPT constant in config.py. "
        "Modify chat.py so stream_response accepts an optional system_prompt parameter and prepends it as a system message. "
        "Modify app.py to add a sidebar text area where users can edit the system prompt, and pass it to stream_response."
    )
    run(agent.ainvoke({"feature_request": FEATURE}, config))
    run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config))
    print("demo-1 replayed")

# %% C23 walk the checkpoints web
history = list(agent.get_state_history(config))
print(f"Total checkpoints for demo-1: {len(history)}\n")
for i, snapshot in enumerate(reversed(history)):
    values = snapshot.values
    print(
        f"  Step {i}: status={values.get('status', 'initial')}, files={len(values.get('generated_code', []))}, "
        f"tests={values.get('test_attempts', 0)}, reviews={values.get('review_attempts', 0)}, next={snapshot.next}"
    )

# %% C24 a second feature, streamed web
config2 = {"configurable": {"thread_id": "demo-2"}}


async def stream_second_feature() -> None:
    async for step in agent.astream({"feature_request": (
        "Add a 'Clear Chat' button to the sidebar in app.py that resets st.session_state.messages "
        "to an empty list and reruns the app. Also add a message counter in the sidebar that shows "
        "how many messages are in the conversation."
    )}, config2):
        node_name, output = next(iter(step.items()))
        if node_name == "__interrupt__":
            print("\n[PAUSED] waiting for your approval")
            continue
        if not isinstance(output, dict):
            continue
        if node_name == "plan":
            print(f"[PLAN] {output.get('plan', '')}")
            for ft in output.get("file_tasks", []):
                print(f"  [{ft['action']}] {ft['filepath']}")
        elif node_name == "code":
            for item in output.get("generated_code", []):
                print(f"[CODE] {item['filepath']}: {item['explanation'][:80]}")
        elif node_name == "test":
            print(f"[TEST] {output.get('status')}")
        elif node_name == "ai_review":
            print(f"[REVIEW] {output.get('status')}: {output.get('review_result', '')[:100]}")


run(stream_second_feature())

# %% C25 approve
result2 = run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config2))
print(f"Status: {result2['status']}")
print(f"\nTest output:\n{result2['test_output']}")

# %% C26 the files after two features
for rel in ("config.py", "chat.py", "app.py"):
    content = ws.read(rel)
    funcs = [line.strip() for line in content.splitlines() if line.strip().startswith("def ")]
    print(f"  {rel}: {content.count(chr(10)) + 1} lines, {len(funcs)} functions")
    for f in funcs:
        print(f"    {f[:70]}")
    print()
