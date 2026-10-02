"""Shared utilities for the M0–M5 scripts.

This file is the single source of truth for:
  • Model selection (one place to swap Haiku for a free model, etc.)
  • The 3 canonical test queries that thread through every module
  • The RAGAS eval helper (per-sample async; no executor, no recursion bug)
  • Result persistence (so you can run modules in any order and the scoreboard
    accumulates in scripts/eval_results.json)

You don't run this file directly — the m0–m5 scripts import from it.

WHY ALL ASYNC: RAGAS 0.4 dispatches metric scoring through `instructor` +
`anyio`. We drive it from `asyncio.run(main())` in plain Python scripts,
which gives a clean event loop. Inside Jupyter + `nest_asyncio` the same
code recurses to death — that's why there's no notebook in this repo.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# `Path(__file__).parent.parent` resolves to the `code/` directory regardless
# of where you launched Python from. So `python scripts/m0_naive.py` and
# `cd scripts && python m0_naive.py` both work.
ROOT = Path(__file__).resolve().parent.parent  # the code/ directory
DATA_DIR = ROOT / "data" / "k8s-docs"          # 72 markdown files
GOLDSET_PATH = ROOT / "goldset.json"           # 30 eval questions
RESULTS_PATH = ROOT / "scripts" / "eval_results.json"
CTX_NODES_CACHE = ROOT / "scripts" / ".ctx_nodes.json"  # M3 contextualized chunks
LANCEDB_NAIVE = ROOT / "lancedb_naive"  # unused now (in-memory store) — kept
LANCEDB_CTX = ROOT / "lancedb_ctx"      # for symmetry if you swap stores back

# Pulls OPENROUTER_API_KEY from code/.env if present.
load_dotenv(ROOT / ".env")

# ---------------------------------------------------------------------------
# Models — single source of truth for every script.
# Swap any of these to run on a different provider. To go fully free-tier:
#     GENERATION_MODEL = "qwen/qwen3-8b-instruct:free"
#     PLANNER_MODEL    = "qwen/qwen3-8b-instruct:free"
#     JUDGE_MODEL      = "anthropic/claude-haiku-4.5"   # judge needs JSON quality
# ---------------------------------------------------------------------------
OPENROUTER_BASE = "https://openrouter.ai/api/v1"
GENERATION_MODEL = "anthropic/claude-haiku-4.5"   # answers user queries (M0, M2-M5)
PLANNER_MODEL = "anthropic/claude-sonnet-4.6"     # M4 query decomposition (better structured output)
JUDGE_MODEL = "google/gemini-2.5-flash"           # RAGAS judge — decorrelated from generator
EMBED_MODEL = "BAAI/bge-small-en-v1.5"            # 384-dim dense embeddings, free, fast
RERANK_MODEL = "BAAI/bge-reranker-base"           # cross-encoder, ~280MB, runs on CPU

# ---------------------------------------------------------------------------
# The 3 canonical test queries — threaded through every module.
# Each is designed to expose one of the three classic RAG failure modes:
# ---------------------------------------------------------------------------
# Q1 (exact-match): contains a literal token (`--max-pods`) that dense
#     embeddings smear into "pod limit" / "pod scheduling" semantics. Naive
#     RAG fails. BM25 (lexical match) catches it. Fixed in M2.
Q1 = "What is the default value of the --max-pods flag on the kubelet?"

# Q2 (cross-section): the answer lives in a chunk that doesn't itself say
#     "Ingress controller" — chunking severs the reference. Naive returns
#     a half-truth. Fixed in M3 by prepending a 1-sentence context to each
#     chunk.
Q2 = "How does an Ingress controller decide which backend Pod to forward a request to?"

# Q3 (multi-hop): needs facts from 3 different docs (StatefulSet, PDB,
#     rolling-update strategy). One retrieval pass can't pull all three.
#     Fixed in M4 by Sonnet decomposing the question into sub-questions.
Q3 = "If I want zero-downtime rolling updates for a StatefulSet with persistent storage, what features must I configure together?"

TEST_QUERIES = [Q1, Q2, Q3]

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
def require_env() -> None:
    """Fail fast if the API key isn't set, before anything expensive runs."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise SystemExit(
            "OPENROUTER_API_KEY missing. Add it to code/.env:\n"
            "    echo 'OPENROUTER_API_KEY=sk-or-v1-...' > code/.env"
        )


