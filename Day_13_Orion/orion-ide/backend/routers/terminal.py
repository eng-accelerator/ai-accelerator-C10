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
