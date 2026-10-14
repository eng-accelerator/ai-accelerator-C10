# %% setup
"""Chapter 11: rules are always on and scoped by path. Skills load on demand."""
from orion_agent.lesson import setup, print_messages

ROOT, ws = setup()

from orion_agent.graphs.self_correcting import build_full_agent
from orion_agent.llm import FAST, get_llm, structured
from orion_agent.rules import load_rules
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
full_agent = build_full_agent(structured(llm, CodeOutput), structured(llm, ReviewResult), LocalSandbox())

# %% C23 rules from files, scoped by glob web
# .cursor/rules/python.mdc applies to every .py file. .cursor/rules/tests.mdc applies only to test files.
app_rules = load_rules(ROOT, "workspace/app.py")
test_rules = load_rules(ROOT, "workspace/tests/test_sort.py")
print("rules for app.py mention tests.mdc:", "tests.mdc" in app_rules)
print("rules for tests/test_sort.py mention tests.mdc:", "tests.mdc" in test_rules)

result_with_rules = full_agent.invoke({
    "task": "Write a function to sort a list of dictionaries by a given key. Test with sample data.",
    "rules": test_rules,
    "attempts": 0,
    "max_attempts": 3,
})
print("=== With the test-file rules ===")
print(result_with_rules["code"])

# %% N1 the skills catalog web
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog

skills = load_skills(ROOT)
print(skills_catalog(skills))
# The agent sees only these lines. It loads a body when a description matches.

# %% N2 watch the agent load a skill web
from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent

skill_agent = build_tool_agent(llm, [make_read_skill_tool(skills)], system_prompt=skills_catalog(skills))
result = skill_agent.invoke({"messages": [HumanMessage(content=(
    "I am about to add a feature to an unfamiliar codebase. Load the skill that covers this "
    "and give me its steps, one line each."
))]})
print_messages(result["messages"], width=300)

# %%
