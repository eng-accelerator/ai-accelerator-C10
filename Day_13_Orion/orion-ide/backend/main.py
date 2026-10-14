"""The Orion IDE backend: a FastAPI app over the orion_agent package.

Start it with `uv run orion ide` from the repo root (or uvicorn directly, see
orion-ide/README.md). Every route lives in routers/; none of them contains agent
logic. If orion-ide/frontend/dist exists (after `npm run build`), it is served
at / so one process is the whole IDE.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import AVAILABLE_MODELS, REPO_ROOT, WORKSPACE_PATH
from models.schemas import ModelInfo
from routers.agent import router as agent_router
from routers.chat import router as chat_router
from routers.files import router as files_router
from routers.key import router as key_router
from routers.rules import router as rules_router
from routers.skills import router as skills_router
from routers.terminal import router as terminal_router
from routers.workspace import router as workspace_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Orion backend started")
    Path(WORKSPACE_PATH).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Orion", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(terminal_router, prefix="/api")
app.include_router(rules_router, prefix="/api")
app.include_router(skills_router, prefix="/api")
app.include_router(key_router, prefix="/api")
app.include_router(workspace_router, prefix="/api")

models_router = APIRouter(tags=["models"])


@models_router.get("/models")
async def list_models() -> list[ModelInfo]:
    return [ModelInfo(**m) for m in AVAILABLE_MODELS]


app.include_router(models_router, prefix="/api")

FRONTEND_DIST = REPO_ROOT / "orion-ide" / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
