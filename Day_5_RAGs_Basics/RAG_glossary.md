# RAG Glossary — Engineering Reference

> Companion to the RAG lecture transcript. Definitions are written for a mid-to-senior engineering audience: terse on the basics, opinionated where the field has a 2026 consensus, and explicit about trade-offs. Where the lecture used a memorable analogy, it's noted in italics.

---

## Core architecture

**RAG (Retrieval-Augmented Generation)**
A pattern where a generative model is given relevant context retrieved from an external store at inference time, instead of relying solely on what's baked into the model's weights. Three letters, three responsibilities: **R**etrieve relevant chunks from a vector (or hybrid) index, **A**ugment the prompt with those chunks, **G**enerate the answer with the LLM. The LLM contributes formatting and reasoning over the retrieved facts; it is not the source of facts.

**Indexing pipeline**
The offline path: data sources → loader → chunker → embedder → vector store. Runs on data ingest and on data refresh. Cost is dominated by the embedder and the storage layer.

**Querying pipeline**
The online path, run per request: user query → embedder (same model as indexing) → similarity search → top-k chunks → LLM generation → answer. Latency budget is dominated by the LLM call.

**Knowledge cutoff**
The date past which an LLM's training data ends. RAG exists in part to paper over this — you can serve answers about events newer than the model's cutoff because retrieval, not training, supplies the facts.

**Hallucination**
A model output that's syntactically confident but factually wrong or fabricated. Grounding the model on retrieved passages with explicit "answer only from the provided context" instructions sharply reduces hallucination but does not eliminate it; eval is how you know whether you've actually moved the needle.

---

## Data & ingestion

**Loader / connector**
The adapter that pulls raw bytes from a source (PDF, DOCX, CSV, SQL, NoSQL, SharePoint, Confluence, GitHub, Wikipedia, web) and emits documents with text plus metadata. LlamaHub is the de-facto registry of these connectors. **LlamaParse** handles messy PDFs (multi-column, tables, scanned) better than rolled-your-own pipelines.

**Document**
The unit produced by a loader. Carries `text`, an `id`, and arbitrary `metadata` (filename, page, section, URL, timestamps, ACLs). Metadata is what makes filtered retrieval and per-tenant isolation possible — design it deliberately.

**Chunking**
Splitting documents into smaller passages so they (a) fit a useful similarity-search window and (b) can be retrieved/scored in parallel. *Lecture analogy: open-book exam. Group A (one person, whole book, sequential) vs. Group B (five people, one chapter each, parallel). Chunking is Group B.*

**chunk_size**
Length of each chunk. In LlamaIndex it counts characters; other libraries count tokens. Heuristic from the lecture: small corpus → 100 / overlap 20; large corpus → 1000 / overlap 200. Values too large blow your LLM context budget; too small, you lose the surrounding sentences that disambiguate the chunk.

**chunk_overlap**
Number of characters/tokens shared between adjacent chunks so a sentence that crosses a boundary still appears in at least one whole chunk. *Lecture analogy: photosynthesis-across-chunks — if half the explanation lives in chunk N and half in N+1, overlap keeps the meaning intact.*

**Recursive (character) splitting**
The default chunker. Walks a list of separators (`\n\n`, `\n`, `. `, ` `, `""`) from largest to smallest, splitting only as finely as needed to respect chunk_size. Boring and effective; in 2026 benchmarks it beats semantic chunking on enough corpora to remain the recommended default.

**Semantic chunking**
Boundaries chosen where adjacent sentence embeddings drop below a percentile threshold of similarity. Pricey at ingest (you embed every sentence, then compare adjacent pairs), and the empirical wins are mixed.

**Agentic chunking**
An LLM proposes chunk boundaries based on logical units (definitions, procedures, propositions). Worth the cost in legal, medical, financial, and other high-stakes content where a wrong split is a wrong answer.

**Late chunking (Jina)**
Embed the whole document with a long-context embedder first, then mean-pool per chunk. Each chunk's vector carries document-wide context "for free." Available natively in `jina-embeddings-v3/v4`.

**Contextual retrieval (Anthropic, Sept 2024)**
Prepend a short LLM-generated context blurb (e.g., "This passage is from Section 3.2 of the K8s GC docs and covers cascading deletion.") to each chunk before embedding *and* before BM25 indexing. Cuts retrieval miss rate by 35% standalone, 49% with BM25, 67% with a reranker. Cheap when paired with prompt caching.

