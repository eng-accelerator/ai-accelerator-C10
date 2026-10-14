# Plan 3: Orion IDE on the shared package

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the FastAPI + React demo IDE to `orion-ide/`, make its backend run the `orion_agent` package instead of its own copies, add Rules and Skills panels backed by the repo's files, show skill loads and test results in the agent trace, and let a human reject with a reason.

**Architecture:** The backend keeps its router layout. `agent/graph.py` becomes a thin factory over `build_orchestrator`; `agent/chat_graph.py` becomes a thin factory over `build_tool_agent`. Five backend modules that duplicated the package are deleted. Two new routers, `/rules` and `/skills`, call `orion_agent.rules` and `orion_agent.skills`. The frontend gains a Skills panel, a rewritten Rules panel, a feedback box in the review dialog, and DESIGN.md token values in Tailwind. The IDE is a demo surface, not lesson code, so the changes are the smallest that make the beats work.

**Tech Stack:** Python 3.13 via uv (root venv, `ide` dependency group), FastAPI, uvicorn, React 18, Vite 6, zustand, Tailwind 3, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-04-orion-reframe-design.md` (sections 8, 13) and `DESIGN.md`

## Global Constraints

- The backend imports only from `orion_agent` for agent behaviour. No `langchain_community`, no FAISS, no `subprocess` with `shell=True`.
- The IDE's workspace is the repo's `workspace/` directory (`REPO_ROOT / "workspace"`), the same one the lessons use.
- Rules live in `AGENTS.md` and `.cursor/rules/*.mdc`; skills in `.cursor/skills/<name>/SKILL.md`. The IDE reads and writes those files and nothing else.
- Human decisions resume the graph with `Command(resume={"decision": "approve" | "reject", "feedback": str})`.
- SSE event types the frontend understands: `status`, `plan`, `code`, `test`, `review`, `skill_loaded`, `approval_needed`, `error`, `done`.
- Frontend colours come from DESIGN.md tokens. Purple `#8B5CF6` marks AI activity and the primary action; no new hex values outside the token map.
- Run commands: backend `uv run --group ide --directory orion-ide/backend uvicorn main:app --port 8000 --reload`; frontend `cd orion-ide/frontend && npm install && npm run dev`.
- Commit after every task with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer. Work on `main`.

---

## File structure

```
orion-ide/                               Task 1: git mv Notebooks/orion orion-ide; delete Notebooks/
pyproject.toml                           Task 1: [dependency-groups] ide = fastapi, uvicorn, python-multipart
orion-ide/backend/config.py              Task 2: REPO_ROOT, WORKSPACE_PATH, models
orion-ide/backend/agent/graph.py         Task 2: create_orchestrator over build_orchestrator; records skill loads
orion-ide/backend/agent/chat_graph.py    Task 2: create_chat_graph over build_tool_agent
orion-ide/backend/agent/{rag,tools,planner,coder,reviewer,state}.py   deleted in Task 2
orion-ide/backend/routers/terminal.py    Task 2: LocalSandbox, argv, no shell
orion-ide/backend/routers/agent.py       Task 3: new node names, events, feedback on resume
orion-ide/backend/routers/rules.py       Task 4
orion-ide/backend/routers/skills.py      Task 4
orion-ide/backend/models/schemas.py      Tasks 3, 4
orion-ide/backend/tests/test_rules_skills.py   Task 4
orion-ide/frontend/tailwind.config.js    Task 5
orion-ide/frontend/src/api/client.ts     Task 5
orion-ide/frontend/src/store/useStore.ts Task 5
orion-ide/frontend/src/types/index.ts    Task 5
orion-ide/frontend/src/components/RulesEditor.tsx   Task 6
orion-ide/frontend/src/components/SkillsPanel.tsx   Task 6
orion-ide/frontend/src/components/ActivityBar.tsx   Task 6
orion-ide/frontend/src/components/Layout.tsx        Task 6
orion-ide/frontend/src/components/AgentPanel.tsx    Task 7
orion-ide/frontend/src/components/ReviewDialog.tsx  Task 7
orion-ide/README.md                      Task 8
```

---

### Task 1: Move the app and wire the Python environment

**Files:**
- Move: `Notebooks/orion` to `orion-ide`
- Modify: `pyproject.toml`
- Delete: `orion-ide/backend/requirements.txt`, `orion-ide/.env.example`

- [ ] **Step 1: Move**

Run:

```bash
git mv Notebooks/orion orion-ide
rmdir Notebooks 2>/dev/null; ls Notebooks 2>/dev/null && echo "Notebooks still has files: stop and check" || echo "Notebooks removed"
git rm -q orion-ide/backend/requirements.txt orion-ide/.env.example
```

Expected: `Notebooks removed`. The IDE reads the root `.env`; the root `.env.example` already lists the keys.

- [ ] **Step 2: Add the `ide` dependency group to `pyproject.toml`**

Under `[dependency-groups]`, after the `dev` list, add:

```toml
ide = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
]
```

Run: `uv sync --group ide && uv run --group ide python -c "import fastapi, uvicorn; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Confirm the backend still imports its own modules from its directory**

Run: `uv run --group ide --directory orion-ide/backend python -c "import config; print(config.WORKSPACE_PATH)"`
Expected: a path ending in `orion-ide/backend/workspace` (Task 2 changes it).

- [ ] **Step 4: Commit**

```bash
git add -A pyproject.toml uv.lock orion-ide Notebooks
git commit -m "Move the IDE to orion-ide and run it from the root uv environment

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Backend on the package

**Files:**
- Modify: `orion-ide/backend/config.py`, `orion-ide/backend/agent/graph.py`, `orion-ide/backend/agent/chat_graph.py`, `orion-ide/backend/routers/terminal.py`, `orion-ide/backend/agent/__init__.py`
- Delete: `orion-ide/backend/agent/rag.py`, `tools.py`, `planner.py`, `coder.py`, `reviewer.py`, `state.py`, `orion-ide/backend/workspace/` (the stale copy of the sample project)

**Interfaces:**
- Produces: `config.REPO_ROOT: Path`, `config.WORKSPACE_PATH: str`, `config.AVAILABLE_MODELS`; `agent.graph.create_orchestrator(api_key, model) -> tuple[CompiledStateGraph, list[str]]` where the list collects the names of skills the planner loaded; `agent.chat_graph.create_chat_graph(api_key, model) -> CompiledStateGraph`; `routers.terminal` runs argv through `LocalSandbox`.

- [ ] **Step 1: Rewrite `config.py`**

```python
import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

WORKSPACE_PATH = str(REPO_ROOT / "workspace")
DEFAULT_MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

AVAILABLE_MODELS = [
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and affordable"},
    {"id": "openai/gpt-4o", "name": "GPT-4o", "description": "Most capable GPT-4 model"},
    {"id": "anthropic/claude-sonnet-4.5", "name": "Claude Sonnet 4.5", "description": "Strong at multi-file changes"},
    {"id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash", "description": "Google's fast model"},
    {"id": "deepseek/deepseek-chat-v3-0324", "name": "DeepSeek V3", "description": "Strong coding model"},
]
```

- [ ] **Step 2: Delete the duplicated modules and the stale workspace**

Run:

```bash
git rm -q orion-ide/backend/agent/rag.py orion-ide/backend/agent/tools.py orion-ide/backend/agent/planner.py orion-ide/backend/agent/coder.py orion-ide/backend/agent/reviewer.py orion-ide/backend/agent/state.py
git rm -rq orion-ide/backend/workspace
```

- [ ] **Step 3: Rewrite `agent/graph.py`**

```python
"""The IDE's orchestrator: the lesson graph, plus a hook that records skill loads for the trace."""

from __future__ import annotations

from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

from config import REPO_ROOT, WORKSPACE_PATH
from orion_agent.graphs.orchestrator import build_orchestrator
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import get_llm, structured
from orion_agent.sandbox import LocalSandbox
from orion_agent.schemas import CodeResult, Plan, ReviewResult
from orion_agent.skills import load_skills, read_skill_body, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace


def _recording_read_skill(skills, loaded: list[str]):
    by_name = {s.name: s for s in skills}

    @tool
    def read_skill(name: str) -> str:
        """Load the full instructions of a skill by name. Call this when a skill in the catalog matches the task."""
        skill = by_name.get(name)
        if skill is None:
            return f"Error: unknown skill '{name}'. Available: {', '.join(sorted(by_name))}"
        loaded.append(name)
        return read_skill_body(skill)

    return read_skill


def create_orchestrator(api_key: str, model: str):
    """Return (compiled graph, list that fills with loaded skill names as the planner works)."""
    llm = get_llm(model, api_key=api_key)
    ws = Workspace(WORKSPACE_PATH)
    sandbox = LocalSandbox()
    tools = make_tools(ws, sandbox)
    skills = load_skills(REPO_ROOT)
    loaded: list[str] = []
    research = build_tool_agent(
        llm,
        [tools["grep_files"], tools["glob_files"], tools["read_file"], _recording_read_skill(skills, loaded)],
        system_prompt=skills_catalog(skills) or None,
    )
    graph = build_orchestrator(
        structured(llm, Plan),
        structured(llm, CodeResult),
        structured(llm, ReviewResult),
        ws,
        sandbox,
        planner_agent=research,
        rules_root=REPO_ROOT,
        checkpointer=InMemorySaver(),
    )
    return graph, loaded
```

- [ ] **Step 4: Rewrite `agent/chat_graph.py`**

```python
"""The IDE's chat: the Lesson 1 loop with every tool, the repo rules, and the skills catalog."""

from __future__ import annotations

from config import REPO_ROOT, WORKSPACE_PATH
from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.llm import get_llm
from orion_agent.rules import load_rules
from orion_agent.sandbox import LocalSandbox
from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog
from orion_agent.tools import make_tools
from orion_agent.workspace import Workspace

PERSONA = "You are Orion, an expert AI coding assistant working inside the user's workspace."


def create_chat_graph(api_key: str, model: str):
    llm = get_llm(model, api_key=api_key, temperature=0.1)
    tools = make_tools(Workspace(WORKSPACE_PATH), LocalSandbox())
    skills = load_skills(REPO_ROOT)
    system_prompt = "\n\n".join(part for part in (PERSONA, load_rules(REPO_ROOT), skills_catalog(skills)) if part)
    return build_tool_agent(llm, [*tools.values(), make_read_skill_tool(skills)], system_prompt=system_prompt)
```

- [ ] **Step 5: Rewrite `routers/terminal.py`**

```python
import shlex

from fastapi import APIRouter

from config import WORKSPACE_PATH
from models.schemas import TerminalRequest, TerminalResponse
from orion_agent.sandbox import LocalSandbox
from orion_agent.workspace import Workspace

router = APIRouter(prefix="/terminal", tags=["terminal"])


@router.post("/execute")
async def execute_command(request: TerminalRequest) -> TerminalResponse:
    argv = shlex.split(request.command)
    if not argv:
        return TerminalResponse(stdout="", stderr="empty command", returncode=2)
    result = LocalSandbox().run(argv, cwd=Workspace(WORKSPACE_PATH).root, timeout=15)
    return TerminalResponse(stdout=result.stdout, stderr=result.stderr, returncode=result.returncode)
```

- [ ] **Step 6: Empty `agent/__init__.py`**

Replace its contents with a single docstring line: `"""Graph factories for the IDE."""`. If it re-exported the deleted modules, that is what was breaking imports.

- [ ] **Step 7: Verify the backend imports and the chat graph builds**

Run:

```bash
uv run orion reset
uv run --group ide --directory orion-ide/backend python -c "
import config
from agent.graph import create_orchestrator
from agent.chat_graph import create_chat_graph
g, loaded = create_orchestrator('k', 'openai/gpt-4o-mini')
print(sorted(set(g.get_graph().nodes) - {'__start__', '__end__'}))
c = create_chat_graph('k', 'openai/gpt-4o-mini')
print(config.WORKSPACE_PATH)"
```

Expected: the seven node names and a path ending in `/workspace`.

- [ ] **Step 8: Commit**

```bash
git add -A orion-ide/backend
git commit -m "Run the IDE backend on orion_agent; delete its duplicated agent modules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Agent router events and feedback on resume

**Files:**
- Modify: `orion-ide/backend/routers/agent.py`, `orion-ide/backend/models/schemas.py`

**Interfaces:**
- Consumes: `create_orchestrator` (Task 2).
- Produces: `POST /agent/run` and `POST /agent/approve` streaming SSE with the event types in Global Constraints; `AgentApproveRequest(thread_id, decision, feedback="")`; `GET /agent/history/{thread_id}`.

- [ ] **Step 1: Update `models/schemas.py`**

Change `AgentApproveRequest` to:

```python
class AgentApproveRequest(BaseModel):
    thread_id: str
    decision: str
    feedback: str = ""
```

Remove the `rules: str | None = None` fields from `ChatRequest` and `AgentRunRequest` (rules now come from files).

- [ ] **Step 2: Rewrite `routers/agent.py`**

```python
import json
import uuid

from fastapi import APIRouter, Header, HTTPException
from langgraph.types import Command
from starlette.responses import StreamingResponse

from config import DEFAULT_MODEL, OPENROUTER_API_KEY
from models.schemas import AgentApproveRequest, AgentRunRequest

router = APIRouter(prefix="/agent", tags=["agent"])

orchestrators: dict[str, tuple] = {}

STATUS_MAP = {
    "plan": "planning",
    "code": "coding",
    "test": "testing",
    "ai_review": "reviewing",
    "human_review": "waiting_approval",
    "apply": "applying",
    "verify": "verifying",
}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _stream(graph, loaded: list[str], graph_input, config):
    """Translate graph updates into the IDE's SSE events."""
    seen_skills = 0
    try:
        async for chunk in graph.astream(graph_input, config=config, stream_mode="updates"):
            for node_name, update in chunk.items():
                if node_name == "__interrupt__":
                    for interrupt_val in update:
                        yield _sse({"type": "approval_needed", **interrupt_val.value})
                    continue
                if node_name in STATUS_MAP:
                    yield _sse({"type": "status", "status": STATUS_MAP[node_name]})
                if not isinstance(update, dict):
                    continue
                if node_name == "plan":
                    for name in loaded[seen_skills:]:
                        yield _sse({"type": "skill_loaded", "name": name})
                    seen_skills = len(loaded)
                    if update.get("status") == "path_rejected":
                        yield _sse({"type": "error", "message": update.get("error", "plan rejected")})
                    elif update.get("plan"):
                        yield _sse({"type": "plan", "plan": update["plan"], "tasks": update.get("file_tasks", [])})
                elif node_name == "code":
                    for item in update.get("generated_code", []):
                        yield _sse({"type": "code", "filepath": item["filepath"], "description": item.get("explanation", ""), "status": "done"})
                elif node_name == "test":
                    yield _sse({"type": "test", "status": update.get("status", ""), "output": update.get("test_output", "")})
                elif node_name == "ai_review":
                    yield _sse({"type": "review", "status": update.get("status", ""), "result": update.get("review_result", "")})
                elif node_name == "verify":
                    yield _sse({"type": "test", "status": update.get("status", ""), "output": update.get("test_output", "")})
                    yield _sse({"type": "status", "status": "done" if update.get("status") == "done" else "error"})
                elif node_name == "apply" and update.get("status") == "apply_failed":
                    yield _sse({"type": "error", "message": update.get("error", "apply failed")})
    except Exception as exc:  # noqa: BLE001 - the UI shows whatever went wrong
        yield _sse({"type": "error", "message": str(exc)})
    yield _sse({"type": "done"})


@router.post("/run")
async def run_agent(request: AgentRunRequest, x_api_key: str | None = Header(None)):
    api_key = request.api_key or x_api_key or OPENROUTER_API_KEY
    model = request.model or DEFAULT_MODEL
    thread_id = request.thread_id or str(uuid.uuid4())

    from agent.graph import create_orchestrator

    graph, loaded = create_orchestrator(api_key=api_key, model=model)
    orchestrators[thread_id] = (graph, loaded)
    config = {"configurable": {"thread_id": thread_id}}
    return StreamingResponse(
        _stream(graph, loaded, {"feature_request": request.feature_request}, config),
        media_type="text/event-stream",
        headers={"X-Thread-ID": thread_id},
    )


@router.post("/approve")
async def approve_agent(request: AgentApproveRequest):
    if request.thread_id not in orchestrators:
        raise HTTPException(status_code=404, detail="Thread not found")
    graph, loaded = orchestrators[request.thread_id]
    config = {"configurable": {"thread_id": request.thread_id}}
    resume = Command(resume={"decision": request.decision, "feedback": request.feedback})
    return StreamingResponse(_stream(graph, loaded, resume, config), media_type="text/event-stream")


@router.get("/history/{thread_id}")
async def get_history(thread_id: str):
    if thread_id not in orchestrators:
        return {"steps": []}
    graph, _ = orchestrators[thread_id]
    config = {"configurable": {"thread_id": thread_id}}
    keys = ("status", "plan", "review_result", "test_output", "human_decision", "human_feedback", "error")
    steps = []
    for i, state in enumerate(graph.get_state_history(config)):
        steps.append({
            "step": i,
            "status": state.values.get("status", ""),
            "next": list(state.next) if state.next else [],
            "state": {k: (str(v)[:200] if isinstance(v, (list, dict)) else v) for k, v in state.values.items() if k in keys},
        })
    return {"steps": steps}
```

- [ ] **Step 3: Update `routers/chat.py`**

Replace the `create_chat_graph(api_key=..., model=..., workspace_path=...)` call with `create_chat_graph(api_key=api_key, model=model)`, and delete the block that prepends `request.rules` as a system message (rules now come from files inside the graph).

- [ ] **Step 4: Smoke the SSE translation offline**

Run:

```bash
uv run --group ide --directory orion-ide/backend python -c "
import asyncio, json
from routers.agent import _stream
class FakeInterrupt:
    value = {'plan': 'p', 'changes': [], 'test_output': 'ok', 'review_result': 'Looks good'}
async def fake_astream(*a, **k):
    yield {'plan': {'plan': 'p', 'file_tasks': [], 'status': 'planned'}}
    yield {'test': {'status': 'tests_passed', 'test_output': '3 passed'}}
    yield {'__interrupt__': [FakeInterrupt()]}
class G:
    astream = staticmethod(fake_astream)
async def main():
    async for line in _stream(G(), ['web-research'], {}, {}):
        print(json.loads(line[6:])['type'])
asyncio.run(main())"
```

Expected, in order: `status`, `skill_loaded`, `plan`, `status`, `test`, `approval_needed`, `done`.

- [ ] **Step 5: Commit**

```bash
git add orion-ide/backend/routers/agent.py orion-ide/backend/routers/chat.py orion-ide/backend/models/schemas.py
git commit -m "IDE agent router: new node names, test and skill events, feedback on reject

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rules and skills routers

**Files:**
- Create: `orion-ide/backend/routers/rules.py` (replace), `orion-ide/backend/routers/skills.py`, `orion-ide/backend/tests/__init__.py` (empty), `orion-ide/backend/tests/test_rules_skills.py`
- Modify: `orion-ide/backend/models/schemas.py`, `orion-ide/backend/main.py`

**Interfaces:**
- Produces: `GET /api/rules -> [{name, source, description, globs, always_apply}]`; `GET /api/rules/{name} -> {name, content}`; `PUT /api/rules/{name}` body `{content}`; `GET /api/skills -> [{name, description, paths, model_invocable, source}]`; `GET /api/skills/{name} -> {name, content}`; `PUT /api/skills/{name}` body `{content}`; `POST /api/skills` body `{name, description}` scaffolds `.cursor/skills/<name>/SKILL.md`. The rule named `AGENTS` maps to `AGENTS.md`; every other name maps to `.cursor/rules/<name>.mdc`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run --group ide --directory orion-ide/backend pytest tests -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'routers.skills'` (or an import error on `REPO_ROOT` in `routers.rules`).

- [ ] **Step 3: Add the schemas**

Append to `models/schemas.py`:

```python
class RuleSummary(BaseModel):
    name: str
    source: str
    description: str = ""
    globs: list[str] = []
    always_apply: bool = False


class RuleContent(BaseModel):
    name: str
    content: str


class SkillSummary(BaseModel):
    name: str
    description: str = ""
    paths: list[str] = []
    model_invocable: bool = True
    source: str


class SkillContent(BaseModel):
    name: str
    content: str


class NewSkillRequest(BaseModel):
    name: str
    description: str
```

Keep `RulesRequest(content: str)`; it is reused as the PUT body.

- [ ] **Step 4: Rewrite `routers/rules.py`**

```python
import re

from fastapi import APIRouter, HTTPException

from config import REPO_ROOT
from models.schemas import RuleContent, RuleSummary, RulesRequest
from orion_agent.rules import list_rules

router = APIRouter(prefix="/rules", tags=["rules"])
_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _path_for(name: str):
    if not _NAME.match(name):
        raise HTTPException(status_code=404, detail="unknown rule")
    if name == "AGENTS":
        return REPO_ROOT / "AGENTS.md"
    return REPO_ROOT / ".cursor" / "rules" / f"{name}.mdc"


@router.get("")
async def list_all() -> list[RuleSummary]:
    out = []
    agents = REPO_ROOT / "AGENTS.md"
    if agents.exists():
        out.append(RuleSummary(name="AGENTS", source="AGENTS.md", description="Repo-wide rules, always on", always_apply=True))
    for rule in list_rules(REPO_ROOT):
        out.append(RuleSummary(name=rule.name, source=rule.source, description=rule.description, globs=rule.globs, always_apply=rule.always_apply))
    return out


@router.get("/{name}")
async def read_one(name: str) -> RuleContent:
    path = _path_for(name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="unknown rule")
    return RuleContent(name=name, content=path.read_text())


@router.put("/{name}")
async def write_one(name: str, request: RulesRequest) -> dict:
    path = _path_for(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(request.content)
    return {"status": "ok"}
```

- [ ] **Step 5: Write `routers/skills.py`**

```python
import re

from fastapi import APIRouter, HTTPException
from starlette.responses import JSONResponse

from config import REPO_ROOT
from models.schemas import NewSkillRequest, RulesRequest, SkillContent, SkillSummary
from orion_agent.skills import load_skills

router = APIRouter(prefix="/skills", tags=["skills"])
_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _find(name: str):
    for skill in load_skills(REPO_ROOT):
        if skill.name == name:
            return skill
    raise HTTPException(status_code=404, detail="unknown skill")


@router.get("")
async def list_all() -> list[SkillSummary]:
    return [
        SkillSummary(
            name=s.name,
            description=s.description,
            paths=s.paths,
            model_invocable=s.model_invocable,
            source=s.path.relative_to(REPO_ROOT).as_posix(),
        )
        for s in load_skills(REPO_ROOT)
    ]


@router.get("/{name}")
async def read_one(name: str) -> SkillContent:
    return SkillContent(name=name, content=_find(name).path.read_text())


@router.put("/{name}")
async def write_one(name: str, request: RulesRequest) -> dict:
    _find(name).path.write_text(request.content)
    return {"status": "ok"}


@router.post("")
async def create(request: NewSkillRequest):
    if not _NAME.match(request.name):
        raise HTTPException(status_code=422, detail="name must be lowercase letters, digits, and hyphens")
    folder = REPO_ROOT / ".cursor" / "skills" / request.name
    if (folder / "SKILL.md").exists():
        raise HTTPException(status_code=409, detail="skill exists")
    folder.mkdir(parents=True, exist_ok=True)
    title = request.name.replace("-", " ").capitalize()
    (folder / "SKILL.md").write_text(
        f"---\nname: {request.name}\ndescription: {request.description}\n---\n# {title}\n\n1. \n"
    )
    return JSONResponse(status_code=201, content={"status": "created", "name": request.name})
```

- [ ] **Step 6: Register the router in `main.py`**

Add `from routers.skills import router as skills_router` next to the other router imports and `app.include_router(skills_router, prefix="/api")` after the rules router line.

- [ ] **Step 7: Run to verify pass**

Run: `uv run --group ide --directory orion-ide/backend pytest tests -v`
Expected: 6 passed. If `test_rule_name_cannot_escape` returns 405 or 200, check the regex is applied before the path is built.

- [ ] **Step 8: Commit**

```bash
git add orion-ide/backend
git commit -m "IDE: rules and skills routers over the repo's files

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Frontend tokens, types, store, API client

**Files:**
- Modify: `orion-ide/frontend/tailwind.config.js`, `orion-ide/frontend/src/index.css`, `orion-ide/frontend/src/types/index.ts`, `orion-ide/frontend/src/store/useStore.ts`, `orion-ide/frontend/src/api/client.ts`

**Interfaces:**
- Produces: Tailwind names unchanged, values from DESIGN.md, plus `orion.accent.purple` and `orion.accent.soft`; store fields `sidebarView` including `'skills'`, `loadedSkills: string[]`, `addLoadedSkill`, `clearLoadedSkills`, `testOutput: string | null`, `setTestOutput`; `PendingReview.changes: {filepath, explanation, preview}[]` plus `testOutput`; API functions `fetchRules(): Promise<RuleSummary[]>`, `fetchRule(name)`, `saveRule(name, content)`, `fetchSkills()`, `fetchSkill(name)`, `saveSkill(name, content)`, `createSkill(name, description)`, `approveAgent(threadId, decision, feedback, onEvent)`.

- [ ] **Step 1: Replace the colour map in `tailwind.config.js`**

```js
colors: {
  orion: {
    bg: {
      primary: '#0B0B0D',   // canvas
      secondary: '#121214', // surface
      tertiary: '#19191D',  // surface raised
      activity: '#121214',
      titlebar: '#121214',
      input: '#19191D',
    },
    border: '#2B2B32',
    'border-subtle': '#1F1F24',
    text: {
      primary: '#F4F4F5',
      secondary: '#A1A1AA',
      muted: '#71717A',
    },
    accent: {
      blue: '#60A5FA',
      teal: '#4ADE80',
      red: '#FB7185',
      amber: '#FACC15',
      purple: '#8B5CF6',
      'purple-hover': '#A78BFA',
      soft: '#211B38',
    },
    selection: '#211B38',
  },
},
fontFamily: {
  sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Geist Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
},
```

In `src/index.css`, set `body { background-color: #0B0B0D; color: #F4F4F5; font-family: Inter, Geist, ui-sans-serif, system-ui, sans-serif; }`, scrollbar track `#0B0B0D`, thumb `#2B2B32`, thumb hover `#71717A`, selection `#211B38`.

- [ ] **Step 2: Update `types/index.ts`**

Replace `PendingReview` with:

```ts
export interface PendingReview {
  threadId: string;
  plan: string;
  reviewResult: string;
  testOutput: string;
  changes: { filepath: string; explanation: string; preview: string }[];
}

export interface RuleSummary {
  name: string;
  source: string;
  description: string;
  globs: string[];
  always_apply: boolean;
}

export interface SkillSummary {
  name: string;
  description: string;
  paths: string[];
  model_invocable: boolean;
  source: string;
}
```

- [ ] **Step 3: Update `store/useStore.ts`**

- Change the `sidebarView` union (both in the interface and `setSidebarView`) to `'files' | 'agent' | 'rules' | 'skills' | 'timetravel'`.
- Add to the interface and the store:

```ts
loadedSkills: string[]
addLoadedSkill: (name: string) => void
clearLoadedSkills: () => void
testOutput: string | null
setTestOutput: (output: string | null) => void
```

```ts
loadedSkills: [],
addLoadedSkill: (name) => set((s) => ({ loadedSkills: s.loadedSkills.includes(name) ? s.loadedSkills : [...s.loadedSkills, name] })),
clearLoadedSkills: () => set({ loadedSkills: [] }),
testOutput: null,
setTestOutput: (output) => set({ testOutput: output }),
```

- Extend `agentStatus` with `'verifying'`.
- Remove `rules: string` and `setRules` from the store; rules are no longer sent with requests.

- [ ] **Step 4: Update `api/client.ts`**

Replace `fetchRules` and `saveRules` with:

```ts
export async function fetchRules() {
  const res = await fetch(`${API_BASE}/rules`, { headers: getHeaders() })
  return res.json()
}

export async function fetchRule(name: string) {
  const res = await fetch(`${API_BASE}/rules/${encodeURIComponent(name)}`, { headers: getHeaders() })
  return res.json()
}

export async function saveRule(name: string, content: string) {
  const res = await fetch(`${API_BASE}/rules/${encodeURIComponent(name)}`, {
    method: 'PUT', headers: getHeaders(), body: JSON.stringify({ content })
  })
  return res.json()
}

export async function fetchSkills() {
  const res = await fetch(`${API_BASE}/skills`, { headers: getHeaders() })
  return res.json()
}

export async function fetchSkill(name: string) {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(name)}`, { headers: getHeaders() })
  return res.json()
}

export async function saveSkill(name: string, content: string) {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(name)}`, {
    method: 'PUT', headers: getHeaders(), body: JSON.stringify({ content })
  })
  return res.json()
}

export async function createSkill(name: string, description: string) {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ name, description })
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'could not create skill')
  return res.json()
}
```

Change `sendChatMessage` to drop the `rules` parameter and the `rules` field in its body. Change `runAgent(featureRequest, model, threadId, onEvent)` to drop `rules` from its signature and body. Change `approveAgent` to `approveAgent(threadId: string, decision: string, feedback: string, onEvent: ...)` and send `{ thread_id: threadId, decision, feedback, api_key: apiKey }`.

- [ ] **Step 5: Type-check**

Run: `cd orion-ide/frontend && npm install && npx tsc -b`
Expected: errors only in `RulesEditor.tsx`, `AgentPanel.tsx`, `ReviewDialog.tsx`, `ChatPanel.tsx` (they still use the removed `rules` and the old `approveAgent` signature); Tasks 6 and 7 fix them. If `ChatPanel.tsx` is the only leftover after Task 7, change its `sendChatMessage(messages, model, rules, ...)` call to `sendChatMessage(messages, model, ...)`.

- [ ] **Step 6: Commit**

```bash
git add orion-ide/frontend
git commit -m "IDE frontend: DESIGN.md tokens, skills and test state, rules and skills API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Rules panel, Skills panel, activity bar

**Files:**
- Modify: `orion-ide/frontend/src/components/RulesEditor.tsx` (replace), `ActivityBar.tsx`, `Layout.tsx`
- Create: `orion-ide/frontend/src/components/SkillsPanel.tsx`

- [ ] **Step 1: Replace `RulesEditor.tsx`**

```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Save } from 'lucide-react';
import { fetchRule, fetchRules, saveRule } from '../api/client';
import type { RuleSummary } from '../types';

export default function RulesEditor() {
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules().then((data: RuleSummary[]) => {
      setRules(data);
      setLoading(false);
      if (data.length && !selected) select(data[0].name);
    });
  }, []);

  const select = async (name: string) => {
    setSelected(name);
    const data = await fetchRule(name);
    setContent(data.content ?? '');
  };

  const handleSave = async () => {
    if (!selected) return;
    await saveRule(selected, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">Rules</span>
        <span className="text-[10px] font-mono text-orion-text-muted">AGENTS.md · .cursor/rules</span>
      </div>

      {loading ? (
        <p className="text-xs text-orion-text-muted">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-orion-text-muted">No rules found. Add AGENTS.md or a .mdc file under .cursor/rules.</p>
      ) : (
        <ul className="space-y-1">
          {rules.map((rule) => {
            const active = rule.name === selected;
            return (
              <li key={rule.name}>
                <button
                  onClick={() => select(rule.name)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple ${
                    active
                      ? 'bg-orion-accent-soft border-orion-border text-orion-text-primary'
                      : 'bg-transparent border-transparent text-orion-text-secondary hover:bg-orion-bg-tertiary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono truncate">{rule.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-muted shrink-0">
                      {rule.always_apply ? 'always' : rule.globs.join(', ') || 'manual'}
                    </span>
                  </div>
                  {rule.description && <p className="text-[11px] text-orion-text-muted mt-0.5 truncate">{rule.description}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={content}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        aria-label={`Contents of ${selected ?? 'rule'}`}
        disabled={!selected}
        className="flex-1 w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orion-accent-purple disabled:opacity-50"
      />

      <button
        onClick={handleSave}
        disabled={!selected}
        className={`w-full flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary disabled:opacity-40 ${
          saved ? 'bg-orion-bg-tertiary text-orion-accent-teal border border-orion-border' : 'bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover'
        }`}
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save rule'}
      </button>

      <p className="text-[11px] text-orion-text-muted leading-relaxed">
        AGENTS.md is always on. A .mdc rule applies to files that match its globs. The agent loads the same files Cursor does.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `SkillsPanel.tsx`**

```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Plus, Save } from 'lucide-react';
import { createSkill, fetchSkill, fetchSkills, saveSkill } from '../api/client';
import type { SkillSummary } from '../types';

export default function SkillsPanel() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data: SkillSummary[] = await fetchSkills();
    setSkills(data);
    return data;
  };

  useEffect(() => {
    load().then((data) => {
      if (data.length) select(data[0].name);
    });
  }, []);

  const select = async (name: string) => {
    setSelected(name);
    const data = await fetchSkill(name);
    setContent(data.content ?? '');
  };

  const handleSave = async () => {
    if (!selected) return;
    await saveSkill(selected, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await createSkill(newName.trim(), newDescription.trim());
      setCreating(false);
      setNewName('');
      setNewDescription('');
      await load();
      await select(newName.trim());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">Skills</span>
        <button
          onClick={() => setCreating((v) => !v)}
          aria-label="New skill"
          className="flex items-center gap-1 text-xs text-orion-text-secondary hover:text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple rounded px-1"
        >
          <Plus size={14} /> New skill
        </button>
      </div>

      {creating && (
        <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-3 space-y-2">
          <label className="block text-[11px] text-orion-text-secondary">
            Name (lowercase, hyphens)
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full h-10 bg-orion-bg-input border border-orion-border rounded-md px-3 text-sm font-mono text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
            />
          </label>
          <label className="block text-[11px] text-orion-text-secondary">
            Description (when to use it)
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-full h-10 bg-orion-bg-input border border-orion-border rounded-md px-3 text-sm text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
            />
          </label>
          {error && <p className="text-[11px] text-orion-accent-red">Error: {error}</p>}
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newDescription.trim()}
            className="w-full h-10 rounded-md text-sm font-medium bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
          >
            Create skill
          </button>
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-xs text-orion-text-muted">No skills yet. Create one, or add a folder with SKILL.md under .cursor/skills.</p>
      ) : (
        <ul className="space-y-1">
          {skills.map((skill) => {
            const active = skill.name === selected;
            return (
              <li key={skill.name}>
                <button
                  onClick={() => select(skill.name)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple ${
                    active
                      ? 'bg-orion-accent-soft border-orion-border text-orion-text-primary'
                      : 'bg-transparent border-transparent text-orion-text-secondary hover:bg-orion-bg-tertiary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{skill.name}</span>
                    {!skill.model_invocable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-muted">manual</span>
                    )}
                  </div>
                  <p className="text-[11px] text-orion-text-muted mt-0.5 line-clamp-2">{skill.description}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={content}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        aria-label={`Contents of ${selected ?? 'skill'}`}
        disabled={!selected}
        className="flex-1 w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orion-accent-purple disabled:opacity-50"
      />

      <button
        onClick={handleSave}
        disabled={!selected}
        className={`w-full flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary disabled:opacity-40 ${
          saved ? 'bg-orion-bg-tertiary text-orion-accent-teal border border-orion-border' : 'bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover'
        }`}
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save skill'}
      </button>

      <p className="text-[11px] text-orion-text-muted leading-relaxed">
        The agent sees one line per skill. It loads the full body with read_skill when the description matches the task.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Add the Skills entry to `ActivityBar.tsx`**

Import `Sparkles` from `lucide-react` and add `{ view: 'skills' as const, icon: Sparkles, label: 'Skills' }` after the Rules entry. Change the active classes from `border-orion-accent-blue` to `border-orion-accent-purple`, and the two toggle buttons' hover from `hover:text-white` to `hover:text-orion-text-primary`. Add `focus:outline-none focus-visible:ring-2 focus-visible:ring-orion-accent-purple` to every button.

- [ ] **Step 4: Route the view in `Layout.tsx`**

Import `SkillsPanel` and add `case 'skills': return <SkillsPanel />` to `SidebarContent`. Change the two `PanelResizeHandle` hover classes from `hover:bg-orion-accent-blue` to `hover:bg-orion-accent-purple`.

- [ ] **Step 5: Type-check**

Run: `cd orion-ide/frontend && npx tsc -b`
Expected: errors only in `AgentPanel.tsx`, `ReviewDialog.tsx`, and possibly `ChatPanel.tsx` (Task 7).

- [ ] **Step 6: Commit**

```bash
git add orion-ide/frontend/src
git commit -m "IDE: Rules panel over rule files, new Skills panel, activity bar entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Agent panel trace and review dialog with feedback

**Files:**
- Modify: `orion-ide/frontend/src/components/AgentPanel.tsx`, `ReviewDialog.tsx`, `ChatPanel.tsx`

- [ ] **Step 1: Update `AgentPanel.tsx`**

- Destructure `loadedSkills, addLoadedSkill, clearLoadedSkills, testOutput, setTestOutput` from the store and drop `rules`.
- Add to `statusConfig`: `verifying: { color: 'text-orion-accent-blue', icon: <Loader2 size={14} className="animate-spin" />, label: 'Verifying...' }`. Change `reviewing`'s colour to `text-orion-accent-purple` and `waiting_approval`'s to `text-orion-accent-amber`.
- In `handleRun`, call `clearLoadedSkills()` and `setTestOutput(null)` before `runAgent`, and change the call to `runAgent(featureRequest, selectedModel, newThreadId, (event) => { ... })`.
- Add cases to the event switch:

```tsx
case 'skill_loaded':
  addLoadedSkill(event.name);
  break;
case 'test':
  setTestOutput(`${event.status === 'tests_passed' || event.status === 'done' ? 'PASS' : 'FAIL'}\n${event.output || ''}`);
  break;
case 'approval_needed':
  setPendingReview({
    threadId: newThreadId,
    plan: event.plan || '',
    reviewResult: event.review_result || '',
    testOutput: event.test_output || '',
    changes: event.changes || [],
  });
  setAgentStatus('waiting_approval');
  break;
```

- Replace the primary button classes `bg-orion-accent-blue text-white` with `bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover` and give it `h-10`, `focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary`.
- Render the loaded skills between the status line and the plan:

```tsx
{loadedSkills.length > 0 && (
  <div className="bg-orion-accent-soft border border-orion-border rounded-md p-3">
    <h4 className="text-xs font-semibold text-orion-accent-purple-hover uppercase tracking-wider mb-1">Skills loaded</h4>
    <ul className="text-xs font-mono text-orion-text-primary space-y-0.5">
      {loadedSkills.map((name) => <li key={name}>read_skill("{name}")</li>)}
    </ul>
  </div>
)}
```

- Render the test result after the task list:

```tsx
{testOutput && (
  <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-3">
    <h4 className="text-xs font-semibold text-orion-text-secondary uppercase tracking-wider mb-1">Tests</h4>
    <pre className="text-[11px] font-mono text-orion-text-primary whitespace-pre-wrap max-h-40 overflow-auto">{testOutput}</pre>
  </div>
)}
```

- [ ] **Step 2: Update `ReviewDialog.tsx`**

- Add `import { useState } from 'react';` and `const [feedback, setFeedback] = useState(''); const [rejecting, setRejecting] = useState(false);` inside the component (after the early `return null`, move the early return below the hooks: hooks must run unconditionally, so declare the state first and then `if (!pendingReview) return null;`).
- Change `handleDecision` to `(decision: 'approve' | 'reject')` calling `approveAgent(threadId, decision, decision === 'reject' ? feedback : '', (event) => { ... })`, and on reject set the status to `'coding'` instead of `'idle'`. Add `case 'approval_needed':` that sets a new `pendingReview` from the event exactly as `AgentPanel` does (a reject comes back with a new proposal), and `case 'test':` that calls `useStore.getState().setTestOutput(...)` the same way.
- After the AI Review block, add a Tests block:

```tsx
{pendingReview.testOutput && (
  <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-4">
    <h3 className="text-xs font-semibold text-orion-text-secondary uppercase tracking-wider mb-2">Tests</h3>
    <pre className="text-[11px] font-mono text-orion-text-primary whitespace-pre-wrap max-h-40 overflow-auto">{pendingReview.testOutput}</pre>
  </div>
)}
```

- In the changes list, read `change.explanation` and `change.preview` (the old fields were `description` and `code_preview`).
- Replace the footer with:

```tsx
<div className="px-6 py-4 border-t border-orion-border flex-shrink-0 space-y-3">
  {rejecting && (
    <label className="block text-[11px] text-orion-text-secondary">
      Why? The coder gets this verbatim.
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        className="mt-1 w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
      />
    </label>
  )}
  <div className="flex items-center justify-end gap-3">
    {rejecting ? (
      <button
        onClick={() => handleDecision('reject')}
        disabled={!feedback.trim()}
        className="h-10 px-4 rounded-md text-sm font-semibold text-orion-accent-red border border-orion-border hover:bg-orion-bg-tertiary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
      >
        Send back with feedback
      </button>
    ) : (
      <button
        onClick={() => setRejecting(true)}
        className="h-10 px-4 rounded-md text-sm font-semibold text-orion-accent-red hover:bg-orion-bg-tertiary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
      >
        Reject
      </button>
    )}
    <button
      onClick={() => handleDecision('approve')}
      className="h-10 px-4 rounded-md text-sm font-semibold bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
    >
      Approve and apply
    </button>
  </div>
</div>
```

- Change the Plan Summary block's colours from `bg-orion-accent-blue/10 border-orion-accent-blue/30` and `text-orion-accent-blue` to `bg-orion-accent-soft border-orion-border` and `text-orion-accent-purple-hover`. Change the AI Review heading colour from `text-purple-400` to `text-orion-accent-purple-hover`.

- [ ] **Step 3: Update `ChatPanel.tsx`**

Remove the `rules` argument from its `sendChatMessage` call and any `rules` read from the store.

- [ ] **Step 4: Build**

Run: `cd orion-ide/frontend && npx tsc -b && npm run build`
Expected: clean build.

- [ ] **Step 5: Run both halves and walk the beats**

Run in two terminals:

```bash
uv run orion reset && uv run --group ide --directory orion-ide/backend uvicorn main:app --port 8000 --reload
```

```bash
cd orion-ide/frontend && npm run dev
```

Open http://localhost:5173, set the API key, and check:
1. Rules tab lists AGENTS, python, tests, frontend-design with glob badges; editing python.mdc and saving changes the file on disk.
2. Skills tab lists add-feature, frontend-design, web-research, and commit-deploy (marked manual); "New skill" creates a folder under `.cursor/skills`.
3. Agent: "Add a TAGLINE constant to config.py and show it under the title in app.py." The trace shows a skill loaded (add-feature), the plan, code, a Tests block, then the review dialog with a Tests section.
4. Reject with "call it SUBTITLE": the dialog closes, the agent codes again, and a new dialog appears whose preview uses SUBTITLE.
5. Approve: status goes applying, verifying, done; the file explorer shows the changed files.

Record anything that does not behave this way in the report.

- [ ] **Step 6: Commit**

```bash
git add orion-ide/frontend/src
git commit -m "IDE: skill loads and test results in the agent trace, reject with a reason

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: IDE README

**Files:**
- Modify: `orion-ide/README.md` (replace)

- [ ] **Step 1: Write it**

```markdown
# Orion IDE

A small Cursor-like IDE that runs the same agent the lessons build: chat with tools, an agent mode with a plan, tests, an AI review, and a human gate, plus panels for the repo's rules and skills.

## Run

Backend, from the repo root:

```bash
uv sync --group ide
uv run orion reset
uv run --group ide --directory orion-ide/backend uvicorn main:app --port 8000 --reload
```

Frontend, in a second terminal:

```bash
cd orion-ide/frontend
npm install
npm run dev
```

Open http://localhost:5173. Enter an OpenRouter key in the chat panel, or put it in the repo's `.env`.

## What is where

| Panel | Backed by |
|---|---|
| Explorer | `workspace/`, the copy of `sample_project/` that `orion reset` makes |
| Agent | `orion_agent.graphs.orchestrator` through `backend/agent/graph.py` |
| Rules | `AGENTS.md` and `.cursor/rules/*.mdc`, through `/api/rules` |
| Skills | `.cursor/skills/*/SKILL.md`, through `/api/skills` |
| Time travel | the graph's checkpoint history, through `/api/agent/history` |
| Chat | `orion_agent.graphs.tool_agent` with every tool, the rules, and the skills catalog |
| Terminal | `orion_agent.sandbox.LocalSandbox` (argv only, no shell) |

The backend has no agent logic of its own. Change the package and the IDE changes with it.

## Tests

```bash
uv run --group ide --directory orion-ide/backend pytest tests
```
```