def check_openrouter() -> None:
    """Round-trip a single tiny request to confirm the gateway is reachable.

    Better to fail here (1 second) than 30 questions into the eval (5 minutes).
    """
    from openai import OpenAI
    try:
        OpenAI(
            base_url=OPENROUTER_BASE, api_key=os.environ["OPENROUTER_API_KEY"]
        ).chat.completions.create(
            model=JUDGE_MODEL,
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            max_tokens=4,
            temperature=0,
        )
    except Exception as e:
        raise SystemExit(
            f"OpenRouter unreachable: {type(e).__name__}: {e}\n"
            "Confirm OPENROUTER_API_KEY and try:\n"
            "    curl -sS -o /dev/null -w '%{http_code}' https://openrouter.ai/api/v1/models"
        )
    print("OpenRouter: OK")


def load_goldset() -> list[dict]:
    """Load the 30-question evaluation goldset.

    Categories (10 questions each):
      • exact_match   — q01–q10  (literal flags, defaults, identifiers)
      • cross_section — q11–q20  (anaphora across chunk boundaries)
      • multi_hop     — q21–q30  (answer requires 2+ docs combined)

    A balanced sample exercises all three failure classes; the
    `evaluate_async` helper defaults to running all 30.
    """
    with open(GOLDSET_PATH) as f:
        return json.load(f)["questions"]


# ---------------------------------------------------------------------------
# Results persistence
# ---------------------------------------------------------------------------
# Every module appends to scripts/eval_results.json. This means:
#   • You can run modules in any order; the scoreboard accumulates.
#   • Re-running a module overwrites just that module's row.
#   • show_results.py reads from this same file at any time.
def save_scores(label: str, scores: dict) -> None:
    results: dict = {}
    if RESULTS_PATH.exists():
        try:
            results = json.loads(RESULTS_PATH.read_text())
        except Exception:
            # Corrupt file? Start fresh rather than crashing.
            results = {}
    results[label] = scores
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(results, indent=2))


def print_scoreboard() -> None:
    """Pretty-print the running scoreboard (called at end of each module)."""
    if not RESULTS_PATH.exists():
        print("(no scoreboard yet — run m0_naive.py first)")
        return
    results = json.loads(RESULTS_PATH.read_text())
    print("\n=== Scoreboard ===")
    print(f"{'module':25s} {'faithfulness':>14s} {'answer_relevancy':>18s}")
    print("-" * 60)
    for label, scores in results.items():
        f = scores.get("faithfulness", float("nan"))
        a = scores.get("answer_relevancy", float("nan"))
        print(f"{label:25s} {f:>14.3f} {a:>18.3f}")
    print()