---

## Embeddings & vector representation

**Embedding**
A dense numerical vector that represents the meaning of a piece of text. Trained so semantically similar text maps to nearby vectors in the same space. The whole RAG enterprise rides on the assumption that "near in embedding space" ≈ "relevant to the same query."

**Dimension**
Length of the embedding vector. Common values: `bge-small-en-v1.5` → **384** (note: the lecture said 768; the small variant is 384, `bge-base` is 768), OpenAI `text-embedding-3-small` → 1536, `text-embedding-3-large` → 3072, Gemini Embedding 001 → 3072 with truncation, Voyage-3 → 1024. More dims ≠ strictly better; benchmark with MTEB and your own goldset.

**Tokenization**
Splitting text into subword units before embedding/generation. **One token ≠ one word.** Roughly 1 token ≈ ¾ of an English word; "tokenization" itself is ~4 tokens. Pricing is per-token, so cost math has to start here.

**Embedding model**
The neural net that produces the vectors. Keep it simple: pick one with a good MTEB score in your domain, hold it constant for a corpus (you cannot mix vectors from different embedders), and budget for a re-index when you upgrade it.

**Co-occurrence / training intuition**
Embeddings are learned on text-pair signals (skip-gram, masked-LM, contrastive pairs, instruction-tuned retrievers). *Lecture sidebar: a 450K × 450K co-occurrence matrix where "king/royal/kingdom/queen" pile up together and "playing/tasty/apple" pile up elsewhere.* You don't train these yourself — you consume them.

**Matryoshka embeddings**
Models trained so that the first *k* dimensions are themselves a usable embedding. Lets you store full-dim vectors but query at half- or quarter-dim, trading a small accuracy hit for big latency/cost wins. OpenAI te-3, Nomic v2, Gemini Embedding 001 all support this.

**ColBERT / late-interaction**
Keeps one vector per token instead of one per chunk; scores with MaxSim. Higher quality on retrieval-heavy benchmarks, much higher storage and latency. Most teams get most of the same benefit from a cross-encoder reranker.

---

## Storage & search

**Vector store / vector DB**
Stores `(id, embedding, chunk_text, metadata)` rows and answers approximate-nearest-neighbour (ANN) queries fast. Engineering options at a glance:
- **LanceDB** — embedded, no server, Lance columnar format. Lecture's choice; great for ≤ ~100 PDFs and laptops.
- **Qdrant** — hybrid search, payload filtering, multi-tenancy. Strong production default.
- **pgvector + pgvectorscale** — Postgres extension. If you're already on Postgres and < ~10–50M vectors, often the right answer.
- **Pinecone** — managed, well-documented, increasingly hard to differentiate on price.
- **FAISS / Chroma** — fine for prototypes; not the production answer in 2026.
- **Weaviate** — all-in-one with hybrid + agents + GraphQL.
- **Turbopuffer** — order-of-magnitude cheaper storage at the cost of cold-query latency.

**Cosine similarity**
Dot product of two L2-normalised vectors; equivalently, cosine of the angle between them. Range [-1, 1]; 1 means identical direction, 0 means orthogonal, -1 means opposite. The default similarity for retrieval over normalised embeddings.

**Euclidean distance**
Straight-line distance in vector space. Inversely proportional to cosine similarity once vectors are unit-norm: bigger distance = smaller similarity. Use whichever the DB defaults to; don't mix.

**Top-k**
Number of chunks returned by similarity search. Engineer's choice; default ~5 in the lecture, ~20 if you plan to rerank. Larger k → higher recall, more LLM input tokens, higher cost, more "lost-in-the-middle" risk.

**Approximate nearest neighbour (ANN)**
Index structures (HNSW, IVF, ScaNN, DiskANN) that trade a small recall hit for orders-of-magnitude faster search vs. brute-force cosine over millions of vectors. The thing that makes vector DBs useful at scale.

**BM25**
Classic sparse retrieval: TF-IDF with length normalisation. Wins on exact-match queries (SKUs, error codes, IPs, function names) where dense retrievers underperform. *The single biggest reason naive dense-only RAG embarrasses itself in production.*

**Hybrid retrieval (BM25 + dense + RRF)**
Run BM25 and dense in parallel, fuse the rankings with **Reciprocal Rank Fusion** (`score = Σ 1/(k + rank)`, conventionally k=60). Lifts recall@10 from ~78% (dense-only) to ~91% on typical corpora. Native in Qdrant, Weaviate, Elasticsearch, OpenSearch, Milvus, Vertex AI in 2026. Mandatory for any serious RAG.

