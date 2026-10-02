# RAG Reading List & Further Resources

> Curated companion to the RAG lecture transcript, biased toward an engineering audience. The lecture covered the naive RAG baseline very well; this list is what you give learners *after* that — to take them from "I built a toy RAG in Colab" to "I shipped a system someone is paying for." Organised by what you read first, not by topic alphabetically.

---

## 1. Read these first (3–4 hours total)

- **Anthropic — Contextual Retrieval** *(the single highest-ROI read on this list)*
  https://www.anthropic.com/news/contextual-retrieval
  Why prepending a 50-token LLM-generated context blurb to each chunk before embedding cuts retrieval failures by 35–67%. Includes the prompt-caching trick that makes it economical.

- **Building a Production RAG Pipeline — Hybrid (BM25 + dense + RRF)** — Kumaran Srinivasan
  https://medium.com/@kumaran.isk/building-a-production-rag-pipeline-start-with-hybrid-retrieval-dense-bm25-rrf-e901aba17cae
  The clearest "go from naive to production-ready in one architectural change" piece. Recall@10 78 → 91% with concrete numbers.

- **How to Build a Production RAG Pipeline (2026)** — Roborhythms
  https://www.roborhythms.com/how-to-build-production-rag-pipeline-2026/
  The 2026-current version of the classic "stuff every team rediscovers" essay. Hybrid → rerank → contextual → query-rewrite → eval, with realistic latency/cost numbers.

- **Snowflake — Benchmarking LLM-as-Judge for the RAG Triad**
  https://www.snowflake.com/en/engineering-blog/benchmarking-LLM-as-a-judge-RAG-triad-metrics/
  Engineering-style writeup of how to actually score context relevance, groundedness, and answer relevance. Read this before you build a single eval.

---

## 2. Foundational papers (keep on your desk)

- **Lewis et al. (2020) — *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*** (the original RAG paper)
  https://arxiv.org/abs/2005.11401

- **Karpukhin et al. (2020) — *Dense Passage Retrieval for Open-Domain QA*** (DPR — the dense retrieval baseline RAG built on)
  https://arxiv.org/abs/2004.04906

- **Robertson & Zaragoza (2009) — *The Probabilistic Relevance Framework: BM25 and Beyond*** (the canonical BM25 reference)
  https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf

- **Khattab & Zaharia (2020) — *ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT***
  https://arxiv.org/abs/2004.12832

- **Gao et al. (2022) — *Precise Zero-Shot Dense Retrieval without Relevance Labels*** (HyDE)
  https://arxiv.org/abs/2212.10496

- **Edge et al. (2024) — *From Local to Global: A Graph RAG Approach to Query-Focused Summarization*** (Microsoft GraphRAG)
  https://arxiv.org/abs/2404.16130

- **Es et al. (2023) — *RAGAS: Automated Evaluation of Retrieval-Augmented Generation***
  https://arxiv.org/abs/2309.15217

---

## 3. Embeddings — leaderboards, models, and the "what should I use" question

- **MTEB — Massive Text Embedding Benchmark (live leaderboard)**
  https://huggingface.co/spaces/mteb/leaderboard
  The first place to look when picking an embedder. Filter by language, by task (retrieval), and by model size.

- **MTEB April 2026 leaderboard digest** (Awesome Agents)
  https://awesomeagents.ai/leaderboards/embedding-model-leaderboard-mteb-april-2026/
  Pre-chewed snapshot of the leaderboard with cost/throughput annotations.

- **Best Embedding Models for RAG, 2026 — PremAI**
  https://blog.premai.io/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting/
  Side-by-side: Gemini Embedding 001 (~68.32 avg, English leader), Qwen3-Embedding-8B (70.58, multilingual leader), Voyage-3, Jina v4 (multimodal), bge-m3 (open default).

