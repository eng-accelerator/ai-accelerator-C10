# %% setup
"""Chapter 15: three specialists. What each one is told."""
from orion_agent.lesson import setup

ROOT, ws = setup()

import inspect

from orion_agent.graphs import orchestrator

# %% C9 the planner researches first web
print(orchestrator.RESEARCH_PROMPT)
print(orchestrator.PLAN_PROMPT)
print(inspect.getsource(orchestrator.check_task_paths))

# %% C10 the coder prompt, with feedback folded in web
print(inspect.getsource(orchestrator.build_code_prompt))
task = {"filepath": "config.py", "action": "modify", "description": "add DEFAULT_SYSTEM_PROMPT"}
state = {
    "codebase_context": "config.py: PAGE_TITLE, PAGE_ICON, MODEL, BASE_URL",
    "status": "needs_revision",
    "review_result": "Name the constant DEFAULT_SYSTEM_PROMPT and add a docstring.",
    "human_feedback": "",
}
print(orchestrator.build_code_prompt(state, task, rules_root=ROOT))

# %% C11 the reviewer sees only the diff and the tests web
print(inspect.getsource(orchestrator.build_review_prompt))
print(inspect.getsource(orchestrator.run_tests))