**Cross-encoder reranker**
A model that takes (query, chunk) as a single joint input and outputs a relevance score. Slower per pair than bi-encoder embedding (~600 ms for top-20), but materially more accurate. Run it over the top-20/30 from retrieval, not the whole corpus. Open default: `bge-reranker-v2-m3`. Closed defaults: Cohere Rerank v4, Voyage rerank-2.5.

---

## The query side

**Query rewrite**
Transform the user's query before retrieval. Common patterns:
- **Paraphrase / multi-query** — generate N alternative phrasings, retrieve for each, union the results.
- **HyDE** (Hypothetical Document Embeddings) — ask the LLM to draft a fake answer, embed *that*, retrieve the real chunks closest to it. +20–40% precision on knowledge-dense corpora.
- **Step-back prompting** — first generalize the question ("what's the broader concept?"), retrieve over the general form, then answer the specific question.
- **Decomposition** — break a multi-hop question into sub-questions, retrieve for each, compose. The single biggest fix for "multi-hop dead ends."

**Top-k retrieval**
The actual ANN call against the vector DB; returns k chunks with similarity scores and metadata. Often combined with a metadata filter (`tenant_id == 'acme' AND lang == 'en'`).

**Context window**
The LLM's input size budget, in tokens. The retrieved chunks plus the system prompt plus the user query must fit. Long-context models (Claude 4.6 at 1M, Gemini 3.x at 1M+) raise the ceiling but don't eliminate the need for relevance — recall on most models still drops past ~256K tokens.

**Augmented prompt**
The actual string fed to the LLM. Typical shape:
```
SYSTEM: Answer only from the context. If unsure, say so.
CONTEXT:
[chunk 1]  (source: doc_a.pdf p.3)
[chunk 2]  (source: doc_b.md §intro)
QUESTION: <user query>
```

**Grounded answer**
Generated text that explicitly references the retrieved chunks as its source of truth. Citations (chunk IDs, page numbers, URLs) are part of "grounded" — without them you can't audit.

---

## Generation

**LLM**
The generative model. In a RAG system its job is to *format* and *reason over* retrieved facts, not to produce facts on its own. The lecture's framing is correct: the LLM is the worst part of the system to trust as a source.

**Generation model match-up**
Match embedder family with LLM family when you can — OpenAI embed → OpenAI LLM, Gemini → Gemini, Voyage → any. Or, more practically: pick a dedicated retrieval embedder benchmarked on MTEB and a separate generation LLM tuned for instruction-following.

**Sweet spot for RAG generation (April 2026)**
Claude Haiku 4.5 / Sonnet 4.6, Gemini 2.5 Flash, GPT-5.x mini — all in the $0.50–$3 per Mtok input band. Fast and good at grounding. Reach for Opus/Pro reasoning models for the planner/decomposer, then route generation to something cheaper.

**Prompt caching**
Provider-side caching of the static portions of a long prompt (system + retrieved context). Cuts both cost and latency, makes contextual retrieval economical, supported across Anthropic, OpenAI, Bedrock.

---

## Eval

**RAG triad**
Three orthogonal metrics for a RAG system, almost always computed by an LLM judge:
1. **Context relevance** — was the retrieved context actually relevant to the question?
2. **Groundedness / faithfulness** — does the answer follow from the context (no hallucinations)?
3. **Answer relevance** — does the answer actually address the question asked?
Movements in each correspond to specific architectural fixes (1 → retriever; 2 → prompt + LLM; 3 → both).

**Goldset**
A held-out set of ~50–500 question-answer pairs over your corpus, used as ground truth. Cheap workflow: LLM drafts candidates, humans filter and edit. *"If you can't draw the metric graph, you don't have a RAG system, you have a vibe."*

**Precision@k / Recall@k / MRR / nDCG**
Classic IR metrics, still useful when you have labelled relevance. Precision@k = fraction of the top-k that are relevant. Recall@k = fraction of all relevant docs that appeared in top-k. MRR = mean reciprocal rank of the first relevant result. nDCG weighs higher ranks more heavily.

**LLM-as-judge**
Use a strong LLM to score the RAG triad against the goldset. Cheap, scalable, and the only practical answer when you have no labelled ground truth. Watch out for evaluator-leakage (judge and generator are the same family) — use a different family or a calibrated rubric.

