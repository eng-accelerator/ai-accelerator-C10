"""The human gate through the HTTP API, with scripted models so no key is needed."""

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import InMemorySaver

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from orion_agent.graphs.orchestrator import build_orchestrator  # noqa: E402
from orion_agent.sandbox import LocalSandbox  # noqa: E402
from orion_agent.schemas import CodeResult, FileTask, Plan, ReviewResult  # noqa: E402
from orion_agent.workspace import Workspace  # noqa: E402

PLAN = Plan(summary="Add a subtitle", file_tasks=[FileTask(filepath="config.py", description="add SUBTITLE", action="modify")])
GOOD = CodeResult(filepath="config.py", code='PAGE_TITLE = "T"\nSUBTITLE = "S"\n', explanation="added")
OK = ReviewResult(approved=True, feedback="Looks good")


class Scripted:
    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.prompts = []

    def invoke(self, prompt, config=None):
        self.prompts.append(prompt)
        return self.outputs.pop(0) if len(self.outputs) > 1 else self.outputs[0]


def events(response) -> list[dict]:
    out = []
    for line in response.iter_lines():
        if line.startswith("data: "):
            out.append(json.loads(line[6:]))
    return out


@pytest.fixture
def client(tmp_path, monkeypatch):
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "config.py").write_text('PAGE_TITLE = "My ChatBot"\n')

    import agent.graph as graph_module
    import routers.agent as agent_router

    def fake_create(api_key: str, model: str):
        graph = build_orchestrator(Scripted(PLAN), Scripted(GOOD), Scripted(OK), Workspace(ws), LocalSandbox(), checkpointer=InMemorySaver())
        return graph, []

    monkeypatch.setattr(graph_module, "create_orchestrator", fake_create)
    monkeypatch.setattr(agent_router, "OPENROUTER_API_KEY", "server-key")
    agent_router.orchestrators.clear()
    from main import app

    return TestClient(app), ws


def run_to_pause(client, thread="T1"):
    with client.stream("POST", "/api/agent/run", json={"feature_request": "x", "thread_id": thread}) as r:
        return events(r)


def test_run_pauses_at_the_gate_with_a_diff(client):
    c, ws = client
    evs = run_to_pause(c)
    types = [e["type"] for e in evs]
    assert types[-2:] == ["approval_needed", "paused"], types
    gate = evs[-2]
    assert gate["status"] == "waiting_approval"
    assert "+SUBTITLE" in gate["changes"][0]["diff"]
    assert gate["changes"][0]["code"] == GOOD.code
    assert "SUBTITLE" not in (ws / "config.py").read_text()


def test_pending_endpoint_returns_the_gate_payload_until_resolved(client):
    c, ws = client
    run_to_pause(c)
    pending = c.get("/api/agent/pending/T1").json()
    assert pending["waiting"] is True and pending["review"]["changes"][0]["filepath"] == "config.py"
    with c.stream("POST", "/api/agent/approve", json={"thread_id": "T1", "decision": "approve"}) as r:
        evs = events(r)
    assert c.get("/api/agent/pending/T1").json()["waiting"] is False
    assert c.get("/api/agent/pending/never").json()["waiting"] is False


def test_approve_applies_without_a_spurious_waiting_status(client):
    c, ws = client
    run_to_pause(c)
    with c.stream("POST", "/api/agent/approve", json={"thread_id": "T1", "decision": "Approve"}) as r:
        evs = events(r)
    statuses = [e["status"] for e in evs if e["type"] == "status"]
    assert "waiting_approval" not in statuses
    assert statuses[-1] == "done"
    assert evs[-1]["type"] == "done"
    assert 'SUBTITLE = "S"' in (ws / "config.py").read_text()


def test_reject_pauses_again_and_ends_with_paused_not_done(client):
    c, ws = client
    run_to_pause(c)
    with c.stream("POST", "/api/agent/approve", json={"thread_id": "T1", "decision": "reject", "feedback": "call it TAGLINE"}) as r:
        evs = events(r)
    types = [e["type"] for e in evs]
    assert types[-2:] == ["approval_needed", "paused"]
    assert "done" not in types


def test_reject_without_a_reason_is_refused(client):
    c, _ = client
    run_to_pause(c)
    r = c.post("/api/agent/approve", json={"thread_id": "T1", "decision": "reject", "feedback": "  "})
    assert r.status_code == 422
    assert "reason" in r.json()["detail"]


def test_approve_on_a_finished_or_unknown_thread_explains_itself(client):
    c, _ = client
    run_to_pause(c)
    with c.stream("POST", "/api/agent/approve", json={"thread_id": "T1", "decision": "approve"}) as r:
        events(r)
    again = c.post("/api/agent/approve", json={"thread_id": "T1", "decision": "approve"})
    assert again.status_code == 409
    assert "not waiting" in again.json()["detail"]
    unknown = c.post("/api/agent/approve", json={"thread_id": "nope", "decision": "approve"})
    assert unknown.status_code == 404
    assert "Run the agent again" in unknown.json()["detail"]


def test_run_without_any_key_is_a_clear_error(client, monkeypatch):
    c, _ = client
    import routers.agent as agent_router

    monkeypatch.setattr(agent_router, "OPENROUTER_API_KEY", "")
    r = c.post("/api/agent/run", json={"feature_request": "x", "thread_id": "T2"})
    assert r.status_code == 401
    assert "OpenRouter" in r.json()["detail"]
