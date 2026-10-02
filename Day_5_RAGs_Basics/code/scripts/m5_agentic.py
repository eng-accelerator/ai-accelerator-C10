"""M5 — Agentic loop with LangGraph.

THE PROBLEM M5 SOLVES:
    Some queries are genuinely ambiguous:

        "How do I make sure my cluster keeps running smoothly when nodes fail?"

    There's no clean decomposition. The model has to TRY a query, look at
    what it got back, decide whether it's sufficient, and if not, reformulate
    and try again. That's an agent loop.

THE STATE MACHINE:

    ┌──────────────┐
    │   START      │
    └──────┬───────┘
           ▼
    ┌──────────────┐
    │  retrieve    │◄───────────────────┐
    └──────┬───────┘                    │
           ▼                            │
    ┌──────────────┐                    │
    │   judge      │ "is this enough?"  │
    └──────┬───────┘                    │
           ▼                            │
      sufficient?                       │
       /         \\                     │
     YES          NO ──► reformulate ───┘
       │                  (max 3 iters)
       ▼
    ┌──────────────┐
    │   answer     │
    └──────┬───────┘
           ▼
          END

WHY LANGGRAPH (NOT LANGCHAIN AGENTEXECUTOR):
    LangGraph models the loop as an explicit state machine — nodes, edges,
    typed state. You can trace which node ran, what state it produced, why
    each transition fired. AgentExecutor is opaque and notoriously hard to
    debug in production. LangGraph is what came out of LangChain learning
    from years of agent-debugging pain.

WHY THE 3-ITERATION CAP IS NON-NEGOTIABLE:
    Without a cap, agents loop forever on impossible queries. We've seen
    bills run to $20/query in pathological cases. The cap is the difference
    between a useful agent and an outage. Three is empirical — quality is
    flat after that on most corpora.

WHEN TO USE THIS IN PRODUCTION:
    NOT on every query. The agent costs 3-10× the tokens of M2's
    hybrid+rerank for marginal gains on most queries. You ROUTE traffic:

        Simple factual / lookup       → M2 hybrid+rerank   (70-85% of traffic)
        Multi-hop / known structure   → M4 decomposition   (10-20%)
        Genuinely ambiguous           → M5 agent           (5-15%)
        Whole-corpus synthesis        → GraphRAG / Lazy    (<5%)
        One-shot deep analysis        → 1M-context model   (edge cases)

    The router is a small classifier (cheap LLM call or heuristic). Get
    routing right and you cut RAG cost ~5×.

DEPENDS ON M3:
    Uses the contextualized chunks from scripts/.ctx_nodes.json.

Run:
    python scripts/m5_agentic.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import List, TypedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    GENERATION_MODEL,
    OPENROUTER_BASE,
    check_openrouter,
    evaluate_async,
    print_scoreboard,
    require_env,
)
from m3_contextual import build_ctx_engine, build_or_load_ctx_chunks, chunks_to_nodes  # noqa: E402


class AgentState(TypedDict):
    """The state that flows through every node in the graph.

    LangGraph passes this dict to each node; nodes return a partial dict
    that gets merged into the running state. So `node_retrieve` returns
    {"chunks": ..., "iterations": ...} and those keys overwrite (for
    iterations) or append (for chunks, via the merge logic in the node).
    """
    query: str           # current search query (changes after reformulate)
    original_query: str  # the user's original question (for judge + answer)
    chunks: List[str]    # accumulated retrieved chunks across all iterations
    sufficient: bool     # judge's verdict on whether to stop
    iterations: int      # how many retrieve→judge cycles we've done
    answer: str          # final synthesized answer (only set in node_answer)


def build_agent(retriever, sync_client):
    """Build the LangGraph state machine. Returns a compiled graph.

    The four nodes:
      retrieve    — pull chunks for the current query, append to state
      judge       — ask LLM if context is sufficient (one-word answer)
      reformulate — ask LLM to write a better query
      answer      — synthesize final answer from all accumulated chunks

    The conditional edge from `judge` decides:
      sufficient OR iter ≥ 3 → answer (terminate)
      otherwise              → reformulate (loop)
    """
    from langgraph.graph import END, StateGraph

    def node_retrieve(s: AgentState) -> dict:
        """Pull chunks for the current query and append to state."""
        nodes = retriever.retrieve(s["query"])
        new_chunks = [n.get_content() for n in nodes]
        # Print iteration trace so the audience can watch the agent think.
        # +1 because we increment AFTER this node — the iteration count
        # shown matches what just happened.
        print(f"  [iter {s['iterations']+1}] retrieve('{s['query'][:60]}...') → {len(new_chunks)} chunks")
        return {"chunks": s["chunks"] + new_chunks, "iterations": s["iterations"] + 1}

    def node_judge(s: AgentState) -> dict:
        """Ask the LLM whether the accumulated context can answer the question.

        We cap context to the last 10 chunks to keep the prompt small.
        Tighter "YES/NO" output saves tokens and is unambiguous to parse.
        """
        # Use last-10 to bound the prompt size as iterations accumulate.
        ctx = "\n\n---\n\n".join(s["chunks"][-10:])
        prompt = (
            f"Question: {s['original_query']}\n\n"
            f"Retrieved context:\n{ctx}\n\n"
            "Is the context sufficient to fully answer the question? "
            "Reply with exactly one word: YES or NO."
        )
        r = sync_client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8,         # one word + safety margin
            temperature=0,        # deterministic — no creativity needed
        ).choices[0].message.content.strip().upper()
        sufficient = r.startswith("YES")
        print(f"  [iter {s['iterations']}] judge → {'sufficient ✓' if sufficient else 'NOT sufficient'}")
        return {"sufficient": sufficient}

    def node_reformulate(s: AgentState) -> dict:
        """Generate a fresh search query to fill the gap.

        Hint: passing the LAST few chunks (not all of them) keeps the LLM
        focused on what's missing rather than re-summarizing what we have.
        """
        last_ctx = "\n".join(s["chunks"][-3:])[:1500]
        prompt = (
            f"Original question: {s['original_query']}\n\n"
            f"What we retrieved so far does NOT fully answer it. Recent context:\n{last_ctx}\n\n"
            "Write ONE focused follow-up search query that would find the missing "
            "information. Reply with ONLY the query, no preamble."
        )
        r = sync_client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0,
        ).choices[0].message.content.strip()
        print(f"  [iter {s['iterations']}] reformulate → '{r[:80]}...'")
        return {"query": r}

    def node_answer(s: AgentState) -> dict:
        """Synthesize the final answer from ALL accumulated chunks."""
        ctx = "\n\n---\n\n".join(s["chunks"])
        prompt = f"Use ONLY the context to answer.\n\nContext:\n{ctx}\n\nQuestion: {s['original_query']}"
        r = sync_client.chat.completions.create(
            model=GENERATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0,
        ).choices[0].message.content
        return {"answer": r}

    def should_continue(s: AgentState) -> str:
        """The conditional edge: keep iterating or terminate?

        Two terminal conditions:
          1. judge said context is sufficient → done, write the answer
          2. iteration cap reached → write the answer with what we have
             (the cap is what makes this safe — without it, an agent could
             loop forever on an impossible query)
        """
        if s["sufficient"] or s["iterations"] >= 3:
            return "answer"
        return "reformulate"

    # ---- Wire up the graph ----
    graph = StateGraph(AgentState)
    graph.add_node("retrieve", node_retrieve)
    graph.add_node("judge", node_judge)
    graph.add_node("reformulate", node_reformulate)
    graph.add_node("answer", node_answer)
    graph.set_entry_point("retrieve")
    # Linear edges: retrieve → judge, reformulate → retrieve, answer → end
    graph.add_edge("retrieve", "judge")
    graph.add_edge("reformulate", "retrieve")
    graph.add_edge("answer", END)
    # Conditional edge from judge — uses should_continue to pick the next node.
    graph.add_conditional_edges("judge", should_continue, {
        "reformulate": "reformulate",
        "answer": "answer",
    })
    return graph.compile()


async def main() -> None:
    """Build the agent, demo it on an ambiguous query, eval against goldset."""
    require_env()
    check_openrouter()

    # ---- Load contextualized chunks (uses M3's cache) ----
    print("\n=== M5 — Load contextualized chunks ===")
    chunks = await build_or_load_ctx_chunks()
    ctx_nodes = chunks_to_nodes(chunks)
    print(f"  {len(ctx_nodes)} nodes")

    # ---- Build the same hybrid+rerank pipeline as M3/M4 ----
    print("\n=== M5 — Build hybrid+rerank pipeline ===")
    retriever, _engine = build_ctx_engine(ctx_nodes)

    from openai import OpenAI
    sync_client = OpenAI(base_url=OPENROUTER_BASE, api_key=os.environ["OPENROUTER_API_KEY"])

    # ---- Compile the LangGraph state machine ----
    print("\n=== M5 — Build LangGraph agent ===")
    agent = build_agent(retriever, sync_client)
    print("  agent compiled (max 3 iterations)")

    # ---- Demo on an ambiguous query ----
    # This question doesn't have a clean decomposition — the agent has to
    # try, judge, and possibly reformulate. Watch the iter trace: most
    # often the judge fires "NOT sufficient" once, the reformulator picks
    # a sharper query, and iter 2 succeeds.
    ambiguous_q = "How do I make sure my cluster keeps running smoothly when nodes fail?"
    print(f"\n=== M5 — Run agent on ambiguous query ===")
    print(f"Q: {ambiguous_q}\n")

    # `agent.invoke(initial_state)` runs the graph until it hits END.
    # We seed the state with empty chunks, iterations=0, no answer yet.
    result = agent.invoke({
        "query": ambiguous_q,
        "original_query": ambiguous_q,
        "chunks": [],
        "sufficient": False,
        "iterations": 0,
        "answer": "",
    })

    print(f"\n  iterations used: {result['iterations']}")
    print(f"\n=== Final answer ===")
    print(result["answer"])

    # ---- Eval against all 30 goldset questions ----
    # Note: the agent is overkill for most goldset questions (they're not
    # genuinely ambiguous). It will burn 3-10× the tokens of M2 for marginal
    # gains. We run it anyway so M5 lands on the scoreboard — and so the
    # learner can see for themselves why routing matters.
    def agent_query(q: str) -> dict:
        s = agent.invoke({
            "query": q, "original_query": q,
            "chunks": [], "sufficient": False, "iterations": 0, "answer": "",
        })
        return {"answer": s["answer"], "contexts": s["chunks"]}

    print("\n=== M5 — RAGAS eval (agent on all 30 questions) ===")
    print("(slow: 3-10× the tokens of M2 — this is exactly why you route)")
    await evaluate_async(agent_query, "M5_agentic")
    print_scoreboard()


if __name__ == "__main__":
    asyncio.run(main())
