# %% setup
"""Chapter 17: one coder per file, at the same time."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import STRONG, get_llm, structured
from orion_agent.schemas import CodeResult, Plan

llm = get_llm(STRONG)

# %% C19 a clean copy, and the parallel state web
import inspect

from orion_agent.graphs import parallel
from orion_agent.workspace import Workspace

snapshot = Workspace(ws.snapshot())  # the parallel demo works on a copy of the workspace
for name, kind in parallel.ParallelState.__annotations__.items():
    print(f"  {name}: {kind}")
print(inspect.getsource(parallel.add_to_list))
print(inspect.getsource(parallel.build_parallel_agent))

# %% C20 compile and draw
parallel_agent = parallel.build_parallel_agent(structured(llm, Plan), structured(llm, CodeResult), snapshot, rules_root=ROOT)
print("Parallel agent compiled\n")
show(parallel_agent, "plan -> Send(code_file) x N -> collect")

# %% C21 fan out web
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
    print(f"\n--- {item['filepath']} ---")
    print(f"  {item['explanation'][:120]}")
    print(item["code"][:300])
    if len(item["code"]) > 300:
        print("  ...")

# %% C22 apply to the copy and verify web
from orion_agent.graphs.orchestrator import run_tests
from orion_agent.sandbox import LocalSandbox

for item in result["generated_code"]:
    snapshot.write(item["filepath"], item["code"])
    print(f"  Applied: {item['filepath']}")
output, ok = run_tests(snapshot, LocalSandbox(), [i["filepath"] for i in result["generated_code"]])
print("\nTests:", "PASS" if ok else "FAIL")
print(output)
