# %% setup
"""Chapter 13: the codebase brain is grep, glob, and read, with a model in the loop."""
from orion_agent.lesson import setup, print_messages

ROOT, ws = setup()

# %% C1 api key
import os

print("API key loaded" if os.getenv("OPENROUTER_API_KEY") else "API key NOT found")

# %% C2 a stronger model for this lesson
from orion_agent.llm import STRONG, get_llm

llm = get_llm(STRONG)
print(llm.invoke("Say 'Agent Mode activated' if you can hear me.").content)

# %% C3 grep and a repo map web
from orion_agent.search import repo_map, search_codebase

for match in ws.grep("stream"):
    print(f"{match.path}:{match.line}: {match.text}")
print()
print(repo_map(ws))
print()
print(search_codebase(ws, "streaming chat response"))

# %% C4 an agent that searches on its own web
from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.tools import make_tools

tools = make_tools(ws, LocalSandbox())
searcher = build_tool_agent(llm, [tools["grep_files"], tools["glob_files"], tools["read_file"]])
result = searcher.invoke({"messages": [HumanMessage(content=(
    "How does the streaming response work in this project? Name the file and the function, in brief."
))]})
print_messages(result["messages"], width=160)

# %% N1 the 2023-2025 way: embeddings
from langchain_openai import OpenAIEmbeddings

from orion_agent.embeddings import build_index, semantic_search
from orion_agent.llm import BASE_URL

embeddings = OpenAIEmbeddings(model="openai/text-embedding-3-small", api_key=os.environ["OPENROUTER_API_KEY"], base_url=BASE_URL)
store = build_index(ws, embeddings)
print(semantic_search(store, "streaming chat response", k=2))
print("""
This is what Cursor's @codebase did until it turned the embedding index off.
An index has to be built, kept fresh, and paid for. grep plus a model that
decides what to read finds the same code with none of that. Claude Code, Codex,
Cline, and Aider never used embeddings.
""")
