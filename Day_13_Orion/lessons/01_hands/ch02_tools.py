# %% setup
"""Chapter 2: three tools, and the schema the decorator builds for each."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C3 three tools web
from orion_agent.tools import basic_tools

tools = basic_tools(ws)
# The decorator turns the docstring and type hints into the schema the model sees.
for t in tools:
    print(f"{t.name}: {t.description}")
    print(f"  schema: {t.args_schema.model_json_schema()['properties']}\n")

# Open src/orion_agent/tools.py to read the three functions. Every path is resolved
# against workspace/ and an escape comes back as an "Error: ..." string.

# %%