# ---------------------------------------------------------------------------
# RAGAS eval — the heart of the eval-first discipline
# ---------------------------------------------------------------------------
# What we measure (RAGAS triad, two of three):
#   • faithfulness     — every claim in the answer ⊆ retrieved chunks?
#                        catches hallucination
#   • answer_relevancy — does the answer actually address the question?
#                        catches "answers a related but different question"
#
# (Context relevance is implicit when the corpus is fixed; we skip it for
# tempo. In production you'd add `context_precision` and `context_recall`.)
#
# WHY DECORRELATED JUDGE: the generator is Haiku, the judge is Gemini Flash.
# Never grade with the same model that generated — bias compounds.
#
# WHY PER-SAMPLE: RAGAS 0.4's `evaluate()` runs jobs through an executor that
# trips a recursion bug under nest_asyncio. We bypass it by calling
# `Faithfulness.ascore(...)` and `AnswerRelevancy.ascore(...)` directly,
# one question at a time. Same metrics, no executor.
#
# Defaults to evaluating all 30 questions in the goldset. Pass sample=N to
# subset for fast iteration.
async def evaluate_async(query_fn, label: str, sample: int | None = None) -> dict:
    """Score a query function against the goldset using RAGAS.

    Args:
      query_fn: callable taking a question string and returning
                {"answer": str, "contexts": list[str]}.
                May be sync or async.
      label:    human-readable name for this run (e.g. "M2_hybrid_rerank").
                Used as the row key in eval_results.json.
      sample:   number of questions to evaluate. None (default) = all 30.
                Pass e.g. sample=10 for a fast partial run during iteration.

    Returns: {"faithfulness": float, "answer_relevancy": float}
             (means over questions where the metric returned a value;
             individual NaN failures are dropped before averaging.)
    """
    import asyncio

    from openai import AsyncOpenAI
    from ragas.embeddings import HuggingFaceEmbeddings as RagasHFEmbeddings
    from ragas.llms import llm_factory
    from ragas.metrics.collections import AnswerRelevancy, Faithfulness

    # Async client — RAGAS metrics call .ascore() under the hood and need
    # an AsyncOpenAI instance, even when invoked from a sync wrapper.
    client = AsyncOpenAI(
        base_url=OPENROUTER_BASE,
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": "https://localhost/",
            "X-Title": "RAG for Engineers",
        },
    )
    # max_tokens=8192: the judge sometimes needs to extract many "statements"
    # from a long answer (one verdict per claim). Without enough headroom it
    # truncates mid-JSON and instructor returns NaN for that row.
    llm = llm_factory(
        model=JUDGE_MODEL, provider="openai", client=client, max_tokens=8192
    )
    emb = RagasHFEmbeddings(model=EMBED_MODEL)
    faith = Faithfulness(llm=llm)
    ar = AnswerRelevancy(llm=llm, embeddings=emb)

    # Default: full goldset. Override with sample=N for speed during iteration.
    qs = load_goldset() if sample is None else load_goldset()[:sample]
    faith_scores: list[float] = []
    ar_scores: list[float] = []

    print(f"\n--- RAGAS eval: {label} ({len(qs)} questions) ---")
    for i, q in enumerate(qs, 1):
        # Step 1 — generate the answer for this question via the module's
        # query function (could be sync naive_query, async, decompose_query, etc.)
        if asyncio.iscoroutinefunction(query_fn):
            r = await query_fn(q["question"])
        else:
            r = query_fn(q["question"])

        # Drop empty contexts (RAGAS expects at least one non-empty string)
        ctxs = [c for c in r["contexts"] if c.strip()] or [""]

        # Step 2 — score faithfulness (uses retrieved contexts)
        try:
            f = float(await faith.ascore(
                user_input=q["question"], response=r["answer"], retrieved_contexts=ctxs,
            ))
        except Exception as e:
            print(f"  [{i:2d}/{len(qs)}] {q['id']} faithfulness FAILED: {type(e).__name__}: {str(e)[:120]}")
            f = float("nan")

        # Step 3 — score answer_relevancy (does NOT use contexts — it
        # generates synthetic questions from the answer and measures how
        # well they match the original question)
        try:
            a = float(await ar.ascore(user_input=q["question"], response=r["answer"]))
        except Exception as e:
            print(f"  [{i:2d}/{len(qs)}] {q['id']} answer_relevancy FAILED: {type(e).__name__}: {str(e)[:120]}")
            a = float("nan")

        faith_scores.append(f)
        ar_scores.append(a)
        f_disp = f"{f:.2f}" if not math.isnan(f) else " nan"
        a_disp = f"{a:.2f}" if not math.isnan(a) else " nan"
        print(f"  [{i:2d}/{len(qs)}] {q['id']} ({q['category']:13s})  faith={f_disp}  ar={a_disp}")

    def _mean(xs: list[float]) -> float:
        """Mean over non-NaN values. One bad judge response shouldn't sink the run."""
        clean = [x for x in xs if not math.isnan(x)]
        return sum(clean) / len(clean) if clean else float("nan")

    scores = {
        "faithfulness": _mean(faith_scores),
        "answer_relevancy": _mean(ar_scores),
    }
    print(f"\n  ⇒ {label}: faithfulness={scores['faithfulness']:.3f}  "
          f"answer_relevancy={scores['answer_relevancy']:.3f}")
    save_scores(label, scores)
    return scores
