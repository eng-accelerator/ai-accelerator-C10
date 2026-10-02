"""M4 — Query rewriting: HyDE + LLM decomposition.

THE PROBLEM M4 SOLVES:
    Q3: "If I want zero-downtime rolling updates for a StatefulSet with
         persistent storage, what features must I configure together?"

    This needs facts from THREE different K8s docs (StatefulSet, PDB,
    rolling-update strategy). Even with M3's contextual chunking + M2's
    hybrid+rerank, one retrieval pass can only pull chunks that share
    vocabulary with the query. The three docs use very different vocabulary.

    The fix isn't on the retrieval side — it's on the QUERY side.

TWO TECHNIQUES IN THIS MODULE:

1. HyDE — Hypothetical Document Embeddings
   ---------------------------------------
   Insight: the user's question and the answering document are written in
   different *registers*. Question: "How do I do X?" Doc: "X is configured
   by Y." So embedding the question and embedding the doc don't land near
   each other in vector space.

   Trick: ask the LLM to write a fake answer to the question, then embed
   THAT. The fake answer matches the register of documentation, so it
   retrieves better than the question itself does. Counterintuitive but it
   works — typical 5-15 point context-relevance gain on conceptual queries.

   Cost: 1 extra LLM call per query (the hypothetical-answer step).

2. Decomposition
   -------------
   Insight: a multi-hop question is several single-hop questions glued
   together. If you split it, retrieve each piece, and combine the results,
   you get the union of relevant chunks instead of the intersection.

   Pipeline:
     query  ──►  Sonnet decomposes  ──►  ["sub_q1", "sub_q2", "sub_q3"]
                                              │
                                              ▼ (retrieve each)
                                       ┌──────┼──────┐
                                       ▼      ▼      ▼
                                     chunks chunks chunks
                                       └──────┴──────┘
                                              ▼ (dedupe by node_id)
                                          unique chunks
                                              ▼
                                       cross-encoder rerank
                                       AGAINST THE ORIGINAL query
                                              ▼
                                          top-5 chunks
                                              ▼
                                          Haiku synthesis

   Why rerank against the original: the sub-questions are scaffolding. The
   user asked Q3, not the sub-questions. Rerank by Q3 to keep only chunks
   that bear on the *original* question, not chunks that match one
   sub-question in isolation.

   Why Sonnet (not Haiku) for the decomposition: structured output (JSON
   list) reliability matters and the call only happens once per query.
   Sonnet costs more per token but the latency/cost difference is dwarfed
   by the four downstream retrievals.

WHEN TO USE THIS:
    Decomposition is overkill for simple identifier queries (Q1). Running
    it on every query burns 3x the LLM calls for no gain. The right move
    is *routing* — classify queries first, only decompose multi-hop ones.
    M5's agent is a stricter version of this routing principle.

DEPENDS ON M3:
    Uses the contextualized chunks from scripts/.ctx_nodes.json. If you
    haven't run M3 yet, this script will build the cache itself (slow first
    run; ~1-2 min for the contextualization step).

Run:
    python scripts/m4_decomposition.py
"""
from __future__ import annotations

import asyncio
import json as _json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    GENERATION_MODEL,
    OPENROUTER_BASE,
    PLANNER_MODEL,
    Q2,
    Q3,
    TEST_QUERIES,
    check_openrouter,
    evaluate_async,
    print_scoreboard,
    require_env,
)
from m3_contextual import build_ctx_engine, build_or_load_ctx_chunks, chunks_to_nodes  # noqa: E402

# The decomposition prompt. The "ONLY a JSON list" constraint matters: if
# Sonnet adds prose around the JSON, the parser falls back to [q] (no
# decomposition) and we lose the M4 gain.
DECOMPOSE_PROMPT = (
    "Break this question into 2-4 independent, simpler sub-questions that "
    "together cover the original. Return ONLY a JSON list of strings, no "
    "other text.\n\nQuestion: {q}"
)


def hyde_retrieve(retriever, sync_client, q: str, top_k: int = 5):
    """Generate a hypothetical answer, then retrieve against THAT.

    Notice we never use the hypothetical answer for anything else — it's
    purely a query-rewriting trick. The actual answer comes later from the
    real retrieved chunks. The fake answer is a "better-shaped query".
    """
    hypo = sync_client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=[{
            "role": "user",
            "content": f"Write a short (3-sentence) hypothetical answer to this question, even if you have to invent details:\n\n{q}",
        }],
        max_tokens=200,
        temperature=0,
    ).choices[0].message.content
    print(f"\n  HyDE hypothetical answer (used as the embedding query):\n  '{hypo[:300]}...'")
    # Now retrieve using the hypothetical answer instead of the question.
    return retriever.retrieve(hypo)


def decompose(sync_client, q: str) -> list[str]:
    """Ask Sonnet to split the question into sub-questions.

    Returns a list of strings. On any parse failure, returns [q] so the
    rest of the pipeline still works (just without the decomposition gain).
    """
    r = sync_client.chat.completions.create(
        model=PLANNER_MODEL,
        messages=[{"role": "user", "content": DECOMPOSE_PROMPT.format(q=q)}],
        max_tokens=400,
        temperature=0,
    ).choices[0].message.content.strip()

    # Defensive parsing — strip ```json fences if present, even though
    # the prompt asks for plain JSON. LLMs add fences sometimes.
    if r.startswith("```"):
        r = r.split("```")[1]
        if r.startswith("json"):
            r = r[4:]

    try:
        return _json.loads(r.strip())
    except Exception:
        # Fallback: if the JSON didn't parse, treat as no-decomposition.
        # M4 gracefully degrades to vanilla M3 retrieval.
        return [q]


