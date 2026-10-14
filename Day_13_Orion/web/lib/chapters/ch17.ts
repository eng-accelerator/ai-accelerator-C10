import type { ChapterDef } from "../schema";

export const ch17: ChapterDef = {
  slug: "parallel-generation",
  number: 17,
  lesson: "Lesson 3",
  subtopicLabel: "3.5 Parallel Generation",
  title: "Parallel Code Generation",
  subtitle: "Fan out to per-file coders with the Send API for concurrent generation.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Parallelization"],
  intro: "When a plan has multiple independent file tasks, generating them sequentially wastes time. The Send API fans out to parallel coder subgraphs — one per file — then merges results back with custom reducers. This is how production agents achieve speed on multi-file changes.",
  takeaway: "The Send API turns sequential bottlenecks into parallel pipelines. Combined with reducers for merging results, you can scale code generation linearly with the number of files in a plan.",
  demos: [],
  backendCode: `/* lesson:begin */
import inspect

from orion_agent.graphs import parallel
from orion_agent.workspace import Workspace

snapshot = Workspace(ws.snapshot())  # the parallel demo works on a copy of the workspace
for name, kind in parallel.ParallelState.__annotations__.items():
    print(f"  {name}: {kind}")
print(inspect.getsource(parallel.add_to_list))
print(inspect.getsource(parallel.build_parallel_agent))

result = parallel_agent.invoke({"feature_request": (
    "Add two features to the chatbot: "
    "1) A conversation export button in the sidebar that saves chat history as a .txt file. "
    "2) A model selector dropdown in the sidebar that lets users pick from 3 models. "
    "Update config.py with available models, chat.py to accept a model parameter, "
    "and app.py for the UI controls. Accept the API key from the sidebar as before, do not change it."
)})
print("=" * 60)
print(f"  {len(result['generated_code'])} files generated in parallel")
print("=" * 60)
for item in result["generated_code"]:
    print(f"\\n--- {item['filepath']} ---")
    print(f"  {item['explanation'][:120]}")
    print(item["code"][:300])
    if len(item["code"]) > 300:
        print("  ...")

from orion_agent.graphs.orchestrator import run_tests
from orion_agent.sandbox import LocalSandbox

for item in result["generated_code"]:
    snapshot.write(item["filepath"], item["code"])
    print(f"  Applied: {item['filepath']}")
output, ok = run_tests(snapshot, LocalSandbox(), [i["filepath"] for i in result["generated_code"]])
print("\\nTests:", "PASS" if ok else "FAIL")
print(output)
/* lesson:end */`,
  backendFilename: "parallel_gen.py",
  chatConfig: {
    mode: "parallel-gen",
    defaultPrompt: "Add export button + model selector to the chatbot",
    conversations: {
      default: [
        {
          role: "tool",
          toolName: "plan",
          toolArgs: { feature: "Add export button + model selector" },
          content: `Plan: Add conversation export button and model selector dropdown to sidebar, update config.py with available models list, modify chat.py to accept model parameter, and update app.py UI

File Tasks:
  [modify] config.py
  [modify] chat.py
  [modify] app.py`,
        },
        {
          role: "tool",
          toolName: "fan_out",
          toolArgs: { parallel_coders: "3" },
          content: `Fanning out to 3 parallel coders...`,
        },
        {
          role: "tool",
          toolName: "parallel_code",
          toolArgs: { file: "chat.py" },
          content: `[parallel] Done: chat.py — Added model parameter to stream_response`,
        },
        {
          role: "tool",
          toolName: "parallel_code",
          toolArgs: { file: "app.py" },
          content: `[parallel] Done: app.py — Added model selector dropdown and export button UI`,
        },
        {
          role: "tool",
          toolName: "parallel_code",
          toolArgs: { file: "config.py" },
          content: `[parallel] Done: config.py — Added AVAILABLE_MODELS list`,
        },
        {
          role: "tool",
          toolName: "collect",
          toolArgs: { files: "3" },
          content: `Collected 3 files from parallel coders\n\n--- config.py ---\nAdded AVAILABLE_MODELS list with 3 model options\nCode: 216 chars\n\n--- chat.py ---\nAdded model parameter to stream_response function\nCode: 594 chars\n\n--- app.py ---\nAdded model selector dropdown and export conversation button\nCode: 1901 chars`,
        },
        {
          role: "assistant",
          content: `**Parallel Generation Complete** ⚡\n\n3 files generated concurrently using the Send API:\n\n| File | Change | Size |\n|------|--------|------|\n| config.py | Added AVAILABLE_MODELS list | 216 chars |\n| chat.py | Added model parameter to stream_response | 594 chars |\n| app.py | Added model selector + export button UI | 1901 chars |\n\nAll 3 coders ran in parallel and results were merged via the \`add_to_list\` reducer. Sequential generation would have taken 3x longer.`,
        },
      ],
    },
    generatedFile: {
      filename: "config.py",
      content: `PAGE_TITLE = "My ChatBot"
PAGE_ICON = "🤖"
MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"
AVAILABLE_MODELS = [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet"
]
`,
    },
  },
};
