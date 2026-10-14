"""Lesson 3: plan, code, test, AI review, human review, apply, verify.

This is the finished Orion agent. Read it top to bottom once, then keep the
drawing in docs/ARCHITECTURE.md next to you:

    START -> plan -> code -> test -> ai_review -> human_review -> apply -> verify -> END

Every arrow that is not straight is a *conditional edge*: a small function
that looks at the state and picks the next node. The routes are:

- after `plan`:         a planned path that escapes the workspace ends the run
- after `test`:         passed -> ai_review; failed with attempts left -> code;
                        failed at the cap -> human_review (so a person sees the failures)
- after `ai_review`:    approved -> human_review; rejected -> code (auto-approve after two rejections)
- after `human_review`: approve -> apply; reject (with a reason) -> code, both counters reset

Tests are the primary check. The AI reviewer sees the code and the test
output with fresh context and gives a second opinion. The human sees both
and decides. A reject carries a reason back to the coder and resets the
counters so the reviewer is consulted again.

The human gate is `interrupt()` in `human_review_node`. It freezes the graph
(the checkpointer has saved the state) and hands the caller a payload built
by `review_payload`: the plan, every file in full, a unified diff against
what is on disk, the test output, and the reviewer's verdict. The caller
resumes with `Command(resume=...)`; `normalize_decision` turns whatever
they sent into ("approve", "") or ("reject", reason).
"""

from __future__ import annotations

import difflib
import shutil
import sys
from pathlib import Path
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import interrupt

from orion_agent.rules import load_rules
from orion_agent.sandbox import Sandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.search import repo_map
from orion_agent.workspace import Workspace, WorkspaceError


class OrchestratorState(TypedDict, total=False):
    """Everything the plan-code-test-review-apply run carries between nodes."""

    feature_request: str
    codebase_context: str
    plan: str
    file_tasks: list[dict]
    generated_code: list[dict]
    test_output: str
    test_attempts: int
    review_result: str
    review_attempts: int
    human_decision: str
    human_feedback: str
    status: str
    error: str


RESEARCH_PROMPT = (
    "You are researching a codebase before a change is planned. Use the tools to find every file "
    "and symbol relevant to this request, read them, and finish with a short summary of what you found.\n\n"
    "Request: {request}"
)

PLAN_PROMPT = (
    "Create an implementation plan for this feature request. List every file to create or modify.\n\n"
    "Request: {request}\n\nCodebase context:\n{context}"
)


def check_task_paths(ws: Workspace, file_tasks: list[dict]) -> list[str]:
    """Return one message per planned filepath that the workspace would refuse to write."""
    problems = []
    for task in file_tasks:
        filepath = task.get("filepath") or ""
        if not filepath:
            problems.append("a file task has no filepath")
            continue
        try:
            full = ws.resolve(filepath)
        except WorkspaceError as exc:
            problems.append(str(exc))
            continue
        if full.is_dir():
            problems.append(f"filepath is a directory: {filepath}")
    return problems


def build_code_prompt(state: dict, task: dict, rules_root: str | Path | None = None) -> str:
    """Build the coder prompt for one file task, folding in rules and the latest feedback."""
    parts = [
        "Generate the complete Python code for this file.\n\n"
        f"File: {task['filepath']}\nAction: {task['action']}\nDescription: {task['description']}\n\n"
        "Change only what the description asks for. Reproduce every other line exactly as it is, "
        "including non-ASCII characters such as emoji; never replace them with escape sequences."
    ]
    if rules_root:
        rules = load_rules(rules_root, task["filepath"])
        if rules:
            parts.append(f"Follow these rules:\n{rules}")
    parts.append(f"Codebase context:\n{state.get('codebase_context', '')}")
    if state.get("test_output") and state.get("status") in ("tests_failed", "human_rejected"):
        # After a human reject the tests may well have passed, so only the failure path says "fix".
        label = "Test output from the last run"
        if state["status"] == "tests_failed":
            label += " (fix these failures)"
        parts.append(f"{label}:\n{state['test_output']}")
    if state.get("status") == "needs_revision" and state.get("review_result"):
        parts.append(f"Reviewer feedback (address every point):\n{state['review_result']}")
    if state.get("human_feedback"):
        parts.append(f"Human feedback (this overrides everything else):\n{state['human_feedback']}")
    return "\n\n".join(parts)


def build_review_prompt(state: dict) -> str:
    """Build the reviewer prompt: the generated files and the test output, with no history."""
    files = "\n\n".join(f"### {g['filepath']}\n{g['code']}" for g in state.get("generated_code", []))
    return (
        "You are a code reviewer with no memory of how this code was written. Judge only what is in front of you.\n"
        f"Feature request: {state.get('feature_request', '')}\n\nFiles:\n{files}\n\n"
        f"Test output:\n{state.get('test_output', '')}\n\n"
        "Approve only if the code is correct, complete, and follows PEP 8 with type hints and docstrings."
    )


