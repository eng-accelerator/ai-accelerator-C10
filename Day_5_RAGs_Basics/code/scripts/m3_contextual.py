"""M3 — Contextual ingest + record-manager pattern.

THE PROBLEM M3 SOLVES:
    Chunking severs context. Take the K8s Ingress doc — it has a section
    titled "How routing works" but the chunk that contains the actual answer
    says: "the controller checks each rule's path against the request URI".
    Notice that chunk *doesn't say "Ingress controller"*. So when Q2 asks
    "How does an Ingress controller decide which backend Pod...", neither
    dense (no semantic signal for "controller decides") nor BM25 (no literal
    "Ingress") retrieves it. M2's hybrid+rerank can't fix this.

    This is anaphora across chunk boundaries — the chunk uses pronouns or
    terms that referenced something earlier in the doc. A 2024 Anthropic
    research paper showed this single class of failure causes ~35% of RAG
    retrieval misses on production corpora.

THE FIX: CONTEXTUAL RETRIEVAL (Anthropic, Sept 2024)
    For each chunk, ask the LLM to write 1-2 sentences situating that chunk
    inside its parent document. Prepend that context to the chunk text
    BEFORE embedding and indexing. Now the orphaned chunk says:

        [Original chunk]
        the controller checks each rule's path against the request URI...

        [Contextualized chunk]
        This chunk is from the Kubernetes Ingress documentation, in the
        section explaining how Ingress controllers route traffic to backend
        Pods.

        the controller checks each rule's path against the request URI...

    Now both retrievers can find it for Q2.

THE COST:
    1 LLM call per chunk × ~800 chunks = ~800 calls. Naively expensive, but
    Anthropic's prompt caching keeps the parent doc cached across all chunks
    of that doc → ~$1 per million corpus tokens. We don't use prompt caching
    here (OpenRouter's pass-through doesn't expose Anthropic's cache control)
    so it's ~$0.05 for the full K8s corpus. Worth it.

CACHING: contextualized chunks are saved to scripts/.ctx_nodes.json after
the first run. M3/M4/M5 all read from this cache, so the LLM step only runs
once. Delete `.ctx_nodes.json` to force a rebuild.

THE SECOND THING WE DO HERE: RECORD MANAGER
    The most common production RAG outage is the ingest pipeline, not the
    retrieval logic. Naive re-ingest creates duplicate chunks (chunk IDs
    change) or stale chunks (deleted docs aren't removed).

    Pattern: hash each doc, store hash in chunk metadata. On re-ingest:
        UNCHANGED docs:  skip (no re-embed)
        CHANGED docs:    delete old chunks + re-embed
        DELETED docs:    cascade-delete chunks

    LangChain ships this as `SQLRecordManager`. We build the diff function
    from scratch (~10 lines) so you see what's happening.

Run:
    python scripts/m3_contextual.py
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    CTX_NODES_CACHE,
    DATA_DIR,
    EMBED_MODEL,
    GENERATION_MODEL,
    OPENROUTER_BASE,
    RERANK_MODEL,
    TEST_QUERIES,
    check_openrouter,
    evaluate_async,
    print_scoreboard,
    require_env,
)

# The exact prompt from Anthropic's contextual retrieval paper, slightly
# trimmed. The "ONLY with the context, no preamble" is critical — without it
# you get "Sure, here's the context: ..." boilerplate that pollutes the
# retrievable text.
CTX_PROMPT = (
    "<document>\n{doc}\n</document>\n\n"
    "Here is a chunk from the document:\n<chunk>\n{chunk}\n</chunk>\n\n"
    "Give a short (1-2 sentence) context describing where this chunk sits in "
    "the document and what topic it relates to. This context will be prepended "
    "to the chunk to improve search retrieval. Answer ONLY with the context, "
    "no preamble."
)


async def contextualize_one(client, doc_text: str, chunk_text: str, sem) -> str:
    """Generate one context blurb for one chunk.

    Wrapped in an asyncio.Semaphore so we don't hammer OpenRouter with 800
    parallel requests. semaphore=20 = at most 20 in flight at a time.
    Drop to 10 if you hit rate limits.

    On error: returns empty string. The chunk still gets indexed without the
    context boost — graceful degradation. Better than crashing 600 chunks in.
    """
    async with sem:
        try:
            r = await client.chat.completions.create(
                model=GENERATION_MODEL,
                messages=[{
                    "role": "user",
                    # doc_text[:8000] caps the parent doc length to keep
                    # prompt size sane. Most K8s docs fit under this.
                    "content": CTX_PROMPT.format(doc=doc_text[:8000], chunk=chunk_text),
                }],
                max_tokens=120,  # 1-2 sentences fits comfortably
                temperature=0,    # deterministic; we want consistent context
            )
            return (r.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"  [warn] contextualize failed ({type(e).__name__}); using empty context")
            return ""


async def build_or_load_ctx_chunks() -> list[dict]:
    """Generate (or load cached) contextualized chunks.

    Returns: list of {"text": prepended_chunk, "file_path": source_path}

    First run: ~800 LLM calls in parallel (concurrency=20), takes 1-2 min.
    Cached runs: instant — reads scripts/.ctx_nodes.json.

    M4 and M5 also call this function, so the LLM step only runs once across
    all three modules. Delete .ctx_nodes.json to force a rebuild.
    """
    # Cache hit: skip the expensive part entirely.
    if CTX_NODES_CACHE.exists():
        print(f"Loading cached contextualized chunks from {CTX_NODES_CACHE.name}")
        return json.loads(CTX_NODES_CACHE.read_text())

    from llama_index.core import SimpleDirectoryReader
    from llama_index.core.node_parser import SentenceSplitter
    from openai import AsyncOpenAI
    from tqdm.asyncio import tqdm as atqdm

    # ---- 1. Load docs and chunk them ----
    print(f"Loading docs from {DATA_DIR}...")
    docs = SimpleDirectoryReader(
        str(DATA_DIR), recursive=True, required_exts=[".md"]
    ).load_data()
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)

    # ---- 2. Set up async client + concurrency limiter ----
    client = AsyncOpenAI(
        base_url=OPENROUTER_BASE, api_key=os.environ["OPENROUTER_API_KEY"]
    )
    # Semaphore controls how many requests are in flight at once. Higher =
    # faster, more rate-limit risk. 20 is a safe default for OpenRouter.
    sem = asyncio.Semaphore(20)

    # ---- 3. Build the task list: one async call per chunk ----
    # We collect (parent_doc, chunk, path) tuples in chunk_records so we can
    # zip them back with their generated contexts after gather() completes.
    tasks = []
    chunk_records = []  # (doc_text, chunk_text, file_path)
    for doc in docs:
        chunks = splitter.split_text(doc.text)
        for ch in chunks:
            chunk_records.append((doc.text, ch, doc.metadata.get("file_path", "")))
            tasks.append(contextualize_one(client, doc.text, ch, sem))

    # ---- 4. Run all contextualization tasks concurrently ----
    # tqdm wraps gather to show a progress bar — satisfying for the audience.
    print(f"Contextualizing {len(tasks)} chunks (semaphore=20, ~1-2 min)...")
    contexts = await atqdm.gather(*tasks, desc="contextualizing")

    # ---- 5. Assemble final chunks: prepend context to original text ----
    out = []
    for (doc_text, ch, path), ctx in zip(chunk_records, contexts):
        text = f"{ctx}\n\n{ch}" if ctx else ch
        out.append({"text": text, "file_path": path})

    # ---- 6. Cache to disk so this only runs once ----
    CTX_NODES_CACHE.parent.mkdir(parents=True, exist_ok=True)
    CTX_NODES_CACHE.write_text(json.dumps(out))
    print(f"Cached {len(out)} contextualized chunks → {CTX_NODES_CACHE.name}")
    return out


def chunks_to_nodes(chunks: list[dict]):
    """Convert the cached dicts back into LlamaIndex TextNode objects.

    The cache is plain JSON (text + path) so it survives across LlamaIndex
    upgrades. We rehydrate to TextNode at load time.
    """
    from llama_index.core.schema import TextNode
    return [TextNode(text=c["text"], metadata={"file_path": c["file_path"]}) for c in chunks]


def build_ctx_engine(ctx_nodes):
    from llama_index.core import (
        Settings,
        VectorStoreIndex,
    )
    from llama_index.core.node_parser import SentenceSplitter
    from llama_index.core.query_engine import RetrieverQueryEngine
    from llama_index.core.retrievers import BaseRetriever, VectorIndexRetriever
    from llama_index.core.schema import NodeWithScore, QueryBundle
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    from llama_index.llms.openai_like import OpenAILike
    from llama_index.retrievers.bm25 import BM25Retriever
    from sentence_transformers import CrossEncoder

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
    Settings.node_parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)

    print("Building in-memory index over contextualized chunks...")
    index = VectorStoreIndex(ctx_nodes)

    print(f"Loading reranker ({RERANK_MODEL})...")
    reranker = CrossEncoder(RERANK_MODEL, max_length=512)

    dense_wide = VectorIndexRetriever(index=index, similarity_top_k=20)
    bm25_wide = BM25Retriever.from_defaults(nodes=ctx_nodes, similarity_top_k=20)

    def rrf_fuse(result_lists, k: int = 60):
        scores: dict[str, float] = {}
        by_id: dict[str, NodeWithScore] = {}
        for lst in result_lists:
            for rank, n in enumerate(lst):
                scores[n.node_id] = scores.get(n.node_id, 0.0) + 1.0 / (k + rank)
                by_id[n.node_id] = n
        return [by_id[i] for i in sorted(scores, key=scores.get, reverse=True)]

    class HybridRerankRetriever(BaseRetriever):
        def __init__(self):
            super().__init__()

        def _retrieve(self, qb: QueryBundle):
            d = dense_wide.retrieve(qb)
            b = bm25_wide.retrieve(qb)
            fused = rrf_fuse([d, b])[:20]
            if not fused:
                return []
            pairs = [[qb.query_str, n.get_content()] for n in fused]
            rerank_scores = reranker.predict(pairs)
            ranked = sorted(zip(rerank_scores, fused), key=lambda x: -x[0])
            return [NodeWithScore(node=n.node, score=float(s)) for s, n in ranked[:5]]

    retriever = HybridRerankRetriever()
    engine = RetrieverQueryEngine.from_args(retriever=retriever)
    return retriever, engine


def record_manager_demo():
    """Demo idempotent re-ingest via content hashes.

    ~10 lines, 30 seconds of teaching, but it's the difference between a
    working production RAG and an outage every time docs update.

    The pattern:
      1. Hash each doc's text (md5 is fine — we're detecting change, not
         protecting against attackers).
      2. Store the hash alongside each chunk in the vector store metadata.
      3. On re-ingest:
            - Doc with same hash      → skip
            - Doc with different hash → delete its old chunks + re-embed
            - Hash from previous run no longer present → cascade-delete chunks

    Without this: the second daily ingest creates duplicate chunks. After a
    week your top-5 retrieval is 5 copies of the same chunk. Real outage,
    happens to everyone exactly once.
    """
    from llama_index.core import SimpleDirectoryReader

    print("\n=== M3 — Record-manager demo (idempotent re-ingest) ===")
    docs = SimpleDirectoryReader(
        str(DATA_DIR), recursive=True, required_exts=[".md"]
    ).load_data()

    def doc_hash(text: str) -> str:
        # md5 is fine for change detection (NOT for security). Faster than
        # sha256 and the collision rate doesn't matter at this scale.
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    # Snapshot current hashes — this represents the "state of last ingest".
    # In production this dict lives in your vector store metadata.
    prev_hashes = {d.metadata["file_path"]: doc_hash(d.text) for d in docs}

    # Simulate "someone edited a doc on disk" by appending a comment to one
    # doc's text. Pydantic forbids setting Document.text directly, so we
    # compute the new corpus as plain (path, text) tuples instead.
    def reload_with_one_mutation():
        out = []
        for i, d in enumerate(docs):
            text = d.text + ("\n\n<!-- updated -->" if i == 0 else "")
            out.append((d.metadata["file_path"], text))
        return out

    new_corpus = reload_with_one_mutation()

    # The diff: compare hashes. Three sets fall out:
    #   - changed: in both, hash differs    → re-embed
    #   - deleted: in prev, not in current  → cascade-delete
    #   - unchanged: in both, same hash     → skip (the savings)
    current_hashes = {p: doc_hash(t) for p, t in new_corpus}
    changed = [p for p, h in current_hashes.items() if prev_hashes.get(p) != h]
    deleted = set(prev_hashes) - set(current_hashes)

    print(f"After mutating one doc: {len(changed)} changed, {len(deleted)} deleted.")
    print(f"  -> {Path(changed[0]).name}")
    print("\nIn production you'd:")
    print("  1. delete chunks where metadata.file_path in deleted | {changed paths}")
    print("  2. re-embed only changed docs (not all 800!)")
    print("  3. upsert into the same vector store.")


async def main() -> None:
    require_env()
    check_openrouter()

    print("\n=== M3 — Contextualize chunks ===")
    chunks = await build_or_load_ctx_chunks()
    ctx_nodes = chunks_to_nodes(chunks)
    print(f"  {len(ctx_nodes)} contextualized nodes")

    print("\n=== M3 — Build hybrid+rerank index over contextual chunks ===")
    _, engine = build_ctx_engine(ctx_nodes)

    print("\n=== M3 — 3 test queries (contextual + hybrid + rerank) ===")
    for q in TEST_QUERIES:
        print(f"\nQ: {q}")
        r = engine.query(q)
        ans = str(r)
        print(f"A: {ans[:600]}{'...' if len(ans) > 600 else ''}")

    def ctx_query(q: str) -> dict:
        r = engine.query(q)
        return {"answer": str(r), "contexts": [n.get_content() for n in r.source_nodes]}

    # Eval against all 30 goldset questions. Expect biggest jump on
    # cross_section category (q11-q20) where contextual prefixes resolve
    # the anaphora that broke naive retrieval.
    await evaluate_async(ctx_query, "M3_contextual")

    record_manager_demo()
    print_scoreboard()


if __name__ == "__main__":
    asyncio.run(main())