def make_decompose_query(retriever, reranker, sync_client):
    """Build the full decomposition pipeline as a single callable.

    Returns a function that takes a question and returns
        {"answer": str, "contexts": list[str], "sub_qs": list[str]}
    """
    def decompose_query(q: str) -> dict:
        # ---- 1. Split the question into sub-questions ----
        sub_qs = decompose(sync_client, q)

        # ---- 2. Retrieve each sub-question; dedupe by node_id ----
        # If two sub-questions retrieve the same chunk, we want it only once.
        # Dict keyed on node_id is the simplest dedupe.
        seen = {}
        for sq in sub_qs:
            for n in retriever.retrieve(sq):
                seen[n.node_id] = n
        fused = list(seen.values())
        if not fused:
            return {"answer": "(no chunks)", "contexts": [], "sub_qs": sub_qs}

        # ---- 3. Rerank against the ORIGINAL question (not sub-questions) ----
        # This is the key step. We want chunks relevant to what the user
        # actually asked, not chunks that happen to match one sub-question.
        pairs = [[q, n.get_content()] for n in fused]
        rerank_scores = reranker.predict(pairs)
        ranked = sorted(zip(rerank_scores, fused), key=lambda x: -x[0])[:5]
        contexts = [n.get_content() for _, n in ranked]

        # ---- 4. Synthesize the final answer from the top-5 chunks ----
        ctx_str = "\n\n---\n\n".join(contexts)
        answer = sync_client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[{
                "role": "user",
                "content": f"Use ONLY the context below to answer.\n\nContext:\n{ctx_str}\n\nQuestion: {q}",
            }],
            max_tokens=600,
            temperature=0,
        ).choices[0].message.content
        return {"answer": answer, "contexts": contexts, "sub_qs": sub_qs}

    return decompose_query


async def main() -> None:
    """HyDE demo on Q2, decomposition demo on Q3, eval against all 30 questions."""
    require_env()
    check_openrouter()

    # ---- Load contextualized chunks (uses M3's cache) ----
    print("\n=== M4 — Load contextualized chunks ===")
    chunks = await build_or_load_ctx_chunks()
    ctx_nodes = chunks_to_nodes(chunks)
    print(f"  {len(ctx_nodes)} nodes")

    # ---- Build the same hybrid+rerank pipeline M3 used ----
    print("\n=== M4 — Build hybrid+rerank pipeline (same as M3) ===")
    retriever, _engine = build_ctx_engine(ctx_nodes)

    # We need direct access to the reranker for the decomposition pipeline
    # (rerank against original query, not whichever sub-question retrieved).
    from sentence_transformers import CrossEncoder
    from common import RERANK_MODEL
    reranker = CrossEncoder(RERANK_MODEL, max_length=512)

    # Sync client for HyDE/decompose calls — we call them inline in the
    # query function, not async. Keeps the code linear and easy to read.
    from openai import OpenAI
    sync_client = OpenAI(base_url=OPENROUTER_BASE, api_key=os.environ["OPENROUTER_API_KEY"])

    # ---- HyDE demo on Q2 ----
    # Watch the hypothetical answer the LLM generates. It's often factually
    # wrong in places — but it doesn't matter, we're using it as a query.
    print("\n=== M4 — HyDE on Q2 ===")
    print(f"Q: {Q2}")
    hyde_results = hyde_retrieve(retriever, sync_client, Q2)
    print("\n  Top retrieved chunks (via HyDE):")
    for n in hyde_results[:5]:
        path = n.metadata.get("file_path", "?")
        tail = "/".join(path.split("/")[-2:])
        print(f"    [{n.score:.3f}] {tail}")

    # ---- Decomposition demo on Q3 ----
    # The sub-question print is the punchline of M4. When Sonnet splits the
    # multi-hop question into 3-4 cleanly separable parts, the audience
    # usually goes "ahh." Pause for it.
    print("\n=== M4 — Decomposition on Q3 ===")
    decompose_query = make_decompose_query(retriever, reranker, sync_client)
    print(f"Q: {Q3}")
    out = decompose_query(Q3)
    print(f"\n  Sub-questions Sonnet generated:")
    for i, sq in enumerate(out.get("sub_qs", []), 1):
        print(f"    {i}. {sq}")
    print(f"\n  Final answer:")
    print(f"    {out['answer'][:800]}{'...' if len(out['answer']) > 800 else ''}")

    # ---- Run all 3 test queries via decomposition ----
    # Even Q1 (exact-match) gets decomposed. That's intentional — shows what
    # happens when you over-engineer. M5's routing fixes this.
    print("\n=== M4 — All 3 queries via decomposition ===")
    for q in TEST_QUERIES:
        print(f"\nQ: {q}")
        out = decompose_query(q)
        print(f"  sub-qs: {out.get('sub_qs', [])}")
        print(f"  A: {out['answer'][:500]}{'...' if len(out['answer']) > 500 else ''}")

    # ---- Eval on all 30 goldset questions ----
    # Adapt the decompose_query (which returns sub_qs too) to RAGAS's
    # expected shape: {answer, contexts}.
    def eval_wrap(q: str) -> dict:
        out = decompose_query(q)
        return {"answer": out["answer"], "contexts": out["contexts"]}

    # Expect biggest jump on multi_hop category (q21-q30) where decomposition
    # is doing actual work. May DIP slightly on exact_match (q01-q10) because
    # decomposition is overkill there.
    await evaluate_async(eval_wrap, "M4_decomposition")
    print_scoreboard()


if __name__ == "__main__":
    asyncio.run(main())
