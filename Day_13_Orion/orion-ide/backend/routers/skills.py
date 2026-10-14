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
