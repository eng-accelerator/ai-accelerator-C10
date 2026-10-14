from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import WORKSPACE_PATH
from models.schemas import FileContent, FileNode

router = APIRouter(tags=["files"])

WORKSPACE = Path(WORKSPACE_PATH)
EXCLUDED_NAMES = {"__pycache__", ".git"}


def build_file_tree(directory: Path) -> list[FileNode]:
    nodes: list[FileNode] = []
    for item in sorted(directory.iterdir()):
        if item.name in EXCLUDED_NAMES or item.suffix == ".pyc":
            continue
        if item.is_dir():
            children = build_file_tree(item)
            nodes.append(FileNode(
                name=item.name,
                path=str(item.relative_to(WORKSPACE)),
                is_directory=True,
                children=children,
            ))
        else:
            nodes.append(FileNode(
                name=item.name,
                path=str(item.relative_to(WORKSPACE)),
                is_directory=False,
            ))
    dirs = [n for n in nodes if n.is_directory]
    files = [n for n in nodes if not n.is_directory]
    return dirs + files


@router.get("/files")
async def list_files() -> list[FileNode]:
    if not WORKSPACE.exists():
        return []
    return build_file_tree(WORKSPACE)


@router.get("/files/{path:path}")
async def read_file(path: str) -> FileContent:
    full_path = (WORKSPACE / path).resolve()
    if not str(full_path).startswith(str(WORKSPACE.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileContent(path=path, content=full_path.read_text())


@router.put("/files/{path:path}")
async def write_file(path: str, file_content: FileContent) -> dict:
    full_path = (WORKSPACE / path).resolve()
    if not str(full_path).startswith(str(WORKSPACE.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(file_content.content)
    return {"status": "ok"}
