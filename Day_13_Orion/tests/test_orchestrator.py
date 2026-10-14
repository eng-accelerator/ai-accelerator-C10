import asyncio

from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from orion_agent.graphs.orchestrator import build_orchestrator, run_tests
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, FileTask, Plan, ReviewResult
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace
from tests.conftest import Scripted, ScriptedChatModel

PLAN = Plan(summary="Add a title constant", file_tasks=[FileTask(filepath="config.py", description="add SUBTITLE", action="modify")])
GOOD = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = "S"\n', explanation="added")
BROKEN = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = \n', explanation="typo")
OK = ReviewResult(approved=True, feedback="Looks good")
REJECT = ReviewResult(approved=False, feedback="name the constant DEFAULT_SUBTITLE")


def run(graph, request, config):
    return asyncio.run(graph.ainvoke({"feature_request": request}, config))


def resume(graph, decision, config):
    return asyncio.run(graph.ainvoke(Command(resume=decision), config))


def make(ws_dir, coder, reviewer, planner=None, **kw):
    return build_orchestrator(
        planner or Scripted(PLAN), coder, reviewer, Workspace(ws_dir), LocalSandbox(),
        checkpointer=InMemorySaver(), **kw,
    )


def test_run_tests_smoke_imports_when_no_tests(ws_dir):
    output, ok = run_tests(Workspace(ws_dir), LocalSandbox(), ["config.py"])
    assert ok and "config: OK" in output


def test_run_tests_uses_pytest_when_present(ws_dir):
    (ws_dir / "test_config.py").write_text("import config\n\ndef test_title():\n    assert config.PAGE_TITLE == 'WRONG'\n")
    output, ok = run_tests(Workspace(ws_dir), LocalSandbox(), ["config.py"])
    assert not ok and "assert" in output


def test_happy_path_pauses_then_applies(ws_dir):
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK))
    config = {"configurable": {"thread_id": "t1"}}
    paused = run(graph, "add a subtitle", config)
    payload = paused["__interrupt__"][0].value
    assert payload["changes"][0]["filepath"] == "config.py"
    assert "config: OK" in payload["test_output"]
    assert asyncio.run(graph.aget_state(config)).next == ("human_review",)
    assert 'SUBTITLE' not in (ws_dir / "config.py").read_text()

    final = resume(graph, {"decision": "approve", "feedback": ""}, config)
    assert final["status"] == "done"
    assert 'SUBTITLE = "S"' in (ws_dir / "config.py").read_text()


def test_reviewer_feedback_reaches_coder(ws_dir):
    coder = Scripted(GOOD, GOOD)
    graph = make(ws_dir, coder, Scripted(REJECT, OK))
    run(graph, "x", {"configurable": {"thread_id": "t2"}})
    assert "DEFAULT_SUBTITLE" in coder.prompts[1]
    assert "Reviewer feedback" in coder.prompts[1]


def test_failed_tests_route_back_to_coder_with_traceback(ws_dir):
    coder = Scripted(BROKEN, GOOD)
    graph = make(ws_dir, coder, Scripted(OK))
    run(graph, "x", {"configurable": {"thread_id": "t3"}})
    assert "SyntaxError" in coder.prompts[1]
    assert "Test output" in coder.prompts[1]


def test_failed_tests_at_the_cap_route_to_human_review(ws_dir):
    coder = Scripted(BROKEN)
    graph = make(ws_dir, coder, Scripted(OK), max_test_attempts=2)
    paused = run(graph, "x", {"configurable": {"thread_id": "t8"}})
    payload = paused["__interrupt__"][0].value
    assert "SyntaxError" in payload["test_output"]
    assert len(coder.prompts) == 2  # the cap stopped the retry loop
    assert payload["review_result"] == ""  # the AI reviewer never saw failing code


def test_escaping_filepath_is_rejected_at_plan_time(ws_dir, tmp_path):
    escape = Plan(summary="escape", file_tasks=[FileTask(filepath="../outside.py", description="x", action="create")])
    coder = Scripted(GOOD)
    result = run(make(ws_dir, coder, Scripted(OK), planner=Scripted(escape)), "x", {"configurable": {"thread_id": "t9"}})
    assert result["status"] == "path_rejected"
    assert "escapes the workspace" in result["error"]
    assert not coder.prompts  # the coder never ran
    assert not (tmp_path / "outside.py").exists()


def test_auto_approve_after_review_cap(ws_dir):
    reviewer = Scripted(REJECT)
    graph = make(ws_dir, Scripted(GOOD), reviewer, max_review_attempts=2)
    paused = run(graph, "x", {"configurable": {"thread_id": "t4"}})
    assert len(reviewer.prompts) == 2
    assert paused["__interrupt__"][0].value["review_result"].startswith("auto-approved after 2 rejections")


