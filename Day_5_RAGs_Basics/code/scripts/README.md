# Module scripts — run individually, end-to-end

Standalone Python scripts — one per module, runnable end-to-end. Each script uses `asyncio.run()` at the entry point and an in-memory vector store — no nest_asyncio recursion, no LanceDB tokio races, no executor bugs.

## One-time setup

**macOS / Linux:**
```bash
cd code
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
python download_data.py    # if data/k8s-docs/ not yet populated
```

**Windows (PowerShell):**
```powershell
cd code
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
"OPENROUTER_API_KEY=sk-or-v1-..." | Out-File -Encoding ascii .env
python download_data.py
```

If PowerShell blocks `Activate.ps1`, run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

**Windows (cmd):**
```cmd
cd code
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
echo OPENROUTER_API_KEY=sk-or-v1-...> .env
python download_data.py
```

## Run order

Each script:
1. Builds whatever it needs (or loads from cache).
2. Runs the 3 canonical test queries (Q1/Q2/Q3) and prints the answers.
3. Runs RAGAS on the **full 30-question goldset** (10 exact-match + 10 cross-section + 10 multi-hop). Each module's strengths show up on its target category.
4. Appends scores to `eval_results.json`.

**macOS / Linux:**
```bash
cd code/scripts
python m0_naive.py            # ~5 min  — baseline. Q1, Q3 fail.
python m2_hybrid.py           # ~7 min  — adds BM25 + RRF + reranker. Q1 fixed.
python m3_contextual.py       # ~8-12 min first run (LLM-contextualizes ~800 chunks; cached after). Q2 fixed.
python m4_decomposition.py    # ~8 min  — uses M3 cache. Q3 fixed.
python m5_agentic.py          # ~15 min — LangGraph agent + eval (slow on purpose; teaches the routing point).
python show_results.py        # print the scoreboard at any time
```

**Windows (PowerShell or cmd):**
```cmd
cd code\scripts
python m0_naive.py
python m2_hybrid.py
python m3_contextual.py
python m4_decomposition.py
python m5_agentic.py
python show_results.py
```

### Eval scope: 30 questions every run

