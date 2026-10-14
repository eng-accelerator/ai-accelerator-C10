# %% setup
"""Chapter 12: edit existing code, then edit it under rules."""
from orion_agent.lesson import setup

ROOT, ws = setup()

from orion_agent.graphs.self_correcting import build_full_agent
from orion_agent.llm import FAST, get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult

llm = get_llm(FAST)
full_agent = build_full_agent(structured(llm, CodeOutput), structured(llm, ReviewResult), LocalSandbox())

# %% C24 inline edit web
existing_code = """
def greet(name):
    print("Hello " + name)

greet("World")
"""
result = full_agent.invoke({
    "task": f"""Modify this existing code:
```python
{existing_code}
```

Changes requested:
- Add type hints
- Add a docstring
- Support an optional greeting parameter (default "Hello")
- Return the string instead of printing it
- Add tests that verify the output""",
    "rules": "",
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (attempts: {result['attempts']})")
print(f"Output: {result['execution_result']}")
print(f"\nModified code:\n{result['code']}")

# %% C25 rules plus inline edit web
legacy_code = """
import csv

def read_data(file):
    f = open(file)
    r = csv.reader(f)
    data = []
    for row in r:
        data.append(row)
    f.close()
    return data

d = read_data("test.csv")
print(d)
"""
MODERNIZE_RULES = """- Use context managers (with statement) for file handling
- Use pathlib.Path instead of string paths
- Use list comprehensions where appropriate
- Add proper error messages
- Use type hints everywhere"""
result = full_agent.invoke({
    "task": f"""Modernize this legacy code:
```python
{legacy_code}
```
Rewrite it following modern Python best practices. Create a small test CSV inline using io.StringIO for testing.""",
    "rules": MODERNIZE_RULES,
    "attempts": 0,
    "max_attempts": 3,
})
print(f"Status: {result['status']} (attempts: {result['attempts']})")
print(f"Output: {result['execution_result']}")
print(f"\nModernized code:\n{result['code']}")