- **BGE-small-en-v1.5 model card** (the lecture's teaching default)
  https://huggingface.co/BAAI/bge-small-en-v1.5
  *Note: 384-dim, not 768 — `bge-base-en-v1.5` is the 768-dim variant.*

- **Jina — Late Chunking in Long-Context Embedding Models**
  https://jina.ai/news/late-chunking-in-long-context-embedding-models/

- **Embedding Projector** (the lecture's live demo)
  https://projector.tensorflow.org/
  Drop in an embedding matrix and watch nearest-neighbour clusters in 3D. Great teaching artefact.

---

## 4. Retrievers, reranking, and search

- **Reranker leaderboard** (Agentset, 2026)
  https://agentset.ai/rerankers
  Zerank-2 and Cohere Rerank v4 lead production benchmarks; Voyage rerank-2.5 and bge-reranker-v2-m3 are strong open alternatives.

- **Cohere — Rerank documentation**
  https://docs.cohere.com/docs/rerank

- **Voyage — Rerank-2 announcement**
  https://blog.voyageai.com/2024/09/30/rerank-2/

- **bge-reranker-v2-m3** (free, runs locally)
  https://huggingface.co/BAAI/bge-reranker-v2-m3

- **Vertex AI — Hybrid Search reference**
  https://docs.cloud.google.com/vertex-ai/docs/vector-search/about-hybrid-search

- **Reciprocal Rank Fusion (Cormack et al., 2009)**
  https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf

---

## 5. Chunking strategies

- **Firecrawl — Best Chunking Strategies for RAG (2026)**
  https://www.firecrawl.dev/blog/best-chunking-strategies-rag
  Cliff notes: recursive 512-token splitting often beats semantic chunking. Don't believe the hype unconditionally.

- **Clinical chunking benchmark — PMC**
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12649634/
  Counter-evidence: in domain-specific corpora, adaptive/proposition chunking is +30 points over baseline.

- **AWS — Contextual Retrieval in Bedrock Knowledge Bases**
  https://aws.amazon.com/blogs/machine-learning/contextual-retrieval-in-anthropic-using-amazon-bedrock-knowledge-bases/

---

## 6. Vector databases — production picks and trade-offs

- **Vector DB comparison 2026 — 4xxi**
  https://4xxi.com/articles/vector-database-comparison/

- **pgvector vs Pinecone vs Turbopuffer vs Qdrant 2026** (digest)
  https://app.daily.dev/posts/pgvector-vs-pinecone-vs-turbopuffer-vs-qdrant-2026--m1dot7ras
  pgvectorscale reportedly 11.4× throughput vs Qdrant on a 50M-vector single-node test.

- **LanceDB** (the lecture's choice — embedded, no server)
  https://lancedb.com/

- **Qdrant docs** — best-in-class hybrid search for self-hosted production
  https://qdrant.tech/documentation/

- **pgvector** (Postgres extension)
  https://github.com/pgvector/pgvector

- **pgvectorscale** (StreamingDiskANN on top of pgvector)
  https://github.com/timescale/pgvectorscale

- **Pinecone docs**
  https://docs.pinecone.io/

- **Weaviate docs**
  https://weaviate.io/developers/weaviate

---

## 7. Frameworks and orchestration

- **LlamaIndex docs** (the lecture's framework; cleanest ingest abstraction)
  https://docs.llamaindex.ai/

- **LlamaHub — connectors and tools registry** (the lecture's tour)
  https://llamahub.ai/

- **LlamaParse** — high-quality PDF parsing
  https://docs.llamaindex.ai/en/stable/llama_cloud/llama_parse/

- **LangGraph** (LangChain's graph-of-agents library — the answer for agentic RAG)
  https://langchain-ai.github.io/langgraph/

- **DSPy** (programmatic prompt optimisation; lowest framework overhead at ~3.5ms)
  https://dspy.ai/

- **Haystack** (strong in regulated industries)
  https://haystack.deepset.ai/

- **iternal — RAG framework comparison (2026)**
  https://iternal.ai/blockify-rag-frameworks

- **Aimultiple — RAG frameworks roundup**
  https://aimultiple.com/rag-frameworks

---

## 8. Evaluation harnesses

- **RAGAS** (the most-cited harness)
  https://docs.ragas.io/

- **TruLens** (RAG triad with OTel tracing inline)
  https://www.trulens.org/

- **DeepEval** (modern PyTest-style entrant)
  https://docs.confident-ai.com/

- **Atlan — LLM evaluation frameworks compared (2026)**
  https://atlan.com/know/llm-evaluation-frameworks-compared/

---

## 9. Beyond classic RAG

### Agentic RAG
- **Next-Generation Agentic RAG with LangGraph (2026)** — Vinod Rane
  https://medium.com/@vinodkrane/next-generation-agentic-rag-with-langgraph-2026-edition-d1c4c068d2b8

- **Agentic RAG Patterns: Multi-Step Reasoning Guide** — Digital Applied
  https://www.digitalapplied.com/blog/agentic-rag-patterns-multi-step-reasoning-guide

- **A-RAG (open-source reference impl)**
  https://github.com/Ayanami0730/arag

### GraphRAG
- **Microsoft GraphRAG site & code**
  https://microsoft.github.io/graphrag/

- **GraphRAG in 2026: A Practical Buyer's Guide** — Tongbing
  https://medium.com/@tongbing00/graphrag-in-2026-a-practical-buyers-guide-to-knowledge-graph-augmented-rag-43e5e72d522d

- **LightRAG** — open-source entry point
  https://github.com/HKUDS/LightRAG

### Long-context vs RAG
- **TokenMix — 1M Token Context Reality Check (2026)**
  https://tokenmix.ai/blog/1m-token-context-reality-check-2026

- **MindStudio — 1M Token Context vs RAG (Claude)**
  https://www.mindstudio.ai/blog/1m-token-context-window-vs-rag-claude

### MCP + RAG
- **TheNewStack — How to Build RAG Applications using MCP**
  https://thenewstack.io/how-to-build-rag-applications-using-model-context-protocol/

- **Model Context Protocol — official docs**
  https://modelcontextprotocol.io/

### Production patterns
- **Redis — RAG at Scale (2026)** (semantic caching, ~68% cost cut)
  https://redis.io/blog/rag-at-scale/

---

## 10. Tools the lecture demoed (or should have)

- **artificialanalysis.ai** — live LLM leaderboard (intelligence vs price vs speed) — the lecture's reference
  https://artificialanalysis.ai/

- **OpenAI pricing page** — live $/M-token reference
  https://openai.com/api/pricing/

- **Hugging Face Models** — start here for any open-weights model
  https://huggingface.co/models

- **Hugging Face Inference API** — what the lecture's notebook calls
  https://huggingface.co/docs/api-inference/

- **NotebookLM** (consumer RAG; great learning artefact)
  https://notebooklm.google.com/

- **Streamlit** — minimal RAG UI
  https://streamlit.io/

- **Gradio** — alternative minimal UI
  https://www.gradio.app/

- **Ollama** — local model runtime; the lecture's optional detour
  https://ollama.com/

- **Chroma** (free vector DB; mentioned as the LanceDB alternative)
  https://www.trychroma.com/

- **FAISS** (Facebook AI Similarity Search; the OG)
  https://github.com/facebookresearch/faiss

---

## 11. Newsletters & ongoing reading

- **The Batch — DeepLearning.AI** (the lecture's recommendation #1)
  https://www.deeplearning.ai/the-batch/

- **Alpha Signal** (the lecture's recommendation #2)
  https://alphasignal.ai/

- **Latent Space** (technical interviews; production AI engineering)
  https://www.latent.space/

- **Import AI — Jack Clark** (policy + research roundup)
  https://importai.substack.com/

- **Hacker News** (the AI Tag)
  https://news.ycombinator.com/

---

## 12. Suggested study path for an engineer with the lecture under their belt

1. **Day 1.** Reproduce the lecture's notebook end-to-end. Swap the persona dataset for your own ~50 PDFs. Note three queries it answers badly.
2. **Day 2.** Read the Anthropic Contextual Retrieval and Kumaran-Srinivasan Hybrid posts. Add BM25 + RRF to your retrieval and re-run the three failing queries.
3. **Day 3.** Add `bge-reranker-v2-m3` over the top-20. Compare quality on the same three queries.
4. **Day 4.** Build a 50-question goldset (LLM-drafted, you-filtered). Wire RAGAS + LLM-as-judge for the RAG triad.
5. **Day 5.** Add one query-rewrite pattern (HyDE or decomposition). Measure the eval delta.
6. **Day 6.** Stand up Qdrant or pgvector and migrate. Re-measure.
7. **Day 7.** Wrap the retriever as an MCP server and call it from Claude Desktop or Cursor.

If you can do all seven steps and produce a single chart that shows your RAG triad metrics moving as each upgrade lands, you're well past where most production teams are in 2026.
