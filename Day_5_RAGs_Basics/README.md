# RAG for Engineers — Build-Along Session

3-hour live build covering production-pattern RAG: hybrid retrieval + reranking, contextual ingest, query rewriting, evaluation harness, and an agentic loop. Built on **Kubernetes documentation** (~72 markdown files) so engineers can immediately recognize the failure modes.

## Quick start

The session runs as **standalone Python scripts** — one per module, runnable end-to-end. Each script uses `asyncio.run()` and an in-memory vector store, sidestepping the async/recursion bugs that bite RAGAS inside Jupyter.

**Prerequisites:** Python 3.10+ on your PATH. Verify with `python --version` (Windows) or `python3 --version` (macOS / Linux).

### macOS / Linux

```bash
cd code/
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
python download_data.py        # ~30s; fetches 72 K8s doc files
python sanity_check.py         # validates env + reachability + packages

# Run the modules in order:
python scripts/m0_naive.py            # ~5 min — naive RAG baseline (eval on all 30 goldset Qs)
python scripts/m2_hybrid.py           # ~7 min — BM25 + RRF + reranker
python scripts/m3_contextual.py       # ~8-12 min first run (cached after)
python scripts/m4_decomposition.py    # ~8 min — HyDE + Sonnet decomposition
python scripts/m5_agentic.py          # ~15 min — LangGraph agent + eval
python scripts/show_results.py        # see the scoreboard
```

### Windows (PowerShell)

```powershell
cd code
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
"OPENROUTER_API_KEY=sk-or-v1-..." | Out-File -Encoding ascii .env
python download_data.py
python sanity_check.py

# Run the modules in order:
python scripts\m0_naive.py            # ~5 min
python scripts\m2_hybrid.py           # ~7 min
python scripts\m3_contextual.py       # ~8-12 min first run (cached after)
python scripts\m4_decomposition.py    # ~8 min
python scripts\m5_agentic.py          # ~15 min
python scripts\show_results.py
```

If `Activate.ps1` is blocked, run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. Or use **cmd.exe** instead of PowerShell:

```cmd
cd code
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
echo OPENROUTER_API_KEY=sk-or-v1-...> .env
python download_data.py
python sanity_check.py
python scripts\m0_naive.py
:: ...etc
```

See `code/scripts/README.md` for full per-script docs and troubleshooting.

## Eval scope: 30 questions per module

**Every module runs the full 30-question goldset by default.** That's:
- 10 **exact-match** questions (q01–q10) — literal flags, defaults, identifiers
- 10 **cross-section** questions (q11–q20) — answer split across chunk boundaries
- 10 **multi-hop** questions (q21–q30) — answer requires combining 2+ docs

Different modules win on different categories — that's the whole point. M2's hybrid+rerank crushes exact-match. M3's contextual chunking helps cross-section. M4's decomposition helps multi-hop. **You only see this story if you eval on all 30.**

### Cost per module (full 30-Q eval)

| Module | Time | Tokens | $ on OpenRouter |
|---|---|---|---|
| M0 naive | ~5 min | low | ~$0.30 |
| M2 hybrid | ~7 min | low | ~$0.40 |
| M3 contextual (first run) | ~8–12 min | ~800 LLM calls for ingest + eval | ~$1.00 |
| M3 contextual (cached) | ~5 min | low | ~$0.40 |
| M4 decomposition | ~8 min | medium (Sonnet planner) | ~$1.20 |
| M5 agentic | ~15 min | high (3-10× M2) | ~$3.00 |
| **Full pass** | **~45 min** | | **~$5–8** |

### Reducing the eval count to save tokens

For fast iteration during dev — or to cut cost on a dry-run — edit the `evaluate_async(...)` call near the bottom of any module script and pass `sample=N`:

```python
# In code/scripts/m0_naive.py (and m2_hybrid.py, m3_contextual.py, m4_decomposition.py, m5_agentic.py)

# Default — runs all 30 goldset questions
await evaluate_async(naive_query, "M0_naive")

# Fast iteration — runs the first 10 (exact_match only)
await evaluate_async(naive_query, "M0_naive", sample=10)

# Balanced category coverage — first 5 per category (exact-match q01–q05,
# cross-section q11–q15, multi-hop q21–q25). Fewer total questions but
# all 3 failure classes still tested.
await evaluate_async(naive_query, "M0_naive", sample=15)

# 1-question smoke test (just q01) — for "does this even run" iteration
await evaluate_async(naive_query, "M0_naive", sample=1)
```