_APPROVE_WORDS = {"approve", "approved", "accept", "accepted", "yes", "y", "ok", "okay", "apply", "true"}
_REJECT_WORDS = {"reject", "rejected", "no", "n", "revise", "redo", "false"}


def normalize_decision(decision) -> tuple[str, str]:
    """Turn whatever the human sent back into ("approve", "") or ("reject", reason).

    Accepted shapes, so a learner cannot get stuck on spelling:

    - a dict: {"decision": "approve" | "reject", "feedback": "..."}
    - a bare string: "approve", "yes", "ok", "reject", "no"; any other text is a reject
      with that text as the reason
    - a bool: True approves, False rejects
    - None or an empty value: reject with no reason
    """
    feedback = ""
    if isinstance(decision, dict):
        feedback = str(decision.get("feedback") or "").strip()
        decision = decision.get("decision", "")
    if isinstance(decision, bool):
        return ("approve", "") if decision else ("reject", feedback)
    text = str(decision or "").strip()
    word = text.lower().rstrip(".!")
    if word in _APPROVE_WORDS:
        return "approve", ""
    if word in _REJECT_WORDS or not word:
        return "reject", feedback
    # Free text such as "call it TAGLINE" reads as a reject with that reason.
    return "reject", feedback or text


def unified_diff(before: str, after: str, filepath: str) -> str:
    """Render a unified diff between what is on disk and what the agent proposes."""
    lines = difflib.unified_diff(
        before.splitlines(keepends=True),
        after.splitlines(keepends=True),
        fromfile=f"a/{filepath}",
        tofile=f"b/{filepath}",
    )
    return "".join(lines)


def review_payload(state: dict, ws: Workspace, preview_chars: int = 500) -> dict:
    """Build what the human sees at the gate: plan, files in full, diffs, tests, AI review."""
    changes = []
    for item in state.get("generated_code", []):
        filepath = item["filepath"]
        try:
            before = ws.read(filepath)
            action = "modify"
        except (FileNotFoundError, WorkspaceError, OSError, UnicodeError):
            before = ""
            action = "create"
        changes.append(
            {
                "filepath": filepath,
                "action": action,
                "explanation": item.get("explanation", ""),
                "code": item["code"],
                "preview": item["code"][:preview_chars],
                "diff": unified_diff(before, item["code"], filepath),
            }
        )
    return {
        "plan": state.get("plan", ""),
        "changes": changes,
        "test_output": state.get("test_output", ""),
        "review_result": state.get("review_result", ""),
    }


