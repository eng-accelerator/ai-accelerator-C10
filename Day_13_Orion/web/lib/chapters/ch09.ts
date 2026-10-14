import type { ChapterDef } from "../schema";

export const ch09: ChapterDef = {
  slug: "self-correction",
  number: 9,
  lesson: "Lesson 2",
  subtopicLabel: "2.2 Self Correction",
  title: "Self Correction in a Sandbox",
  subtitle: "Run the code, read the error, try again. Bounded retries, and a timeout that cannot crash the graph.",
  cursorFeature: "Bugbot",
  designPatterns: ["Reflection", "Exception Handling"],
  intro: "Generated code has to run before anyone trusts it. The agent executes each attempt through a small sandbox: an isolated interpreter, a scrubbed environment, a temporary working directory, and a timeout that comes back as a failed attempt instead of an exception. On failure the traceback goes into the next prompt and the loop tries again, at most three times.",
  takeaway: "Execution is the first review. A jail is not a sandbox, so the chapter names what shipped agents use instead; the loop itself is the same one Cursor's Bugbot runs.",
  demos: [],
  backendCode: `/* lesson:begin */
from orion_agent.sandbox import LocalSandbox

sandbox = LocalSandbox()
# Open src/orion_agent/sandbox.py: isolated interpreter, scrubbed environment, temp cwd,
# and a timeout that returns a result instead of raising.

out = sandbox.run_python("import time; time.sleep(20)", timeout=3)
print(out)
print("ok:", out.ok, "timed_out:", out.timed_out)

from orion_agent.graphs.self_correcting import AgentState

for name, kind in AgentState.__annotations__.items():
    print(f"  {name}: {kind}")

import inspect

from orion_agent.graphs import self_correcting

print(inspect.getsource(self_correcting._generate_prompt))
print(inspect.getsource(self_correcting._make_nodes))

from orion_agent.graphs.self_correcting import build_bugbot

bugbot = build_bugbot(coder, sandbox)
print("Self-correcting graph compiled")

result = bugbot.invoke({"task": "Print the first 10 Fibonacci numbers", "attempts": 0, "max_attempts": 3})
print(f"Status: {result['status']}")
print(f"Attempts: {result['attempts']}")
print(f"Explanation: {result['explanation']}")
print(f"Output: {result['execution_result']}")
print(f"Code:\\n{result['code']}")

inputs = {
    "task": "Write the diffusers code to generate an image of a cat using the model 'CompVis/stable-diffusion-v1-4'",
    "attempts": 0,
    "max_attempts": 3,
}
for step in bugbot.stream(inputs):
    node_name, state = next(iter(step.items()))
    if node_name == "generate":
        print(f"[generate] Attempt {state.get('attempts', '?')}")
        print(f"  Code preview: {state['code'][:80]}...")
    elif node_name == "execute":
        if state.get("error"):
            print(f"[execute] FAILED: {state['error'][:100]}")
        else:
            print(f"[execute] SUCCESS: {state['execution_result'][:100]}")
    print()

# %%
/* lesson:end */`,
  backendFilename: "ch09_self_correction.py",
  chatConfig: {
    mode: "self-correction",
    graphVisualization: true,
    graphNodes: [
      { id: "__start__", label: "__start__" },
      { id: "generate", label: "generate" },
      { id: "execute", label: "execute" },
      { id: "__end__", label: "__end__" },
    ],
    graphEdges: [
      { from: "__start__", to: "generate" },
      { from: "generate", to: "execute" },
      { from: "execute", to: "generate", label: "retry", style: "dashed" },
      { from: "execute", to: "__end__", label: "give_up", style: "dashed" },
      { from: "execute", to: "__end__", label: "success" },
    ],
    animationSequence: ["__start__", "generate", "execute", "__end__"],
    graphRunSteps: {
      easy: [
        {
          node: "generate",
          title: "Attempt 1",
          detail: `Generated fibonacci.py
def fibonacci(n): ...`,
        },
        {
          node: "execute",
          title: "Success",
          detail: "stdout: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]",
          status: "success",
        },
        {
          node: "__end__",
          title: "Done",
          detail: "Task completed successfully in 1 attempt.",
          status: "success",
        },
      ],
      hard: [
        {
          node: "generate",
          title: "Attempt 1",
          detail: `from diffusers import StableDiffusionPipeline
import torch`,
        },
        {
          node: "execute",
          title: "Failed",
          detail: "ModuleNotFoundError: No module named 'diffusers'",
          status: "error",
        },
        {
          node: "generate",
          title: "Attempt 2",
          detail: "Regenerated with torch_dtype=torch.float16",
        },
        {
          node: "execute",
          title: "Failed",
          detail: "ModuleNotFoundError: No module named 'diffusers'",
          status: "error",
        },
        {
          node: "generate",
          title: "Attempt 3",
          detail: "Added install guidance, but the sandbox still cannot import diffusers",
        },
        {
          node: "execute",
          title: "Give up",
          detail: "Max attempts reached after repeated missing-package failures.",
          status: "warning",
        },
        {
          node: "__end__",
          title: "Stopped",
          detail: "The bounded retry loop ended without another chat-tool transcript.",
          status: "warning",
        },
      ],
    },
    tasks: [
      {
        id: "easy",
        label: "Easy Task",
        description: "Print first 10 Fibonacci numbers (succeeds first try)",
      },
      {
        id: "hard",
        label: "Hard Task",
        description: "Generate image with Stable Diffusion and watch retries fail on missing diffusers",
      },
    ],
    defaultPrompt: "Run the selected task through the self-correcting agent",
    terminalLogs: {
      easy: [
        { tag: "PROCESS", text: "[generate] Attempt 1" },
        { tag: "TOOL", text: "Generated fibonacci.py" },
        { tag: "PROCESS", text: "[execute] python -c fibonacci.py" },
        { tag: "OK", text: "[execute] SUCCESS: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]" },
        { tag: "SUCCESS", text: "Task completed successfully in 1 attempt" },
      ],
      hard: [
        { tag: "PROCESS", text: "[generate] Attempt 1" },
        { tag: "TOOL", text: "Generated StableDiffusionPipeline code" },
        { tag: "ERROR", text: "[execute] FAILED: ModuleNotFoundError: No module named 'diffusers'" },
        { tag: "RETRY", text: "[generate] Attempt 2 (feeding error back to the model)" },
        { tag: "TOOL", text: "Regenerated with torch_dtype=torch.float16" },
        { tag: "ERROR", text: "[execute] FAILED: ModuleNotFoundError: No module named 'diffusers'" },
        { tag: "RETRY", text: "[generate] Attempt 3 (last retry)" },
        { tag: "TOOL", text: "Added install guidance, but the sandbox still cannot import diffusers" },
        { tag: "ERROR", text: "[execute] FAILED: ModuleNotFoundError: No module named 'diffusers'" },
        { tag: "WARN", text: "Max attempts reached; retry loop stopped" },
      ],
    },
    conversations: {
      easy: [
        {
          role: "tool",
          toolName: "generate",
          toolArgs: { attempt: "1" },
          content: `def fibonacci(n):
    fib_sequence = []
    a, b = 0, 1
    for _ in range(n):
        fib_sequence.append(a)
        a, b = b, a + b
    return fib_sequence

print(fibonacci(10))`,
        },
        {
          role: "tool",
          toolName: "execute",
          toolArgs: { status: "SUCCESS" },
          content: `stdout: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
returncode: 0`,
        },
        {
          role: "assistant",
          content: `✓ Task completed successfully in 1 attempt

**Explanation:** Generates the first n Fibonacci numbers using an iterative approach with two variables tracking the sequence.

**Output:** [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`,
        },
      ],
      hard: [
        {
          role: "tool",
          toolName: "generate",
          toolArgs: { attempt: "1" },
          content: `from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "CompVis/stable-diffusion-v1-4"
)
image = pipe("a cat").images[0]
image.save("cat.png")`,
        },
        {
          role: "tool",
          toolName: "execute",
          toolArgs: { status: "FAILED" },
          content: `Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'diffusers'`,
        },
        {
          role: "tool",
          toolName: "generate",
          toolArgs: { attempt: "2" },
          content: `import torch
from diffusers import StableDiffusionPipeline

pipe = StableDiffusionPipeline.from_pretrained(
    "CompVis/stable-diffusion-v1-4",
    torch_dtype=torch.float16
)
image = pipe("a cat").images[0]
image.save("cat.png")`,
        },
        {
          role: "tool",
          toolName: "execute",
          toolArgs: { status: "FAILED" },
          content: `Traceback (most recent call last):
  File "<string>", line 2, in <module>
ModuleNotFoundError: No module named 'diffusers'`,
        },
        {
          role: "tool",
          toolName: "generate",
          toolArgs: { attempt: "3" },
          content: `# Ensure diffusers is installed
# pip install diffusers transformers torch
from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "CompVis/stable-diffusion-v1-4"
)
image = pipe("a cat").images[0]
image.save("cat.png")`,
        },
        {
          role: "tool",
          toolName: "execute",
          toolArgs: { status: "FAILED" },
          content: `Traceback (most recent call last):
  File "<string>", line 3, in <module>
ModuleNotFoundError: No module named 'diffusers'`,
        },
        {
          role: "assistant",
          content: `✗ Task failed after 3 attempts (max retries reached)

The agent cannot install missing packages in the sandbox environment. Each retry attempted to fix the import but the \`diffusers\` module is simply not available.

This demonstrates the bounded retry pattern — the agent gives up gracefully after max_attempts rather than looping forever.`,
        },
      ],
    },
    generatedFile: {
      filename: "fibonacci.py",
      content: `def fibonacci(n):
    fib_sequence = []
    a, b = 0, 1
    for _ in range(n):
        fib_sequence.append(a)
        a, b = b, a + b
    return fib_sequence

print(fibonacci(10))`,
    },
  },
};