- [ ] **Step 2: Commit**

```bash
git add orion-ide/README.md
git commit -m "IDE README: run commands and what each panel is backed by

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Section 8: moved to `orion-ide/` (Task 1); backend imports the package and deletes rag, tools, planner, coder, reviewer, state (Task 2); `config.WORKSPACE_PATH` is the repo workspace and FAISS-era requirements are gone (Tasks 1, 2); `/rules` lists and edits AGENTS.md and mdc files, `/skills` lists, edits, and scaffolds (Task 4); SSE emits `skill_loaded` and tool events (Task 3); Rules panel lists files with a glob badge, Skills panel with a new-skill action, AgentPanel renders skill loads on the accent-soft background, Tailwind maps to DESIGN.md (Tasks 5 to 7). The reject-with-reason flow uses the `Command(resume={...})` contract from Plan 1.

**Deviations, stated.** Rule and skill bodies are edited in a panel textarea rather than an editor tab, because the Monaco editor's save path is jailed to `workspace/` and these files live at the repo root. The chat no longer takes a `rules` string from the UI; it loads the same files the agent does. `verifying` is a new status because the graph has a `verify` node.

**Type consistency.** `create_orchestrator(api_key, model)` returns `(graph, loaded)` and the router unpacks both. `PendingReview.changes[].explanation/preview` match the interrupt payload from `human_review_node`. `approveAgent(threadId, decision, feedback, onEvent)` matches `AgentApproveRequest`. Store `sidebarView` includes `'skills'` and `Layout` routes it.
