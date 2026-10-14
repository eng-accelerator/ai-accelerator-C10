"""Lesson 2: generate, execute, retry on error; then add a reviewer.

For learners: two graphs that share their nodes.

`build_bugbot`:     START -> generate -> execute -> (ok? END : attempts left? generate : END)
`build_full_agent`: the same, plus a `review` node after a clean run, whose
                    feedback goes back into the generate prompt exactly the way
                    the error did.

The whole mechanism is one line in `_generate_prompt`: if the state carries an
error (or a rejection), it is appended to the prompt of the node that acts.
Attempts are counted once for the whole system, not per node, and capped,
because a model that cannot fix something in three tries needs a person, not a
fourth try.
"""

from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from orion_agent.sandbox import Sandbox
from orion_agent.schemas import CodeOutput, ReviewResult


class AgentState(TypedDict, total=False):
    """What the generate-execute-retry loop carries between nodes."""

    task: str
    code: str
    explanation: str
    execution_result: str
    error: str
    attempts: int
    max_attempts: int
    status: str
    rules: str


class FullAgentState(AgentState, total=False):
    """AgentState plus the reviewer's verdict."""

    review_feedback: str
    approved: bool


def _generate_prompt(state: dict) -> str:
    prompt = f"Write Python code for: {state['task']}"
    if state.get("rules"):
        prompt = f"Follow these rules:\n{state['rules']}\n\n{prompt}"
    if state.get("error"):
        prompt += f"\n\nThe previous attempt failed with this error. Fix it:\n{state['error']}"
    if state.get("review_feedback") and not state.get("approved", True):
        prompt += f"\n\nThe reviewer rejected the previous version. Address this feedback:\n{state['review_feedback']}"
    return prompt


def _make_nodes(coder, sandbox: Sandbox, timeout: float):
    def generate(state: dict) -> dict:
        out: CodeOutput = coder.invoke(_generate_prompt(state))
        return {"code": out.code, "explanation": out.explanation, "attempts": state.get("attempts", 0) + 1}

    def execute(state: AgentState) -> dict:
        r = sandbox.run_python(state["code"], timeout=timeout)
        if r.ok:
            return {"execution_result": r.stdout, "error": "", "status": "success"}
        return {"execution_result": r.stdout, "error": r.stderr, "status": "failed"}

    def should_retry(state: AgentState) -> Literal["success", "retry", "give_up"]:
        if state["status"] == "success":
            return "success"
        if state["attempts"] < state.get("max_attempts", 3):
            return "retry"
        return "give_up"

    return generate, execute, should_retry


def build_bugbot(coder, sandbox: Sandbox, timeout: float = 10) -> CompiledStateGraph:
    """Compile the loop that writes code, runs it, and retries on the error it printed."""
    generate, execute, should_retry = _make_nodes(coder, sandbox, timeout)
    graph = StateGraph(AgentState)
    graph.add_node("generate", generate)
    graph.add_node("execute", execute)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "execute")
    graph.add_conditional_edges("execute", should_retry, {"success": END, "retry": "generate", "give_up": END})
    return graph.compile()


def build_full_agent(coder, reviewer, sandbox: Sandbox, timeout: float = 10) -> CompiledStateGraph:
    """Compile the bugbot loop with an AI reviewer between a clean run and the end."""
    generate, execute, should_retry = _make_nodes(coder, sandbox, timeout)

    def review(state: FullAgentState) -> dict:
        r: ReviewResult = reviewer.invoke(
            "Review this Python code for correctness, readability, type hints, docstrings, and PEP 8.\n"
            f"Task: {state['task']}\n\nCode:\n{state['code']}\n\nOutput when run:\n{state.get('execution_result', '')}"
        )
        return {"approved": r.approved, "review_feedback": r.feedback, "status": "approved" if r.approved else "needs_revision"}

    def after_review(state: FullAgentState) -> Literal["done", "revise", "give_up"]:
        if state["approved"]:
            return "done"
        if state["attempts"] < state.get("max_attempts", 3):
            return "revise"
        return "give_up"

    graph = StateGraph(FullAgentState)
    graph.add_node("generate", generate)
    graph.add_node("execute", execute)
    graph.add_node("review", review)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "execute")
    graph.add_conditional_edges("execute", should_retry, {"success": "review", "retry": "generate", "give_up": END})
    graph.add_conditional_edges("review", after_review, {"done": END, "revise": "generate", "give_up": END})
    return graph.compile()