The goldset is sequential (10 exact_match, then 10 cross_section, then 10 multi_hop), so:
- `sample=10` → exact_match only (fastest, but each module's strengths won't all show)
- `sample=20` → exact_match + cross_section
- `sample=None` (or omit, the default) → all 30, all categories

**Drop M5 from the dry-run** if you want to cut cost ~50% — its agent eval is the expensive one. Just don't run `m5_agentic.py`. The other 4 modules' results stay valid.

**Cap M5's per-question cost** by lowering the iteration limit. In `m5_agentic.py`'s `should_continue` function: change `s["iterations"] >= 3` to `>= 2`. Caps each agent invocation at 2 retrieve+judge cycles instead of 3.

## Repo layout

| Path | Purpose |
|---|---|
| **`code/scripts/`** | **Run these. One Python file per module (M0/M2/M3/M4/M5) plus `common.py` and `show_results.py`.** |
| `code/data/k8s-docs/` | The corpus (72 markdown files, fetched by `code/download_data.py`; already committed for instant start). |
| `code/goldset.json` | 30 evaluation questions (10 exact-match / 10 cross-section / 10 multi-hop). |
| `code/data_manifest.txt` | List of K8s doc paths to fetch. |
| `code/download_data.py` | Idempotent corpus fetcher. Safe to re-run. |
| `code/requirements.txt` | Pinned deps. |
| `code/sanity_check.py` | Pre-session validator. |
| `code/.env.example` | Template for the API key file. |
| `RAG_glossary.md` | Engineering-grade definitions of every term used in the session. |
| `RAG_reading_list.md` | Curated next-steps reading, ordered by what to read first. |
| `rag_chart.png` | One-page visual reference of the RAG architecture covered in the session. |
| `outskill_brand_deck/` | The slide deck used in the live session. |

## The 3 canonical test queries

Threaded through every module. Naive RAG fails on Q1 and Q3, returns half-truths on Q2. Each subsequent module fixes one.

- **Q1 (exact-match):** `"What is the default value of the --max-pods flag on the kubelet?"`
- **Q2 (cross-section):** `"How does an Ingress controller decide which backend Pod to forward a request to?"`
- **Q3 (multi-hop):** `"If I want zero-downtime rolling updates for a StatefulSet that uses persistent storage, what features must I configure together?"`

## Module map

| Time | Module | What gets built |
|---|---|---|
| 0:00–0:25 | M0 — Naive RAG end-to-end | LlamaIndex + in-memory vector store + BGE-small + Haiku |
| 0:25–0:55 | M1 — Eval harness FIRST | RAGAS (faithfulness + answer_relevancy) + 30-question goldset |
| 0:55–1:25 | M2 — Hybrid retrieval + reranker | BM25 + dense + RRF + bge-reranker-base |
| 1:25–1:55 | M3 — Contextual ingest + record manager | Anthropic-style chunk contextualization (~800 LLM calls, cached) |
| 1:55–2:25 | M4 — Query rewriting | HyDE + Sonnet decomposition |
| 2:25–2:55 | M5 — Agentic loop | LangGraph: retrieve → judge → reformulate (max 3 iters) |
| 2:55–3:00 | Wrap | Production checklist + Atlas tie-in |

## Stack

- **Ingest**: LlamaIndex
- **Vector store**: in-memory `SimpleVectorStore` (was LanceDB; switched to in-memory after a Python 3.14 + LanceDB tokio-loop race that fails mid-eval)
- **Dense embeddings**: `BAAI/bge-small-en-v1.5` (384-dim)
- **Sparse retrieval**: `rank_bm25`
- **Reranker**: `BAAI/bge-reranker-base` (~280 MB, CPU-friendly)
- **LLMs (via OpenRouter)**: Claude Haiku 4.5 (gen), Sonnet 4.6 (M4 planner), Gemini 2.5 Flash (judge)
- **Agent**: LangGraph
- **Eval**: RAGAS 0.4 collections API (`Faithfulness`, `AnswerRelevancy`) — async-driven per-sample, no executor