By default each module evaluates on **all 30 goldset questions**:
- `q01–q10` exact_match — literal flags, defaults, identifiers (BM25's home turf)
- `q11–q20` cross_section — answer split across chunk boundaries (contextual ingest's home turf)
- `q21–q30` multi_hop — answer requires combining 2+ docs (decomposition's home turf)

Each module wins on a different category. **Running fewer than 30 hides part of the story.**

### Reducing the eval count to save tokens

For fast dev iteration — or to keep dry-run cost down — edit the `evaluate_async(...)` call near the bottom of any module script (`m0_naive.py`, `m2_hybrid.py`, `m3_contextual.py`, `m4_decomposition.py`, `m5_agentic.py`) and pass a `sample` argument:

```python
# Default — runs all 30 questions
await evaluate_async(naive_query, "M0_naive")

# Faster — runs the first 10 (exact_match only)
await evaluate_async(naive_query, "M0_naive", sample=10)

# 1-question smoke test — fastest, just q01
await evaluate_async(naive_query, "M0_naive", sample=1)
```

The goldset is sequential by category (q01–q10 exact_match, q11–q20 cross_section, q21–q30 multi_hop), so:

| `sample=` | Questions | What it covers | Time per module | $ per module |
|---|---|---|---|---|
| `1` | q01 | smoke test | ~30 s | <$0.05 |
| `10` | q01–q10 | exact_match only | ~2 min | ~$0.20 |
| `20` | q01–q20 | exact + cross-section | ~5 min | ~$0.40 |
| `None` (default) | q01–q30 | full goldset | ~5–15 min | ~$0.30–3 |

For the agentic M5, costs and times are 3-10× the table above (each agent invocation is up to 3 retrieve+judge+answer cycles). To cap M5 specifically, lower `s["iterations"] >= 3` to `>= 2` in `m5_agentic.py`'s `should_continue` function — that bounds each question to 2 cycles instead of 3.

**To skip M5 entirely** during a dry-run (cuts cost ~50%): just don't run `m5_agentic.py`. M0–M4's results stay valid in `eval_results.json`.

## Files

| File | What |
|---|---|
| `common.py` | Shared config, paths, RAGAS eval helper, results persistence |
| `m0_naive.py` | Naive RAG + baseline eval |
| `m2_hybrid.py` | Hybrid + RRF + reranker + eval |
| `m3_contextual.py` | Contextual ingest + eval + record-manager demo |
| `m4_decomposition.py` | HyDE + decomposition + eval |
| `m5_agentic.py` | LangGraph agent + eval (and demo on an ambiguous query) |
| `show_results.py` | Print the scoreboard |
| `eval_results.json` | Auto-generated; persists scores across runs |
| `.ctx_nodes.json` | Auto-generated cache of contextualized chunks (M3 → reused by M4/M5) |

## Caching behavior

- **M0 / M2** — rebuild the in-memory index every run (cheap, ~30s ingest).
- **M3** — the expensive part is the LLM contextualization step (~800 calls, 1–2 min). Cached to `.ctx_nodes.json` after the first run. Subsequent runs of M3/M4/M5 read this file and skip the LLM step.
- **M4 / M5** — load the contextualized chunks from cache, build the in-memory index in seconds.

To force a full rebuild:
- macOS / Linux: `rm scripts/.ctx_nodes.json`
- Windows PowerShell: `Remove-Item scripts\.ctx_nodes.json`
- Windows cmd: `del scripts\.ctx_nodes.json`

## Reading the scoreboard

Verified end-to-end run on all 30 goldset questions:

```
=== Scoreboard ===
module                       faithfulness   answer_relevancy
------------------------------------------------------------
M0_naive                            0.922              0.838
M2_hybrid_rerank                    0.953              0.867
M3_contextual                       0.942              0.847
M4_decomposition                    0.945              0.690
M5_agentic                          0.959              0.886
```

Numbers are means over the 30-question goldset. Higher is better.

**Don't expect every metric to monotonically improve.** Each module is optimized for a different failure class:
- **M2 is the biggest cheap win** — hybrid + rerank lifts both metrics.
- **M3's slight dip vs M2 is honest** — contextual prefixes added non-keyword text that diluted BM25's signal on exact-match queries (where M2 was already crushing it). M3 still helps on cross-section; the corpus-wide average just trades a little of M2's gain.
- **M4's answer_relevancy crater (0.86 → 0.69) is the routing argument** — faithfulness held (no hallucination), but decomposing simple queries into 2-4 sub-questions sent the synthesis broader than the original asked. *Don't decompose by default — route.*
- **M5 wins both** — best faithfulness AND best answer_relevancy. Agent terminates early when retrieval succeeds first-shot, iterates when it doesn't. Adaptive cost, not free quality.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `OPENROUTER_API_KEY missing` | No `.env` | macOS/Linux: `echo "OPENROUTER_API_KEY=sk-or-v1-..." > code/.env` · Windows PS: `"OPENROUTER_API_KEY=sk-or-v1-..." \| Out-File -Encoding ascii code\.env` |
| `OpenRouter unreachable` | Key inactive / rate-limited / no funding | Check the key is active. macOS/Linux: `curl -sS https://openrouter.ai/api/v1/models \| head`. Windows PS: `Invoke-WebRequest https://openrouter.ai/api/v1/models -UseBasicParsing` |
| PowerShell: `Activate.ps1 cannot be loaded` | Default execution policy blocks unsigned scripts | Run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| Windows: `'python' is not recognized` | Python not on PATH | Re-run the Python installer and tick "Add python.exe to PATH", or use `py` instead of `python` |
| One question NaN mid-eval | Judge truncated mid-JSON (long answer, many claims) | Already handled — averaged over remaining 9. Already bumped `max_tokens=8192`; raise further if persistent |
| All scores NaN | Judge model unreachable or schema mismatch | Switch `JUDGE_MODEL` in `common.py` to `anthropic/claude-haiku-4.5` |
| M3 contextualization slow / rate-limited | OpenRouter throttling | Drop `Semaphore(20)` to `Semaphore(10)` in `m3_contextual.py` |
| Reranker first load is slow | One-time ~280 MB HuggingFace download | Wait it out; cached after |
| Different scores across runs | RAGAS judge variance | Expected, ±0.05 per metric is normal |
| `lance error: Not found` | Old LanceDB-backed script — shouldn't happen anymore | Make sure you're on the latest scripts (in-memory store) |

## Why scripts (and not Jupyter)

Three things broke when this lived in a notebook:

1. `nest_asyncio` + RAGAS's executor → `RecursionError(maximum recursion depth exceeded)` on every job.
2. RAGAS 0.4 metrics dispatch through `instructor` + `anyio`, which sometimes fails to detect the running asyncio loop inside Jupyter and refuses to run.
3. LanceDB's tokio background loop fights with Jupyter's running asyncio loop on Python 3.14 / macOS, causing transient `Not found` errors mid-query.

Scripts use plain `asyncio.run(main())` and an in-memory vector store — no async-context drama, no disk-backed flakiness. Same modules, same scores, runnable cold.
