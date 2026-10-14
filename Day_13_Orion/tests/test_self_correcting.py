# tests/test_self_correcting.py
from orion_agent.graphs.self_correcting import build_bugbot, build_full_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeOutput, ReviewResult
from tests.conftest import Scripted

BAD = CodeOutput(code="print(1/0)", explanation="wrong")
GOOD = CodeOutput(code="print('ok')", explanation="right")


def test_bugbot_retries_once_then_succeeds():
    coder = Scripted(BAD, GOOD)
    result = build_bugbot(coder, LocalSandbox()).invoke({"task": "print ok", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "success"
    assert result["attempts"] == 2
    assert "ZeroDivisionError" in coder.prompts[1]


def test_bugbot_gives_up_at_max_attempts():
    coder = Scripted(BAD)
    result = build_bugbot(coder, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 2})
    assert result["status"] == "failed"
    assert result["attempts"] == 2
    assert len(coder.prompts) == 2


def test_bugbot_treats_timeout_as_failure():
    coder = Scripted(CodeOutput(code="import time; time.sleep(5)", explanation="slow"), GOOD)
    result = build_bugbot(coder, LocalSandbox(), timeout=1).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "success"
    assert "Timed out" in coder.prompts[1]


def test_rules_are_injected():
    coder = Scripted(GOOD)
    build_bugbot(coder, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 1, "rules": "USE TYPE HINTS"})
    assert coder.prompts[0].startswith("Follow these rules:\nUSE TYPE HINTS")


def test_full_agent_uses_reviewer_feedback():
    coder = Scripted(GOOD, GOOD)
    reviewer = Scripted(ReviewResult(approved=False, feedback="add docstrings"), ReviewResult(approved=True, feedback="Looks good"))
    result = build_full_agent(coder, reviewer, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "approved"
    assert result["attempts"] == 2
    assert "add docstrings" in coder.prompts[1]
    assert "print('ok')" in reviewer.prompts[0]


def test_full_agent_reviews_only_after_execution_passes():
    coder = Scripted(BAD, GOOD)
    reviewer = Scripted(ReviewResult(approved=True, feedback="ok"))
    result = build_full_agent(coder, reviewer, LocalSandbox()).invoke({"task": "x", "attempts": 0, "max_attempts": 3})
    assert result["status"] == "approved"
    assert len(reviewer.prompts) == 1
