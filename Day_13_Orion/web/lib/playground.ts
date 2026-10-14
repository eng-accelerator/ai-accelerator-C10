import type { ChapterDef } from "./schema";

export const playground: ChapterDef = {
  slug: "playground",
  number: 19,
  lesson: "Lesson 3",
  subtopicLabel: "Production Playground",
  title: "Orion Playground",
  subtitle: "Experience the production coding agent in one complete editor.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Tool Use", "Self-Correction", "Reflection", "Human-in-the-Loop", "Multi-Agent"],
  intro:
    "This is the end product: an agent that researches the codebase, plans, generates every file, runs the tests, asks a reviewer, and waits for you before it writes to disk. The code on the left is the graph as it ships.",
  takeaway:
    "The complete agent combines specialist nodes, tool execution, review loops, and checkpointed human approval so users can inspect and guide the system before changes are applied.",
  demos: [],
  codeContent: `def build_orchestrator(
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
            context = "\\n\\n".join([context, *notes, f"Research summary:\\n{summary}"])
        plan: Plan = planner.invoke(PLAN_PROMPT.format(request=request, context=context))
        file_tasks = [t.model_dump() for t in plan.file_tasks]
        problems = check_task_paths(ws, file_tasks)
        return {
            "codebase_context": context,
            "plan": plan.summary,
            "file_tasks": file_tasks,
            "status": "path_rejected" if problems else "planned",
            "error": "\\n".join(problems),
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
        payload = {
            "plan": state.get("plan", ""),
            "changes": [
                {"filepath": g["filepath"], "explanation": g["explanation"], "preview": g["code"][:500]}
                for g in state.get("generated_code", [])
            ],
            "test_output": state.get("test_output", ""),
            "review_result": state.get("review_result", ""),
        }
        decision = interrupt(payload)
        if isinstance(decision, str):
            decision = {"decision": decision, "feedback": ""}
        if decision.get("decision") == "approve":
            return {"human_decision": "approve", "status": "human_approved"}
        return {
            "human_decision": "reject",
            "human_feedback": decision.get("feedback", ""),
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
`,
  codeFilename: "orchestrator.py",
  backendCode: `graph = StateGraph(AgentState)

graph.add_node("planner", planner)
graph.add_node("coder", coder)
graph.add_node("executor", executor)
graph.add_node("reviewer", reviewer)
graph.add_node("human_gate", human_gate)
graph.add_node("apply", apply_changes)

graph.add_edge(START, "planner")
graph.add_edge("planner", "coder")
graph.add_edge("coder", "executor")

graph.add_conditional_edges(
    "executor",
    lambda state: "reviewer" if state["status"] == "executed" else "coder",
    {"reviewer": "reviewer", "coder": "coder"},
)

graph.add_conditional_edges(
    "reviewer",
    lambda state: "human_gate" if state["status"] == "approved" else "coder",
    {"human_gate": "human_gate", "coder": "coder"},
)

graph.add_edge("human_gate", "apply")
graph.add_edge("apply", END)

agent = graph.compile(checkpointer=memory)`,
  backendFilename: "agent_graph.py",
  chatConfig: {
    mode: "multi-agent-pipeline",
    defaultPrompt: "Build a small FastAPI endpoint with request validation, logging, and tests.",
    graphVisualization: true,
    graphNodes: [
      { id: "planner", label: "Planner" },
      { id: "coder", label: "Coder" },
      { id: "executor", label: "Executor" },
      { id: "reviewer", label: "Reviewer" },
      { id: "human_gate", label: "Human Gate" },
      { id: "apply", label: "Apply" },
    ],
    graphEdges: [
      { from: "planner", to: "coder", label: "file tasks" },
      { from: "coder", to: "executor", label: "generated code" },
      { from: "executor", to: "reviewer", label: "tests passed" },
      { from: "executor", to: "coder", label: "fix failure", style: "dashed" },
      { from: "reviewer", to: "human_gate", label: "approved" },
      { from: "reviewer", to: "coder", label: "revise", style: "dashed" },
      { from: "human_gate", to: "apply", label: "approved" },
    ],
    conversations: {
      default: [
        {
          role: "tool",
          toolName: "planner",
          toolArgs: { feature: "FastAPI endpoint" },
          content: `Plan:
- Add a FastAPI app with a typed request model
- Validate name and priority fields before creating a task
- Log accepted tasks for operator visibility
- Return a stable JSON response that downstream clients can rely on`,
        },
        {
          role: "tool",
          toolName: "coder",
          toolArgs: { files: "api_server.py" },
          content: `Generated api_server.py with:
- TaskRequest Pydantic model
- /tasks POST endpoint
- structured logging
- deterministic task response`,
        },
        {
          role: "tool",
          toolName: "executor",
          toolArgs: { status: "SUCCESS" },
          content: `uvicorn import check passed
POST /tasks with valid payload returned 200
POST /tasks with missing name returned 422`,
        },
        {
          role: "tool",
          toolName: "reviewer",
          toolArgs: { approved: "true" },
          content: `Review approved. The endpoint is small, typed, testable, and uses framework-native validation instead of custom parsing.`,
        },
        {
          role: "tool",
          toolName: "human_gate",
          toolArgs: { status: "pending" },
          content: "Paused for human approval before applying the generated file to the workspace.",
        },
        {
          role: "assistant",
          content: `**Production agent run complete**

The planner, coder, executor, and reviewer all completed successfully. I generated \`api_server.py\`, validated it in the sandbox, and paused at the human gate so the final change can be reviewed before applying.`,
          renderAs: "markdown",
        },
      ],
    },
    generatedFile: {
      filename: "api_server.py",
      content: `import logging
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orion.api")

app = FastAPI(title="Orion Task API")


class TaskRequest(BaseModel):
    name: str = Field(min_length=1)
    priority: Literal["low", "medium", "high"] = "medium"


@app.post("/tasks")
def create_task(task: TaskRequest) -> dict[str, str]:
    logger.info("creating task: %s priority=%s", task.name, task.priority)
    return {
        "status": "queued",
        "name": task.name,
        "priority": task.priority,
    }
`,
    },
    terminalLogs: {
      default: [
        { tag: "PROCESS", text: "[agent] received feature request" },
        { tag: "TOOL", text: "search_codebase('FastAPI endpoint validation logging tests')" },
        { tag: "OK", text: "planner produced 1 implementation task" },
        { tag: "TOOL", text: "write generated/api_server.py" },
        { tag: "PROCESS", text: "sandbox: python -m compileall generated/api_server.py" },
        { tag: "OK", text: "sandbox checks passed" },
        { tag: "PROCESS", text: "reviewer evaluating generated file" },
        { tag: "SUCCESS", text: "approved; waiting at human gate" },
      ],
    },
    graphRunSteps: {
      default: [
        {
          node: "planner",
          title: "Plan feature",
          detail: "Found relevant app patterns and created one file task.",
          status: "success",
        },
        {
          node: "coder",
          title: "Generate code",
          detail: "Created api_server.py with typed validation and logging.",
          status: "success",
        },
        {
          node: "executor",
          title: "Run sandbox",
          detail: "Compile and endpoint validation checks passed.",
          status: "success",
        },
        {
          node: "reviewer",
          title: "Review changes",
          detail: "Approved maintainability, framework fit, and response shape.",
          status: "success",
        },
        {
          node: "human_gate",
          title: "Await approval",
          detail: "Paused before applying generated changes to the workspace.",
          status: "warning",
        },
      ],
    },
  },
};
