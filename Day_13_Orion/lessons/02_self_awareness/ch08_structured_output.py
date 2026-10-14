# %% setup
"""Chapter 8: structured output. The code and the explanation arrive as separate fields."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C1 api key
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found")

# %% C2 ready
from orion_agent.llm import FAST, get_llm

llm = get_llm(FAST)
print(llm.invoke("Say 'ready' if you can hear me.").content)

# %% C3 raw: one blob web
result = llm.invoke("Write a Python function that checks if a number is prime")
print(result.content)

# %% C4 structured: a CodeOutput web
from orion_agent.llm import structured
from orion_agent.schemas import CodeOutput

structured_llm = structured(llm, CodeOutput)
result = structured_llm.invoke("Write a Python function that checks if a number is prime")

# %% C5 it is an object
print(f"Type: {type(result)}")

# %% C6 the explanation
print(f"\nExplanation: {result.explanation}")

# %% C7 the code
print(f"\nCode:\n{result.code}")

# %%
