import type { ChapterDef } from "../schema";

export const ch18: ChapterDef = {
  slug: "time-travel",
  number: 18,
  lesson: "Lesson 3",
  subtopicLabel: "3.6 Time-Travel Debugging",
  title: "Time-Travel Debugging",
  subtitle: "Inspect and replay any checkpoint in the agent's execution history.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Memory Management"],
  intro: "MemorySaver doesn't just enable human-in-the-loop — it creates a full audit trail. You can inspect the state at any checkpoint, replay from a previous point, or branch the execution to try different approaches. This is time-travel debugging for AI agents.",
  takeaway: "Checkpointed state history is the ultimate debugging tool for agents. When something goes wrong, you can rewind to any decision point, inspect the full state, and understand exactly why the agent made each choice.",
  demos: [],
  codeContent: `history = list(agent.get_state_history(config))

print(f"Total checkpoints for demo-1: {len(history)}")

for i, snapshot in enumerate(reversed(history)):
    status = snapshot.values.get("status", "initial")
    n_files = len(snapshot.values.get("generated_code", []))
    attempts = snapshot.values.get("review_attempts", 0)
    next_node = snapshot.next
    print(f"  Step {i}: status={status}, files={n_files}, review_attempts={attempts}, next={next_node}")`,
  codeFilename: "time_travel.py",
  backendCode: `/* lesson:begin */
history = list(agent.get_state_history(config))
print(f"Total checkpoints for demo-1: {len(history)}\\n")
for i, snapshot in enumerate(reversed(history)):
    values = snapshot.values
    print(
        f"  Step {i}: status={values.get('status', 'initial')}, files={len(values.get('generated_code', []))}, "
        f"tests={values.get('test_attempts', 0)}, reviews={values.get('review_attempts', 0)}, next={snapshot.next}"
    )

config2 = {"configurable": {"thread_id": "demo-2"}}


async def stream_second_feature() -> None:
    async for step in agent.astream({"feature_request": (
        "Add a 'Clear Chat' button to the sidebar in app.py that resets st.session_state.messages "
        "to an empty list and reruns the app. Also add a message counter in the sidebar that shows "
        "how many messages are in the conversation."
    )}, config2):
        node_name, output = next(iter(step.items()))
        if node_name == "__interrupt__":
            print("\\n[PAUSED] waiting for your approval")
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
/* lesson:end */`,
  backendFilename: "time_travel_debug.py",
  chatConfig: {
    mode: "time-travel",
    defaultPrompt: "Inspect agent state at this checkpoint",
    checkpoints: [
      { id: "after_plan", label: "After Plan", description: "Step 2: Plan generated, routing to coder" },
      { id: "after_code", label: "After Code", description: "Step 3: Code generated for 3 files" },
      { id: "after_review", label: "After Review", description: "Step 4: Reviewer approved, routing to human" },
      { id: "after_apply", label: "After Apply", description: "Step 6: Changes applied, running tests" },
    ],
    conversations: {
      after_plan: [
        {
          role: "tool",
          toolName: "get_state",
          toolArgs: { checkpoint: "Step 2 — After Plan" },
          content: `{
  "feature_request": "Add a system prompt feature to the chatbot",
  "codebase_context": "--- config.py ---\\nPAGE_TITLE = \\"My ChatBot\\"\\n...",
  "plan": "Add system prompt feature with default config, modify chat logic, and add sidebar UI",
  "file_tasks": [
    {"filepath": "config.py", "action": "modify", "description": "Add SYSTEM_PROMPT constant"},
    {"filepath": "chat.py", "action": "modify", "description": "Add system_prompt parameter"},
    {"filepath": "app.py", "action": "modify", "description": "Add sidebar UI for editing"}
  ],
  "generated_code": [],
  "review_result": "",
  "review_attempts": 0,
  "human_decision": "",
  "test_output": "",
  "status": "planned"
}`,
        },
        {
          role: "assistant",
          content: `**Checkpoint: After Plan** (Step 2)\n\n**Status**: planned\n**Next node**: code\n\n**State populated**:\n- ✓ feature_request\n- ✓ codebase_context (retrieved by codebase search)\n- ✓ plan (summary generated)\n- ✓ file_tasks (3 tasks)\n\n**State empty**:\n- ○ generated_code\n- ○ review_result\n- ○ human_decision\n- ○ test_output\n\nAt this checkpoint you could branch: modify the plan, add/remove file tasks, or skip straight to review.`,
        },
      ],
      after_code: [
        {
          role: "tool",
          toolName: "get_state",
          toolArgs: { checkpoint: "Step 3 — After Code" },
          content: `{
  "feature_request": "Add a system prompt feature to the chatbot",
  "codebase_context": "--- config.py ---\\n...",
  "plan": "Add system prompt feature with default config, modify chat logic, and add sidebar UI",
  "file_tasks": [
    {"filepath": "config.py", "action": "modify"},
    {"filepath": "chat.py", "action": "modify"},
    {"filepath": "app.py", "action": "modify"}
  ],
  "generated_code": [
    {"filepath": "config.py", "code": "PAGE_TITLE = ...", "explanation": "Added DEFAULT_SYSTEM_PROMPT"},
    {"filepath": "chat.py", "code": "def stream_response(client, messages, system_prompt=None)...", "explanation": "Added system_prompt parameter"},
    {"filepath": "app.py", "code": "import streamlit as st...", "explanation": "Added sidebar text_area for editing system prompt"}
  ],
  "review_result": "",
  "review_attempts": 0,
  "status": "coded"
}`,
        },
        {
          role: "assistant",
          content: `**Checkpoint: After Code** (Step 3)\n\n**Status**: coded\n**Next node**: review\n\n**State populated**:\n- ✓ feature_request\n- ✓ plan\n- ✓ file_tasks (3)\n- ✓ generated_code (3 files: config.py 244 chars, chat.py 546 chars, app.py 1385 chars)\n\n**State empty**:\n- ○ review_result\n- ○ human_decision\n- ○ test_output\n\nAt this checkpoint you could branch: manually edit the generated code before review, or replay with different coder temperature settings.`,
        },
      ],
      after_review: [
        {
          role: "tool",
          toolName: "get_state",
          toolArgs: { checkpoint: "Step 4 — After Review" },
          content: `{
  "feature_request": "Add a system prompt feature to the chatbot",
  "plan": "Add system prompt feature with default config, modify chat logic, and add sidebar UI",
  "file_tasks": [{"filepath": "config.py"}, {"filepath": "chat.py"}, {"filepath": "app.py"}],
  "generated_code": [
    {"filepath": "config.py", "code": "...", "explanation": "Added DEFAULT_SYSTEM_PROMPT"},
    {"filepath": "chat.py", "code": "...", "explanation": "Added system_prompt parameter"},
    {"filepath": "app.py", "code": "...", "explanation": "Added sidebar UI"}
  ],
  "review_result": "APPROVED — Code is functional and well-structured.",
  "review_attempts": 1,
  "human_decision": "",
  "status": "approved"
}`,
        },
        {
          role: "assistant",
          content: `**Checkpoint: After Review** (Step 4)\n\n**Status**: approved\n**Next node**: human_review\n\n**State populated**:\n- ✓ feature_request\n- ✓ plan\n- ✓ generated_code (3 files)\n- ✓ review_result: "APPROVED — Code is functional and well-structured."\n- ✓ review_attempts: 1\n\n**State empty**:\n- ○ human_decision\n- ○ test_output\n\nAt this checkpoint the reviewer passed the code. You could branch here to simulate a rejection and see the regeneration loop.`,
        },
      ],
      after_apply: [
        {
          role: "tool",
          toolName: "get_state",
          toolArgs: { checkpoint: "Step 6 — After Apply" },
          content: `{
  "feature_request": "Add a system prompt feature to the chatbot",
  "plan": "Add system prompt feature with default config, modify chat logic, and add sidebar UI",
  "file_tasks": [{"filepath": "config.py"}, {"filepath": "chat.py"}, {"filepath": "app.py"}],
  "generated_code": [
    {"filepath": "config.py", "code": "...", "explanation": "Added DEFAULT_SYSTEM_PROMPT"},
    {"filepath": "chat.py", "code": "...", "explanation": "Added system_prompt parameter"},
    {"filepath": "app.py", "code": "...", "explanation": "Added sidebar UI"}
  ],
  "review_result": "APPROVED — Code is functional and well-structured.",
  "review_attempts": 1,
  "human_decision": "approve",
  "test_output": "All imports OK",
  "status": "tested"
}`,
        },
        {
          role: "assistant",
          content: `**Checkpoint: After Apply** (Step 6)\n\n**Status**: tested\n**Next node**: (end)\n\n**All state populated**:\n- ✓ feature_request\n- ✓ plan\n- ✓ generated_code (3 files)\n- ✓ review_result: "APPROVED"\n- ✓ review_attempts: 1\n- ✓ human_decision: "approve"\n- ✓ test_output: "All imports OK"\n\nThis is the final state. The full journey: plan → code → review → human approve → apply → test → done. Every field in OrchestratorState has been filled.`,
        },
      ],
    },
  },
};