def run_tests(ws: Workspace, sandbox: Sandbox, changed: list[str]) -> tuple[str, bool]:
    """Run the workspace's pytest suite, or smoke-import the changed files, and say whether it passed."""
    test_files = sorted(set(ws.glob("**/test_*.py")) | set(ws.glob("tests/**/*.py")))
    if test_files:
        r = sandbox.run([sys.executable, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider"], cwd=ws.root, timeout=120)
        return r.summary(), r.ok
    lines = []
    ok = True
    for path in changed:
        if not path.endswith(".py"):
            continue
        module = Path(path).with_suffix("").as_posix().replace("/", ".")
        r = sandbox.run_python(f"import {module}", cwd=ws.root)
        ok = ok and r.ok
        lines.append(f"Smoke import {module}: {'OK' if r.ok else 'FAILED'}" + ("" if r.ok else f"\n{r.stderr.rstrip()}"))
    return "\n".join(lines) if lines else "No Python files changed; nothing to test.", ok


def build_orchestrator(
    planner,
    coder,
    reviewer,
    ws: Workspace,
    sandbox: Sandbox,
    *,
    planner_agent=None,
    rules_root: str | Path | None = None,
    checkpointer=None,
    max_test_attempts: int = 3,
    max_review_attempts: int = 2,
) -> CompiledStateGraph:
    """Compile the full orchestrator: plan, code, test, AI review, human gate, apply, verify."""

    async def plan_node(state: OrchestratorState) -> dict:
        request = state["feature_request"]
        context = repo_map(ws)
        if planner_agent is not None:
            research = await planner_agent.ainvoke({"messages": [HumanMessage(content=RESEARCH_PROMPT.format(request=request))]})
            notes = [str(m.content) for m in research["messages"] if isinstance(m, ToolMessage)]
            summary = str(research["messages"][-1].content)
            context = "\n\n".join([context, *notes, f"Research summary:\n{summary}"])
        plan: Plan = planner.invoke(PLAN_PROMPT.format(request=request, context=context))
        file_tasks = [t.model_dump() for t in plan.file_tasks]
        problems = check_task_paths(ws, file_tasks)
        return {
            "codebase_context": context,
            "plan": plan.summary,
            "file_tasks": file_tasks,
            "status": "path_rejected" if problems else "planned",
            "error": "\n".join(problems),
            "test_attempts": 0,
            "review_attempts": 0,
            "human_feedback": "",
        }

    def route_after_plan(state: OrchestratorState) -> Literal["code", "__end__"]:
        return END if state["status"] == "path_rejected" else "code"

    def code_node(state: OrchestratorState) -> dict:
        generated = []
        for task in state["file_tasks"]:
            result: CodeResult = coder.invoke(build_code_prompt(state, task, rules_root))
            generated.append({"filepath": task["filepath"], "code": result.code, "explanation": result.explanation})
        return {"generated_code": generated, "status": "coded"}

    def test_node(state: OrchestratorState) -> dict:
        snapshot = ws.snapshot()
        try:
            scratch = Workspace(snapshot)
            for item in state["generated_code"]:
                scratch.write(item["filepath"], item["code"])
            output, ok = run_tests(scratch, sandbox, [i["filepath"] for i in state["generated_code"]])
        except (WorkspaceError, OSError) as exc:
            return {"error": str(exc), "status": "path_rejected"}
        finally:
            shutil.rmtree(snapshot, ignore_errors=True)
        return {
            "test_output": output,
            "test_attempts": state.get("test_attempts", 0) + 1,
            "status": "tests_passed" if ok else "tests_failed",
        }

    def route_after_test(state: OrchestratorState) -> Literal["ai_review", "code", "human_review", "__end__"]:
        if state["status"] == "path_rejected":
            return END
        if state["status"] == "tests_passed":
            return "ai_review"
        if state["test_attempts"] < max_test_attempts:
            return "code"
        return "human_review"

    def ai_review_node(state: OrchestratorState) -> dict:
        attempts = state.get("review_attempts", 0) + 1
        review: ReviewResult = reviewer.invoke(build_review_prompt(state))
        if review.approved:
            return {"review_result": review.feedback, "review_attempts": attempts, "status": "approved"}
        if attempts >= max_review_attempts:
            return {
                "review_result": f"auto-approved after {max_review_attempts} rejections. Last feedback: {review.feedback}",
                "review_attempts": attempts,
                "status": "approved",
            }
        return {"review_result": review.feedback, "review_attempts": attempts, "status": "needs_revision"}

    def route_after_review(state: OrchestratorState) -> Literal["human_review", "code"]:
        return "human_review" if state["status"] == "approved" else "code"

    def human_review_node(state: OrchestratorState) -> dict:
        # interrupt() stops the run here. The state is already checkpointed, so the
        # caller can come back minutes later with Command(resume=...) and this node
        # runs again from the top with `decision` filled in.
        decision, feedback = normalize_decision(interrupt(review_payload(state, ws)))
        if decision == "approve":
            return {"human_decision": "approve", "human_feedback": "", "status": "human_approved"}
        return {
            "human_decision": "reject",
            "human_feedback": feedback,
            "review_attempts": 0,
            "test_attempts": 0,
            "status": "human_rejected",
        }

    def route_after_human(state: OrchestratorState) -> Literal["apply", "code"]:
        return "apply" if state["human_decision"] == "approve" else "code"

    def apply_node(state: OrchestratorState) -> dict:
        for item in state["generated_code"]:
            try:
                ws.write(item["filepath"], item["code"])
            except (WorkspaceError, OSError) as exc:
                return {"error": str(exc), "status": "apply_failed"}
        return {"status": "applied"}

    def verify_node(state: OrchestratorState) -> dict:
        if state["status"] == "apply_failed":
            return {}
        output, ok = run_tests(ws, sandbox, [i["filepath"] for i in state["generated_code"]])
        return {"test_output": output, "status": "done" if ok else "verify_failed"}

    graph = StateGraph(OrchestratorState)
    graph.add_node("plan", plan_node)
    graph.add_node("code", code_node)
    graph.add_node("test", test_node)
    graph.add_node("ai_review", ai_review_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("apply", apply_node)
    graph.add_node("verify", verify_node)
    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", route_after_plan, {"code": "code", END: END})
    graph.add_edge("code", "test")
    graph.add_conditional_edges("test", route_after_test, {"ai_review": "ai_review", "code": "code", "human_review": "human_review", END: END})
    graph.add_conditional_edges("ai_review", route_after_review, {"human_review": "human_review", "code": "code"})
    graph.add_conditional_edges("human_review", route_after_human, {"apply": "apply", "code": "code"})
    graph.add_edge("apply", "verify")
    graph.add_edge("verify", END)
    return graph.compile(checkpointer=checkpointer)
