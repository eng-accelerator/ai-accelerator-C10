# %% setup
"""Chapter 9: run the code, read the error, try again. Bounded."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import FAST, get_llm, structured
from orion_agent.schemas import CodeOutput

llm = get_llm(FAST)
coder = structured(llm, CodeOutput)

# %% C8 execute in the sandbox web
from orion_agent.sandbox import LocalSandbox

sandbox = LocalSandbox()
# Open src/orion_agent/sandbox.py: isolated interpreter, scrubbed environment, temp cwd,
# and a timeout that returns a result instead of raising.

# %% C9 working code
out = sandbox.run_python("print('hello world')")
print("Working code:", out)

# %% C10 broken code
out = sandbox.run_python("print(1/0)")
print("Broken code:", out)

# %% N1 a hang becomes a failed attempt, not a crash web
out = sandbox.run_python("import time; time.sleep(20)", timeout=3)
print(out)
print("ok:", out.ok, "timed_out:", out.timed_out)

# %% N2 this is a jail, not a sandbox
print("""
LocalSandbox stops the common accidents: no access to your environment variables,
no user site-packages, a temp working directory, a timeout.
It does NOT stop network access or resource exhaustion.
Shipped agents run generated code in a real sandbox:
  Claude Code: Seatbelt (macOS) / bubblewrap (Linux)   Codex: the same, network off by default
  Cursor cloud agents: Firecracker microVMs             OpenHands: Docker
DockerSandbox in sandbox.py is the stub to fill in when you need that.
""")

# %% C11 the state web
from orion_agent.graphs.self_correcting import AgentState

for name, kind in AgentState.__annotations__.items():
    print(f"  {name}: {kind}")

# %% C12 the nodes web
import inspect

from orion_agent.graphs import self_correcting

print(inspect.getsource(self_correcting._generate_prompt))
print(inspect.getsource(self_correcting._make_nodes))

# %% C13 compile web
from orion_agent.graphs.self_correcting import build_bugbot

bugbot = build_bugbot(coder, sandbox)
print("Self-correcting graph compiled")

# %% C14 draw it
show(bugbot, "generate -> execute -> retry")

# %% C15 easy task: first try web
result = bugbot.invoke({"task": "Print the first 10 Fibonacci numbers", "attempts": 0, "max_attempts": 3})
print(f"Status: {result['status']}")
print(f"Attempts: {result['attempts']}")
print(f"Explanation: {result['explanation']}")
print(f"Output: {result['execution_result']}")
print(f"Code:\n{result['code']}")

# %% C16 hard task: watch the retries web
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
