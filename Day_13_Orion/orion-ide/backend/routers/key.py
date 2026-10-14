"""Bring your own key: is there a server key, and is the key you typed valid?

The key you paste in the browser is sent with each request and never stored on
the server. /key/check forwards it once to OpenRouter's /auth/key endpoint and
returns only the verdict, the key's label, and its spend.
"""

import httpx
from fastapi import APIRouter

from config import OPENROUTER_API_KEY
from models.schemas import KeyCheckRequest
from orion_agent.llm import check_key

router = APIRouter(prefix="/key", tags=["key"])


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=15)


@router.get("/status")
async def key_status() -> dict:
    """Whether the backend found OPENROUTER_API_KEY in .env. Never returns the key itself."""
    return {"server_key": bool(OPENROUTER_API_KEY), "server_key_valid": None}


@router.post("/check")
async def key_check(request: KeyCheckRequest) -> dict:
    """Validate a key against OpenRouter and report label and spend, never the key."""
    return check_key(request.api_key, client=_http_client())
