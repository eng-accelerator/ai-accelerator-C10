# %% setup
"""Chapter 1: the LLM, through OpenRouter."""
from orion_agent.lesson import setup

ROOT, ws = setup()

# %% C1 api key web
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found: copy .env.example to .env")

# %% C2 say hello web
from orion_agent.llm import FAST, get_llm

llm = get_llm(FAST)
print(llm.invoke("Say hello in one sentence.").content)

# %%
