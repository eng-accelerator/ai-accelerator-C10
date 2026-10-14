# orion-ide/backend/tests/test_rules_skills.py
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


@pytest.fixture
def client(tmp_path, monkeypatch):
    (tmp_path / "AGENTS.md").write_text("# Repo rules\nUse uv.\n")
    rules = tmp_path / ".cursor" / "rules"
    rules.mkdir(parents=True)
    (rules / "python.mdc").write_text("---\ndescription: Python style\nglobs: **/*.py\nalwaysApply: false\n---\nType hints.\n")
    skill = tmp_path / ".cursor" / "skills" / "web-research"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: web-research\ndescription: Search then fetch.\n---\n# Web research\n1. Search.\n")

    import routers.rules as rules_router
    import routers.skills as skills_router

    monkeypatch.setattr(rules_router, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(skills_router, "REPO_ROOT", tmp_path)
    app = FastAPI()
    app.include_router(rules_router.router, prefix="/api")
    app.include_router(skills_router.router, prefix="/api")
    return TestClient(app)


def test_list_rules_includes_agents_and_mdc(client):
    names = {r["name"]: r for r in client.get("/api/rules").json()}
    assert names["AGENTS"]["source"] == "AGENTS.md"
    assert names["python"]["globs"] == ["**/*.py"]


def test_get_and_put_rule_round_trip(client):
    assert "Type hints." in client.get("/api/rules/python").json()["content"]
    assert client.put("/api/rules/python", json={"content": "---\ndescription: d\nglobs: **/*.py\n---\nNo semicolons.\n"}).status_code == 200
    assert "No semicolons." in client.get("/api/rules/python").json()["content"]


def test_unknown_rule_is_404(client):
    assert client.get("/api/rules/nope").status_code == 404


def test_rule_name_cannot_escape(client):
    assert client.put("/api/rules/../../evil", json={"content": "x"}).status_code in (404, 422)


def test_list_and_read_skills(client):
    skills = client.get("/api/skills").json()
    assert skills[0]["name"] == "web-research"
    assert "# Web research" in client.get("/api/skills/web-research").json()["content"]


def test_create_skill_scaffolds_frontmatter(client, tmp_path):
    r = client.post("/api/skills", json={"name": "deploy-app", "description": "Deploy to staging."})
    assert r.status_code == 201
    text = (tmp_path / ".cursor" / "skills" / "deploy-app" / "SKILL.md").read_text()
    assert text.startswith("---\nname: deploy-app\ndescription: Deploy to staging.\n---\n")
    assert client.post("/api/skills", json={"name": "Bad Name", "description": "x"}).status_code == 422
    assert client.post("/api/skills", json={"name": "deploy-app", "description": "x"}).status_code == 409
