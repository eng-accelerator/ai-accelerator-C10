"""Reset workspace/ from sample_project/, the same thing `uv run orion reset` does."""

from fastapi import APIRouter

from config import REPO_ROOT, WORKSPACE_PATH
from orion_agent.workspace import Workspace

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.post("/reset")
async def reset_workspace() -> dict:
    ws = Workspace(WORKSPACE_PATH)
    ws.reset(REPO_ROOT / "sample_project")
    files = sorted(p.name for p in ws.root.iterdir() if p.name not in ("__pycache__", ".pytest_cache"))
    return {"status": "ok", "files": files}