def test_human_reject_resets_counters_and_feeds_reason(ws_dir):
    coder = Scripted(GOOD, GOOD)
    reviewer = Scripted(REJECT, OK, OK)
    graph = make(ws_dir, coder, reviewer, max_review_attempts=2)
    config = {"configurable": {"thread_id": "t5"}}
    run(graph, "x", config)
    assert len(reviewer.prompts) == 2
    paused_again = resume(graph, {"decision": "reject", "feedback": "call it TAGLINE"}, config)
    assert "call it TAGLINE" in coder.prompts[-1]
    assert "Human feedback" in coder.prompts[-1]
    assert "Test output from the last run:" in coder.prompts[-1]  # the tests passed; nothing to fix
    assert "fix these failures" not in coder.prompts[-1]
    assert len(reviewer.prompts) == 3  # the AI reviewer is consulted again after a human reject
    state = asyncio.run(graph.aget_state(config)).values
    assert state["review_attempts"] == 1 and state["test_attempts"] == 1
    assert "__interrupt__" in paused_again


def test_planner_agent_research_feeds_context(ws_dir):
    model = ScriptedChatModel(responses=[
        AIMessage(content="", tool_calls=[{"name": "grep_files", "args": {"pattern": "PAGE_TITLE"}, "id": "c1", "type": "tool_call"}]),
        AIMessage(content="config.py holds the constants."),
    ])
    tools = make_tools(Workspace(ws_dir), LocalSandbox())
    research = build_tool_agent(model, [tools["grep_files"], tools["read_file"]])
    planner = Scripted(PLAN)
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK), planner=planner, planner_agent=research)
    run(graph, "x", {"configurable": {"thread_id": "t6"}})
    assert "config.py:1: PAGE_TITLE" in planner.prompts[0]
    assert "config.py holds the constants." in planner.prompts[0]


def test_rules_are_loaded_per_file(ws_dir, tmp_path):
    root = tmp_path / "repo"
    (root / ".cursor" / "rules").mkdir(parents=True)
    (root / ".cursor" / "rules" / "py.mdc").write_text("---\nglobs: **/*.py\n---\nNO SEMICOLONS\n")
    coder = Scripted(GOOD)
    graph = make(ws_dir, coder, Scripted(OK), rules_root=root)
    run(graph, "x", {"configurable": {"thread_id": "t7"}})
    assert "NO SEMICOLONS" in coder.prompts[0]


# --- the human gate: decisions and the payload it hands to the person -----------------------

from orion_agent.graphs.orchestrator import normalize_decision, review_payload


def test_normalize_decision_accepts_common_spellings():
    assert normalize_decision("approve") == ("approve", "")
    assert normalize_decision("Approve") == ("approve", "")
    assert normalize_decision(" APPROVED ") == ("approve", "")
    assert normalize_decision("yes") == ("approve", "")
    assert normalize_decision(True) == ("approve", "")
    assert normalize_decision({"decision": "Approve", "feedback": ""}) == ("approve", "")
    assert normalize_decision("reject") == ("reject", "")
    assert normalize_decision("no") == ("reject", "")
    assert normalize_decision(False) == ("reject", "")
    assert normalize_decision({"decision": "reject", "feedback": "rename it"}) == ("reject", "rename it")


def test_normalize_decision_treats_free_text_as_a_reject_with_that_reason():
    assert normalize_decision("call it TAGLINE instead") == ("reject", "call it TAGLINE instead")
    assert normalize_decision({"decision": "revise", "feedback": "shorter"}) == ("reject", "shorter")
    assert normalize_decision({"feedback": "shorter"}) == ("reject", "shorter")
    assert normalize_decision(None) == ("reject", "")


def test_capitalised_approve_applies_the_change(ws_dir):
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK))
    config = {"configurable": {"thread_id": "t10"}}
    run(graph, "x", config)
    final = resume(graph, "Approve", config)
    assert final["status"] == "done"
    assert 'SUBTITLE = "S"' in (ws_dir / "config.py").read_text()


def test_review_payload_carries_full_code_and_a_diff(ws_dir):
    state = {
        "plan": "p",
        "generated_code": [
            {"filepath": "config.py", "code": 'PAGE_TITLE = "T"\nSUBTITLE = "S"\n', "explanation": "added"},
            {"filepath": "new_module.py", "code": "X = 1\n", "explanation": "new"},
        ],
        "test_output": "ok",
        "review_result": "fine",
    }
    payload = review_payload(state, Workspace(ws_dir))
    first, second = payload["changes"]
    assert first["code"].endswith('SUBTITLE = "S"\n')
    assert first["preview"] == first["code"][:500]
    assert first["action"] == "modify"
    assert "-PAGE_TITLE = \"My ChatBot\"" in first["diff"]
    assert "+SUBTITLE = \"S\"" in first["diff"]
    assert second["action"] == "create"
    assert "+X = 1" in second["diff"]


def test_interrupt_payload_includes_diff(ws_dir):
    graph = make(ws_dir, Scripted(GOOD), Scripted(OK))
    paused = run(graph, "x", {"configurable": {"thread_id": "t11"}})
    change = paused["__interrupt__"][0].value["changes"][0]
    assert "+SUBTITLE" in change["diff"]
    assert change["code"] == GOOD.code


def test_coder_prompt_asks_to_preserve_untouched_lines(ws_dir):
    from orion_agent.graphs.orchestrator import build_code_prompt

    prompt = build_code_prompt({"codebase_context": "x"}, {"filepath": "config.py", "action": "modify", "description": "add SUBTITLE"})
    assert "Reproduce every other line exactly" in prompt
    assert "emoji" in prompt
