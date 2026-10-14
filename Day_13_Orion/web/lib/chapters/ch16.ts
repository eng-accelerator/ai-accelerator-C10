import type { ChapterDef } from "../schema";

export const ch16: ChapterDef = {
  slug: "human-in-the-loop",
  number: 16,
  lesson: "Lesson 3",
  subtopicLabel: "3.4 Human-in-the-Loop",
  title: "Human-in-the-Loop with Tests",
  subtitle: "Plan, code, test, review, then stop and ask. A reject carries a reason back to the coder.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Human-in-the-Loop"],
  intro: "Tests run before anyone reviews. The graph applies the generated files to a scratch copy of the workspace, runs pytest there, and routes failures back to the coder with the output. Only passing code reaches the AI reviewer, and only reviewed code reaches you. interrupt() freezes the graph with the plan, the diff previews, the test output, and the review in hand. You resume it with approve, or with reject and a sentence of feedback that the coder reads verbatim. Then it applies for real and verifies again.",
  takeaway: "Tests are the verification primitive; the model reviewer is a second opinion; the human is the gate. A reject with a reason is worth more than a reject alone, so the graph resets its counters and tries again with your words in the prompt.",
  demos: [],
  backendCode: `/* lesson:begin */
import inspect

from orion_agent.graphs import orchestrator

source = inspect.getsource(orchestrator.build_orchestrator)
start = source.index("def human_review_node")
print(source[start : source.index("def route_after_human")])

agent = demo_orchestrator(ROOT, ws)
nodes = set(agent.get_graph().nodes) - {"__start__", "__end__"}
print(f"Agent compiled: {len(nodes)} nodes, 4 conditional routes, checkpointing enabled")
print(sorted(nodes))

# One call. The graph plans, codes, runs the tests on a *copy* of the workspace,
# asks the AI reviewer, and then hits interrupt() in human_review_node. The call
# returns with an \`__interrupt__\` key instead of a finished result.
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
print("Sending feature request to the agent...\\n")
result = run(agent.ainvoke({"feature_request": FEATURE}, config))

payload = result["__interrupt__"][0].value  # what interrupt() handed back to us
print("=" * 60)
print("Agent paused. Waiting for human review")
print("=" * 60)
print(f"Plan: {payload['plan']}")
print(f"Review: {payload['review_result'][:200]}")
print(f"Tests:\\n{payload['test_output'][:400]}")
for change in payload["changes"]:
    print(f"  [{change['action']}] {change['filepath']}: {change['explanation'][:80]}")

# The payload carries every file in full (\`code\`) and a unified diff against the
# file that is on disk right now (\`diff\`). Nothing has been written yet.
for change in payload["changes"]:
    print(change["diff"] or f"(no changes to {change['filepath']})")

state = run(agent.aget_state(config))
print(f"Agent is waiting at node: {state.next}\\n")
for item in state.values["generated_code"]:
    print("=" * 60)
    print(f"  {item['filepath']}")
    print("=" * 60)
    print(item["code"])
    print()

# Command(resume=...) is LangGraph's way of answering an interrupt. The graph
# wakes up inside human_review_node with our decision, routes to apply (writes
# the files) and verify (runs the tests on the real workspace), then ends.
from langgraph.types import Command

result = run(agent.ainvoke(Command(resume={"decision": "approve", "feedback": ""}), config))
print(f"Status: {result['status']}")
print(f"\\nTest output:\\n{result['test_output']}")

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
    print(f"--- {change['filepath']} ---\\n{change['diff']}\\n")
/* lesson:end */`,
  backendFilename: "ch16_human_in_the_loop.py",
  chatConfig: {
    mode: "human-in-the-loop",
    defaultPrompt: "Add a system prompt feature to the chatbot",
    conversations: {
      approve: [
        {
          role: "tool",
          toolName: "plan",
          toolArgs: { feature: "Add a system prompt feature" },
          content: `Plan: Add system prompt feature with default config, modify chat logic, and add sidebar UI

File Tasks:
  [modify] sample_project/config.py
  [modify] sample_project/chat.py
  [modify] sample_project/app.py`,
        },
        {
          role: "tool",
          toolName: "code",
          toolArgs: { files: "3 file tasks" },
          content: `Generated: sample_project/config.py (244 chars)
Generated: sample_project/chat.py (546 chars)
Generated: sample_project/app.py (1385 chars)`,
        },
        {
          role: "tool",
          toolName: "review",
          toolArgs: { attempt: "1/2" },
          content: `Review [1/2]: APPROVED — Code is functional and well-structured.`,
        },
        {
          role: "system",
          content: `⏸️ AGENT PAUSED — Waiting for human review\n\nPlan: Add system prompt feature with default config, modify chat logic, and add sidebar UI\nReview attempts: 1\nFiles: 3\n  sample_project/config.py: Added DEFAULT_SYSTEM_PROMPT variable\n  sample_project/chat.py: Added optional system_prompt parameter\n  sample_project/app.py: Added system prompt editing sidebar`,
        },
        {
          role: "tool",
          toolName: "human_decision",
          toolArgs: { decision: "approve" },
          content: `Command(resume="approve") → Resuming agent...`,
        },
        {
          role: "tool",
          toolName: "apply",
          toolArgs: { files: "3" },
          content: `Applied: sample_project/config.py
Applied: sample_project/chat.py
Applied: sample_project/app.py`,
        },
        {
          role: "tool",
          toolName: "test",
          toolArgs: { command: "import check" },
          content: `Tests: PASS\nAll imports OK`,
        },
        {
          role: "assistant",
          content: `**Approved & Applied** ✓\n\nHuman decision: **approve**\n\nThe agent applied all 3 files and ran smoke tests:\n- ✓ sample_project/config.py\n- ✓ sample_project/chat.py\n- ✓ sample_project/app.py\n\nTest output: All imports OK\n\nFinal status: **tested**`,
        },
      ],
      reject: [
        {
          role: "tool",
          toolName: "plan",
          toolArgs: { feature: "Add a system prompt feature" },
          content: `Plan: Add system prompt feature with default config, modify chat logic, and add sidebar UI

File Tasks:
  [modify] sample_project/config.py
  [modify] sample_project/chat.py
  [modify] sample_project/app.py`,
        },
        {
          role: "tool",
          toolName: "code",
          toolArgs: { files: "3 file tasks" },
          content: `Generated: sample_project/config.py (244 chars)
Generated: sample_project/chat.py (546 chars)
Generated: sample_project/app.py (1385 chars)`,
        },
        {
          role: "tool",
          toolName: "review",
          toolArgs: { attempt: "1/2" },
          content: `Review [1/2]: APPROVED — Code is functional and well-structured.`,
        },
        {
          role: "system",
          content: `⏸️ AGENT PAUSED — Waiting for human review\n\nPlan: Add system prompt feature with default config, modify chat logic, and add sidebar UI\nReview attempts: 1\nFiles: 3\n  sample_project/config.py: Added DEFAULT_SYSTEM_PROMPT variable\n  sample_project/chat.py: Added optional system_prompt parameter\n  sample_project/app.py: Added system prompt editing sidebar`,
        },
        {
          role: "tool",
          toolName: "human_decision",
          toolArgs: { decision: "reject" },
          content: `Command(resume="reject") → Routing back to coder...`,
        },
        {
          role: "tool",
          toolName: "code",
          toolArgs: { files: "3 file tasks (regenerating)" },
          content: `Regenerated: sample_project/config.py (268 chars)
Regenerated: sample_project/chat.py (612 chars)
Regenerated: sample_project/app.py (1520 chars)`,
        },
        {
          role: "tool",
          toolName: "review",
          toolArgs: { attempt: "2/2" },
          content: `Review [2/2]: APPROVED — Improved implementation with better error handling and documentation.`,
        },
        {
          role: "assistant",
          content: `**Rejected → Regenerated** ↻\n\nHuman decision: **reject**\n\nThe agent looped back to the coder node and regenerated all 3 files with improvements:\n- config.py: 244 → 268 chars (added docstring)\n- chat.py: 546 → 612 chars (better error handling)\n- app.py: 1385 → 1520 chars (improved UI)\n\nReviewer approved on second attempt. Agent is paused again at human review gate.`,
        },
      ],
    },
    generatedFile: {
      filename: "config.py",
      content: `PAGE_TITLE = "My ChatBot"
PAGE_ICON = "🤖"
MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Please provide clear, accurate, and helpful responses to user questions."
`,
    },
  },
};
