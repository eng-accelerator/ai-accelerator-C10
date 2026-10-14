"""Bring-your-own-key endpoints and the workspace reset."""

import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture
def client(monkeypatch):
    import routers.key as key_router

    monkeypatch.setattr(key_router, "OPENROUTER_API_KEY", "")
    from main import app

    return TestClient(app), key_router


def test_key_status_says_whether_the_server_has_a_key(client, monkeypatch):
    c, key_router = client
    assert c.get("/api/key/status").json() == {"server_key": False, "server_key_valid": None}
    monkeypatch.setattr(key_router, "OPENROUTER_API_KEY", "sk-or-server")
    assert c.get("/api/key/status").json()["server_key"] is True


def test_key_check_validates_against_openrouter_without_echoing_the_key(client, monkeypatch):
    c, key_router = client

    def handler(request):
        if request.headers["Authorization"] == "Bearer sk-or-good":
            return httpx.Response(200, json={"data": {"label": "learner", "usage": 0.25, "limit": 5.0}})
        return httpx.Response(401, json={"error": {"message": "User not found."}})

    monkeypatch.setattr(key_router, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    good = c.post("/api/key/check", json={"api_key": "sk-or-good"}).json()
    assert good["ok"] is True and good["label"] == "learner" and "sk-or-good" not in str(good)
    bad = c.post("/api/key/check", json={"api_key": "sk-or-bad"}).json()
    assert bad["ok"] is False and "not valid" in bad["message"]
    assert c.post("/api/key/check", json={"api_key": ""}).json()["ok"] is False


def test_workspace_reset_restores_the_sample_project(tmp_path, monkeypatch):
    sample = tmp_path / "sample_project"
    sample.mkdir()
    (sample / "config.py").write_text("X = 1\n")
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "config.py").write_text("X = 999\n")
    (ws / "junk.py").write_text("junk")

    import routers.workspace as ws_router

    monkeypatch.setattr(ws_router, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(ws_router, "WORKSPACE_PATH", str(ws))
    from main import app

    r = TestClient(app).post("/api/workspace/reset")
    assert r.status_code == 200
    assert r.json()["files"] == ["config.py"]
    assert (ws / "config.py").read_text() == "X = 1\n"
