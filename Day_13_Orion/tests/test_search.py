from langchain_core.embeddings import DeterministicFakeEmbedding

from orion_agent.embeddings import build_index, semantic_search
from orion_agent.search import repo_map, search_codebase
from orion_agent.workspace import Workspace


def test_search_codebase_ranks_files_by_hits(ws_dir):
    out = search_codebase(Workspace(ws_dir), "yield chunk stream")
    assert out.index("--- chat.py") < out.index("--- app.py")
    assert "2: def stream_response" in out


def test_search_codebase_no_match(ws_dir):
    assert search_codebase(Workspace(ws_dir), "quantum") == "No matches."


def test_repo_map_lists_defs(ws_dir):
    out = repo_map(Workspace(ws_dir))
    assert "app.py" in out and "def main" in out
    assert "chat.py" in out and "def stream_response" in out
    assert "config.py" in out and "PAGE_TITLE" in out


def test_semantic_search_returns_file_headers(ws_dir):
    store = build_index(Workspace(ws_dir), DeterministicFakeEmbedding(size=32))
    out = semantic_search(store, "streaming", k=2)
    assert out.count("--- ") == 2
