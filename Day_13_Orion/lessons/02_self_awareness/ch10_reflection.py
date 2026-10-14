# %% setup
"""Chapter 10: a reviewer with fresh eyes, after the code runs."""
from orion_agent.lesson import setup, show

ROOT, ws = setup()

from orion_agent.llm import FAST, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
coder = structured(llm, CodeOutput)
sandbox = LocalSandbox()

# %% C17 the reviewer, on its own web
reviewer = structured(llm, ReviewResult)
test_code = "x = [1,2,3]\nfor i in x:\n  print(i)"
review = reviewer.invoke(f"Review this Python code for quality (type hints, naming, PEP 8, efficiency):\n\n{test_code}")
print(f"Approved: {review.approved}")
print(f"Feedback: {review.feedback}")

# %% C18 the full state and the review node web
import inspect

from orion_agent.graphs import self_correcting

for name, kind in self_correcting.FullAgentState.__annotations__.items():
    print(f"  {name}: {kind}")
print(inspect.getsource(self_correcting.build_full_agent))

# %% C19 compile
full_agent = self_correcting.build_full_agent(coder, reviewer, sandbox)
print("Full agent compiled")

# %% C20 draw it
show(full_agent, "generate -> execute -> review")

# %% C21 the sieve web
result = full_agent.invoke({
    "task": "Write a function to find all prime numbers up to n using the Sieve of Eratosthenes. Test it by printing primes up to 50.",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (after {result['attempts']} attempt(s))")
print(f"Output: {result['execution_result']}")
print(f"\nCode:\n{result['code']}")

# %% C22 trace the pipeline web
for step in full_agent.stream({
    "task": "Create a dataclass called 'Point' with x,y coordinates. Add methods for distance_to(other), midpoint(other), and __str__. Test with Point(3,4) and Point(0,0).",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
}):
    node_name, state = next(iter(step.items()))
    if node_name == "generate":
        print(f"[generate] Attempt {state.get('attempts', '?')}: {state.get('explanation', '')[:100]}")
    elif node_name == "execute":
        if state.get("error"):
            print(f"[execute] FAILED: {state['error'][:150]}")
        else:
            print(f"[execute] OK: {state['execution_result'][:150]}")
    elif node_name == "review":
        print(f"[review] {state.get('status', '')}: {state.get('review_feedback', '')[:150]}")
    print()

# %%
