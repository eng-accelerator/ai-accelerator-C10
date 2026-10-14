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
