"""M2 — Hybrid retrieval + cross-encoder reranker.

The single biggest production move in RAG. If you ship one improvement to
naive RAG, ship this. Hybrid + rerank pulls 10-20 points of context-relevance
out of nowhere on identifier-heavy queries.

WHY DENSE EMBEDDINGS FAIL ON IDENTIFIERS:
    Dense embeddings encode *meaning*, not *strings*. The vector for
    `--max-pods` lands roughly where `pod limit flag` does. Both are near
    `pod scheduling`. So when Q1 asks "what's the default value of --max-pods",
    naive RAG retrieves "pod scheduling" docs that are *about* the right topic
    but don't contain the literal default value (110).

WHY BM25 IS THE OPPOSITE:
    BM25 scores by literal term overlap (TF-IDF weighted). `--max-pods`
    appears in exactly one place — the kubelet reference doc — so BM25 finds
    it instantly. Dense and sparse fail on different query classes; you need
    both for production traffic.

THE PIPELINE WE BUILD:

    query  ┐
           ├──► Dense top-20  ─┐
           │   (semantic match) │
           │                    │
           ├──► BM25 top-20    ─┼──► RRF fuse  ──►  Cross-encoder rerank ──► top-5
           │   (lexical match)  │   (rank-only,     (joint scoring of
           ┘                    │    bias-free      query+chunk pairs;
                                ┘    fusion)        slow but accurate)

THE TWO ALGORITHMS YOU'RE LEARNING:

  1. Reciprocal Rank Fusion (RRF):
        score(d) = Σ over retrievers r:  1 / (k + rank_r(d))      k = 60

     Why this and not score-addition? BM25 outputs unbounded floats, cosine
     outputs [-1, 1] — the scores aren't comparable. RRF only uses *rank*,
     which is comparable across any retriever. k=60 is from the original
     2009 paper (Cormack/Clarke/Buettcher); it dampens the head of the list
     just enough so #1 doesn't dominate.

  2. Cross-encoder rerank:
        Bi-encoder (BGE for embeddings): scores query and doc independently,
            then takes cosine. Fast, cacheable, less accurate.
        Cross-encoder (bge-reranker-base): takes (query, doc) AS A PAIR and
            outputs a single score. Slow (~50ms per pair on CPU), much more
            accurate. Can't pre-compute.

     Wide-then-narrow: retrieve 20 candidates from each retriever (cheap),
     fuse to 20 unique candidates, rerank those 20 (expensive but bounded),
     keep top-5.

Run:
    python scripts/m2_hybrid.py
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    DATA_DIR,
    EMBED_MODEL,
    GENERATION_MODEL,
    OPENROUTER_BASE,
    Q1,
    RERANK_MODEL,
    TEST_QUERIES,
    check_openrouter,
    evaluate_async,
    print_scoreboard,
    require_env,
)


def build_naive_index():
    """Build the same dense index as M0, but explicitly return the node list.

    BM25 needs the raw chunks to build its term-frequency dictionary. The
    in-memory vector store has them too but accessing them through LlamaIndex
    is awkward. Easier to chunk once and pass the list to both retrievers.
    """
    from llama_index.core import (
        Settings,
        SimpleDirectoryReader,
        VectorStoreIndex,
    )
    from llama_index.core.node_parser import SentenceSplitter
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    from llama_index.llms.openai_like import OpenAILike

    Settings.embed_model = HuggingFaceEmbedding(model_name=EMBED_MODEL)
    Settings.llm = OpenAILike(
        model=GENERATION_MODEL,
        api_base=OPENROUTER_BASE,
        api_key=os.environ["OPENROUTER_API_KEY"],
        is_chat_model=True,
        is_function_calling_model=False,
        context_window=200000,
        max_tokens=1024,
    )
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)
    Settings.node_parser = splitter

    print(f"Loading + chunking docs from {DATA_DIR}...")
    docs = SimpleDirectoryReader(
        str(DATA_DIR), recursive=True, required_exts=[".md"]
    ).load_data()
    print(f"  {len(docs)} files loaded")

    # `get_nodes_from_documents` returns the explicit node list (chunks) so
    # we can pass it to BM25Retriever. Then VectorStoreIndex(nodes) embeds
    # and stores them — same chunks both retrievers see.
    nodes = splitter.get_nodes_from_documents(docs)
    print(f"  {len(nodes)} chunks")

    index = VectorStoreIndex(nodes)
    return index, nodes


def rrf_fuse(result_lists, k: int = 60):
    """Reciprocal Rank Fusion.

    Combine N ranked lists into one ranking. Scores are unbounded; what
    matters is *order*. Used by every modern hybrid-retrieval system.

        score(d) = Σ 1 / (k + rank_r(d))   for each retriever r that returned d

    A doc that ranks #1 in dense and #1 in BM25 gets a much higher fused
    score than a doc that only appeared in one list. k=60 is the canonical
    constant — don't tune unless you have hundreds of test queries.
    """
    from llama_index.core.schema import NodeWithScore

    scores: dict[str, float] = {}
    by_id: dict[str, NodeWithScore] = {}
    for lst in result_lists:
        for rank, n in enumerate(lst):
            scores[n.node_id] = scores.get(n.node_id, 0.0) + 1.0 / (k + rank)
            by_id[n.node_id] = n
    ordered_ids = sorted(scores, key=scores.get, reverse=True)
    return [by_id[i] for i in ordered_ids]


def make_hybrid_engine(naive_index, all_nodes):
    """Build the dense + BM25 + RRF + reranker pipeline.

    Returns (retriever, engine, dense_wide, bm25_wide). The two _wide
    retrievers are kept around so we can do the dense-vs-BM25 side-by-side
    demo separately.
    """
    from llama_index.core.query_engine import RetrieverQueryEngine
    from llama_index.core.retrievers import BaseRetriever, VectorIndexRetriever
    from llama_index.core.schema import NodeWithScore, QueryBundle
    from llama_index.retrievers.bm25 import BM25Retriever
    from sentence_transformers import CrossEncoder

    print(f"  {len(all_nodes)} chunks for hybrid retrieval")

    # First load: ~280 MB download from HuggingFace, ~1 min.
    # After that it's cached at ~/.cache/huggingface/ and loads in seconds.
    print(f"  loading cross-encoder reranker ({RERANK_MODEL})...")
    reranker = CrossEncoder(RERANK_MODEL, max_length=512)

    # Wide retrieval: top-20 from each. We narrow to 5 only after rerank.
    # If we asked top-5 from each retriever directly, fusion has fewer
    # candidates and the reranker has less to work with.
    dense_wide = VectorIndexRetriever(index=naive_index, similarity_top_k=20)
    bm25_wide = BM25Retriever.from_defaults(nodes=all_nodes, similarity_top_k=20)

    class HybridRerankRetriever(BaseRetriever):
        """One retriever that combines all three stages."""
        def __init__(self, dense, bm25, reranker, fuse_top_k=20, final_top_k=5):
            self.dense = dense
            self.bm25 = bm25
            self.reranker = reranker
            self.fuse_top_k = fuse_top_k
            self.final_top_k = final_top_k
            super().__init__()

        def _retrieve(self, qb: QueryBundle):
            # Stage 1: parallel-ish retrieval (sequential here for clarity;
            # in production you'd run them concurrently)
            d = self.dense.retrieve(qb)
            b = self.bm25.retrieve(qb)

            # Stage 2: RRF fusion. Two ranked lists in, one fused list out.
            fused = rrf_fuse([d, b])[: self.fuse_top_k]
            if not fused:
                return []

            # Stage 3: cross-encoder rerank. The reranker scores each
            # (query, chunk) pair jointly. Slow but the most accurate signal
            # we have. Top-5 of these 20 wins.
            pairs = [[qb.query_str, n.get_content()] for n in fused]
            rerank_scores = self.reranker.predict(pairs)
            ranked = sorted(zip(rerank_scores, fused), key=lambda x: -x[0])
            return [
                NodeWithScore(node=n.node, score=float(s))
                for s, n in ranked[: self.final_top_k]
            ]

    retriever = HybridRerankRetriever(dense_wide, bm25_wide, reranker)
    engine = RetrieverQueryEngine.from_args(retriever=retriever)
    return retriever, engine, dense_wide, bm25_wide


def show_dense_vs_bm25(dense_wide, bm25_wide):
    """The money-shot demo: dense misses `--max-pods`, BM25 nails it.

    This is the single best 30-second illustration of why hybrid matters.
    Dense scores are bounded [0, 1]; BM25 scores are unbounded TF-IDF values.
    Don't try to compare them numerically — compare which docs they return.
    """
    from llama_index.core.retrievers import VectorIndexRetriever

    print("\n=== Dense top-5 vs BM25 top-5 for Q1 ===")
    print(f"Q1: {Q1}\n")

    # Top-5 (not top-20) so the side-by-side fits on screen
    dense_5 = VectorIndexRetriever(index=dense_wide._index, similarity_top_k=5)
    print("Dense top-5 (cosine similarity, range 0-1):")
    for n in dense_5.retrieve(Q1):
        path = n.metadata.get("file_path", "?")
        tail = "/".join(path.split("/")[-2:])
        print(f"  [{n.score:.3f}] {tail}")

    print("\nBM25 top-5 (TF-IDF score, unbounded):")
    bm25_5 = bm25_wide
    bm25_5.similarity_top_k = 5
    for n in bm25_5.retrieve(Q1):
        path = n.metadata.get("file_path", "?")
        tail = "/".join(path.split("/")[-2:])
        print(f"  [{n.score:.3f}] {tail}")
    bm25_5.similarity_top_k = 20  # restore for the actual hybrid pipeline

    # Watch for: BM25's top-3 are usually all kubelet reference docs
    # (where `--max-pods` literally appears). Dense's top-5 are scattered
    # across "pod scheduling" docs that don't contain the answer.


async def main() -> None:
    """Build hybrid+rerank, show the dense-vs-BM25 demo, eval all 30 questions."""
    require_env()
    check_openrouter()

    print("\n=== M2 — Build hybrid + rerank pipeline ===")
    naive_index, all_nodes = build_naive_index()
    retriever, engine, dense_wide, bm25_wide = make_hybrid_engine(naive_index, all_nodes)

    # The demo that earns its keep — read both lists out loud.
    show_dense_vs_bm25(dense_wide, bm25_wide)

    print("\n=== M2 — 3 test queries (hybrid+rerank) ===")
    for q in TEST_QUERIES:
        print(f"\nQ: {q}")
        r = engine.query(q)
        ans = str(r)
        # Q1 should now answer "110" — that's the M2 win condition.
        print(f"A: {ans[:600]}{'...' if len(ans) > 600 else ''}")

    def hybrid_query(q: str) -> dict:
        r = engine.query(q)
        return {"answer": str(r), "contexts": [n.get_content() for n in r.source_nodes]}

    # Eval against all 30 goldset questions. Expect biggest jump on
    # exact_match category (q01-q10) where BM25 makes the difference.
    await evaluate_async(hybrid_query, "M2_hybrid_rerank")
    print_scoreboard()


if __name__ == "__main__":
    asyncio.run(main())