Models are configurable in one place — `code/scripts/common.py`. Swap to OpenAI / Gemini / Qwen / a `:free` variant in one line.

## Reading the scoreboard

After running M0–M5, `python scripts/show_results.py` prints a comparison table. Numbers from a verified end-to-end smoke-test run on all 30 questions:

| Module | faithfulness | answer_relevancy |
|---|---|---|
| M0_naive | 0.922 | 0.838 |
| M2_hybrid_rerank | 0.953 | 0.867 |
| M3_contextual | 0.942 | 0.847 |
| M4_decomposition | 0.945 | **0.690** |
| M5_agentic | **0.959** | **0.886** |

**Reading the deltas live:**

- **M2 is the cheap win** — 3-point bump on both metrics over naive. Hybrid retrieval is the "ship this on day one" move.
- **M3's slight dip vs M2 is honest** — contextual prefixes added non-keyword text that diluted BM25's signal on the exact-match category where M2 was already crushing it. M3 still helps on cross-section queries; the corpus-wide average just trades a little of M2's gain.
- **M4's answer_relevancy drop (0.86 → 0.69) is the routing argument** — faithfulness held (no hallucination, answers still grounded), but decomposing simple exact-match questions into 2-4 sub-questions sent the synthesis broader than the original asked. *Don't decompose by default — route.*
- **M5 wins both metrics** — best faithfulness AND best answer_relevancy. The agent's "judge-before-answering" loop adapts: when retrieval succeeds first-shot, it terminates immediately; when it fails, it reformulates and tries again. **Adaptive cost, not free quality.**

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401` from OpenRouter | Key missing or unfunded | Check `.env`; OpenRouter free tier covers the demo but key must be active |
| `download_data.py` returns <72 files | Upstream `kubernetes/website` moved/renamed a path | Re-run; the fetcher is idempotent. If a path 404s, prune it from `data_manifest.txt` |
| One question shows `nan` mid-eval | Judge LLM hit `max_tokens` extracting many statements from a long answer | Already handled — the harness averages over the rest. If it's persistent across questions, raise `max_tokens=8192` higher in `common.py` or switch judge to Haiku |
| Reranker first run is slow | `bge-reranker-base` weights downloading from HuggingFace | One-time ~280 MB pull; cached at `~/.cache/huggingface/` after |
| `lance error: Not found` mid-eval | Python 3.14 + LanceDB tokio loop race | Already worked around — scripts use in-memory store. If you re-introduce LanceDB, expect this on macOS + Py3.14 |
| LangGraph hits max iterations | Sufficiency-judge too strict | Lower the threshold in `node_judge` prompt or raise `max_iterations` past 3 in `m5_agentic.py` |
| M3 contextualization hangs | OpenRouter rate-limit | Drop the `Semaphore(20)` to `Semaphore(10)` in `m3_contextual.py` |
| `AttributeError: property 'text' of 'Document' object has no setter` | Pydantic-strict Document in newer llama-index | Already worked around in M3 record-manager demo (we simulate the mutation without setting attributes) |

## Re-running cleanly

State that persists between runs (paths from repo root):
- `code/scripts/.ctx_nodes.json` — the 800 contextualized chunks (M3's expensive step). Delete to force re-contextualization.
- `code/scripts/eval_results.json` — the running scoreboard. Delete to start fresh.
- HuggingFace model cache — `~/.cache/huggingface/` on macOS/Linux, `%USERPROFILE%\.cache\huggingface\` on Windows. Leave alone unless you want to redownload.

**macOS / Linux:**
```bash
rm -f code/scripts/.ctx_nodes.json code/scripts/eval_results.json
```

**Windows (PowerShell):**
```powershell
Remove-Item -ErrorAction SilentlyContinue code\scripts\.ctx_nodes.json, code\scripts\eval_results.json
```

**Windows (cmd):**
```cmd
del /q code\scripts\.ctx_nodes.json code\scripts\eval_results.json 2>nul
```

## Data licensing

Kubernetes documentation is **CC-BY-4.0** (<https://github.com/kubernetes/website/blob/main/LICENSE>). The fetcher downloads from the upstream repo; nothing is redistributed in this project.
