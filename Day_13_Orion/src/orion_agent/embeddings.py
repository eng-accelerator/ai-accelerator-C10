"""The 2023 to 2025 approach: embed the codebase and search by similarity.

Kept as a footnote. Cursor turned its embedding index down in favour of grep;
Claude Code, Codex, Cline, and Aider never used one. Grep with a model in the
loop finds the same code with no index to build or keep fresh.
"""

from __future__ import annotations

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore

from orion_agent.workspace import Workspace


def build_index(ws: Workspace, embeddings: Embeddings) -> InMemoryVectorStore:
    docs = [Document(page_content=ws.read(p), metadata={"source": p}) for p in ws.glob("**/*.py")]
    return InMemoryVectorStore.from_documents(docs, embeddings)


def semantic_search(store: InMemoryVectorStore, query: str, k: int = 3) -> str:
    docs = store.similarity_search(query, k=k)
    return "\n\n".join(f"--- {d.metadata['source']} ---\n{d.page_content}" for d in docs)