**RAGAS / TruLens / DeepEval**
The eval harnesses you'd actually wire into CI. RAGAS is most-cited; TruLens is favoured where you want OTel tracing; DeepEval is the modern PyTest-ish entrant. Pick one, ship it on day one, don't wait for a "v2."

---

## Beyond classic RAG

**Agentic RAG**
The LLM is the controller — it decides what to retrieve, whether to retrieve again, and when to stop. The retriever is exposed as a tool the agent calls in a loop. Burns 3–10× the tokens of single-pass RAG; route easy queries to classic hybrid+rerank and only escalate to agentic for the hard tail.

**GraphRAG**
Build a knowledge graph from the corpus, summarise communities, retrieve subgraphs at query time. Excels on *narrative* corpora and *global* questions ("what are the major themes across all docs"). The original Microsoft pipeline is expensive; **LazyGraphRAG** (2025) is the practical version. **LightRAG** is the open-source entry point.

**Long-context vs RAG**
Stuffing the whole corpus into a 1M-token window. Real models exist (Claude Opus 4.6 at ~93% MRCR-v2 recall at 1M, Gemini 3.x Pro lower). Does **not** kill RAG: a 900K-token call costs ~$4.50 in input alone with TTFT 20–30s; for multi-user or latency-sensitive systems hybrid RAG wins on cost-per-query by 2–3 orders of magnitude. Treat long-context as a routing decision: small corpus + global question → stuff it; everything else → retrieve.

**Vectorless RAG**
Catch-all for retrieval that skips embeddings: TF-IDF + page rank, structured-keyword (Ctrl-F-style) search, plus large-context models doing the rest. Research-stage; nothing concrete to deploy yet.

**Multimodal RAG**
Two patterns. (1) Use a vision-language model directly: embed images with CLIP/Jina v4 and let the VLM consume them at generation. (2) Pre-generate text descriptions of images at ingest, embed those, and retrieve the image URL alongside the text chunk (Myntra-style). Pattern 2 plays nicer with classic vector DBs; pattern 1 is cleaner but needs a multimodal embedder and a VLM.

**MCP (Model Context Protocol)**
The 2026 integration layer. Wrap your retriever as an MCP server and any client (Claude Desktop, Cursor, custom agents) can call it. ~20 minutes to wire up and the most leverage you'll find for late-stage architectural cleanup.

**Tool calling vs agentic RAG**
Tool calling is the API: the LLM emits a structured request and your code calls a function. Agentic RAG is one consumer of tool calling: a loop where the LLM keeps invoking `retrieve(query, k)` until it has enough context. Tool calling is a primitive; agentic RAG is a pattern built on it.

**Fine-tuning (and why it's usually not the answer)**
Adjusting model weights on your data. Expensive, slow to iterate, and nukes the moment your data drifts. Use RAG when facts change; fine-tune only when style, format, or non-textual behaviour needs to change. The lecture takes a hard line here and 2026 production teams broadly agree.

---

## Operations

**API key hygiene**
Never hard-code provider keys. Use a secrets manager (Azure Key Vault, AWS Secrets Manager, 1Password, doppler, `.env` only for local dev with `.env` in `.gitignore`). Rotate immediately on any leak. The lecture's example: leaked HuggingFace token → revoke and re-issue.

**Front-end for a RAG demo**
Streamlit or Gradio. Both ship a usable chat UI in a few hundred lines; both work with FastAPI/Flask backends if you outgrow the built-in server. Cursor/VS Code agents can scaffold either from a one-shot prompt.

**NotebookLM**
Google's polished consumer RAG over user-uploaded sources. Great as a learning artefact and personal tool; not your enterprise solution because you don't control the retriever, embedder, eval, or data residency.

**Cost components of a RAG system (interview-question shape)**
1. **Embedder** — $/M tokens at ingest (cheap; one-time per chunk).
2. **Vector DB** — storage GB-month + query QPS.
3. **LLM** — $/M tokens input + output at generation time. **The dominant cost.**
Optional: reranker call (Cohere/Voyage), prompt-cache hits (saves cost), routing layer.

**Semantic caching**
Cache `(query_embedding → answer)` pairs and return cached answers when an incoming query is sufficiently close in embedding space. Up to ~68% LLM cost reduction in production deployments. Easy to bolt on; watch out for stale answers when the underlying corpus updates.
