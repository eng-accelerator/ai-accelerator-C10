"""M0 — Naive RAG end-to-end + baseline eval.

This is the strawman. The simplest possible RAG pipeline, in ~40 lines:
    chunk → embed → cosine top-k → LLM

Most RAG tutorials stop here. We're going to break it on three queries, then
spend the next four modules fixing each break.

The point of M0 is not to ship — it's to establish a measurable baseline so
that every subsequent module (M2 hybrid, M3 contextual, M4 decomposition,
M5 agentic) can prove it actually moves a number.

Pipeline:
    1. Read 72 K8s markdown files from data/k8s-docs/
    2. Chunk each file into 512-token windows with 50-token overlap
       (the open-book-exam analogy: 5 students, 1 chapter each, slight overlap
       so meaning isn't severed at chapter boundaries)
    3. Embed each chunk with BAAI/bge-small-en-v1.5 (384-dim, free, fast)
    4. Store in an in-memory vector store
    5. At query time: embed query → cosine similarity → top-5 chunks → Haiku

Expected failures (this is the whole point):
    Q1 — `--max-pods` is a literal token; dense embeddings smear it into
         "pod limits" / "pod scheduling" semantics. Naive RAG returns vague
         pod-scheduling content and never says "110". Fixed by BM25 in M2.
    Q2 — the chunk that answers it doesn't contain "Ingress controller" by
         itself; chunking severed the reference. Half-truth answer. Fixed by
         contextual chunking in M3.
    Q3 — needs facts from 3 separate docs. One retrieval pass can't pull
         them all. Fixed by query decomposition in M4.

Run:
    python scripts/m0_naive.py
"""
from __future__ import annotations

import asyncio
import os
import sys

# Make `common` importable when run as `python m0_naive.py` from any directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    DATA_DIR,
    EMBED_MODEL,
    GENERATION_MODEL,
    OPENROUTER_BASE,
    TEST_QUERIES,
    check_openrouter,
    evaluate_async,
    print_scoreboard,
    require_env,
)


def build_naive_engine():
    """Build the naive RAG pipeline: chunk → embed → in-memory store → query engine."""
    from llama_index.core import (
        Settings,
        SimpleDirectoryReader,
        VectorStoreIndex,
    )
    from llama_index.core.node_parser import SentenceSplitter
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    from llama_index.llms.openai_like import OpenAILike

    # ---- 1. Configure embedding model + LLM + chunker (LlamaIndex globals) ----
    # bge-small-en-v1.5 is a 384-dim free embedding model. Dimension matters:
    # the smaller the embedding, the smaller the index and the faster the
    # cosine search. 384 is plenty for English doc retrieval.
    Settings.embed_model = HuggingFaceEmbedding(model_name=EMBED_MODEL)

    # OpenAILike points LlamaIndex at any OpenAI-compatible endpoint. We use
    # OpenRouter so a single API key gets us Claude, GPT, Gemini, free models, etc.
    Settings.llm = OpenAILike(
        model=GENERATION_MODEL,
        api_base=OPENROUTER_BASE,
        api_key=os.environ["OPENROUTER_API_KEY"],
        is_chat_model=True,
        is_function_calling_model=False,
        context_window=200000,
        max_tokens=1024,
    )

    # Chunk size and overlap are the two knobs everyone tunes. 512/50 is a
    # solid default: small enough that retrieval is precise, large enough
    # that semantic units survive. Overlap is the "photosynthesis paragraph"
    # that bridges chunk boundaries.
    Settings.node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)

    # ---- 2. Load and chunk the corpus ----
    print(f"Loading docs from {DATA_DIR}...")
    docs = SimpleDirectoryReader(
        str(DATA_DIR), recursive=True, required_exts=[".md"]
    ).load_data()
    print(f"  loaded {len(docs)} markdown files")

    # ---- 3. Embed and store ----
    # `from_documents` chunks each doc, embeds each chunk, and indexes them.
    # We use the default in-memory SimpleVectorStore — for ~800 chunks this
    # is trivially fast and avoids LanceDB's tokio loop fighting with our
    # asyncio loop on Python 3.14 / macOS (mid-eval "Not found" race).
    index = VectorStoreIndex.from_documents(docs)
    print("  index built (in-memory, ~800 chunks)")

    # ---- 4. Build a query engine ----
    # Top-k=5 means: retrieve the 5 most similar chunks, stuff them into the
    # LLM's prompt with the question, and ask for an answer.
    return index, index.as_query_engine(similarity_top_k=5)


async def main() -> None:
    """Build naive RAG, run the 3 test queries, eval against the goldset."""
    # Pre-flight: fail in 1 second on a bad key, not 10 minutes into the eval.
    require_env()
    check_openrouter()

    # ---- Build the strawman ----
    print("\n=== M0 — Build naive RAG ===")
    _, engine = build_naive_engine()

    # ---- Run the 3 canonical queries — watch them fail ----
    # Read the answers carefully. You'll see:
    #   Q1 — vague "pod limits" content, no `110`
    #   Q2 — generic Ingress description, missing the routing-decision logic
    #   Q3 — mentions rolling updates, misses StatefulSet ordering and PDBs
    # These three failure modes are exactly what M2/M3/M4 fix.
    print("\n=== M0 — 3 test queries ===")
    for q in TEST_QUERIES:
        print(f"\nQ: {q}")
        r = engine.query(q)
        ans = str(r)
        print(f"A: {ans[:600]}{'...' if len(ans) > 600 else ''}")
        srcs = [n.metadata.get("file_name", "?") for n in r.source_nodes[:3]]
        print(f"   sources: {srcs}")

    # ---- Wrap the query engine for the eval harness ----
    # evaluate_async expects a callable that returns {"answer", "contexts"}.
    # That's the contract every module conforms to, so they're all comparable.
    def naive_query(q: str) -> dict:
        r = engine.query(q)
        return {"answer": str(r), "contexts": [n.get_content() for n in r.source_nodes]}

    # ---- Eval — runs all 30 goldset questions across all 3 categories ----
    # Pass `sample=N` to evaluate_async (e.g. sample=10) for fast iteration.
    # All 30 = ~3-5 minutes on Gemini Flash judge.
    await evaluate_async(naive_query, "M0_naive")
    print_scoreboard()


if __name__ == "__main__":
    # asyncio.run gives us a fresh event loop. Inside Jupyter this is what
    # nest_asyncio tries (and fails) to provide.
    asyncio.run(main())
