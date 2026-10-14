"""Chat models via OpenRouter.

For learners: OpenRouter is one API that fronts many model providers. One key
(`OPENROUTER_API_KEY`) works for GPT, Claude, Gemini, and the rest, and the model
is chosen by its id, such as "openai/gpt-4.1-mini". `get_llm` returns a LangChain
`ChatOpenAI` pointed at OpenRouter's OpenAI-compatible endpoint; nothing else in
the repo talks to a model directly.

Two ids are fixed here: FAST for the many cheap calls in Lessons 1 and 2, STRONG
for planning and review in Lesson 3. Change them in one place and every lesson,
the IDE, and the tests follow.
"""

from __future__ import annotations

import os

import httpx
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

BASE_URL = "https://openrouter.ai/api/v1"
FAST = "openai/gpt-4.1-mini"
STRONG = "anthropic/claude-sonnet-4.5"

# gpt-4o-mini has no ZDR tool-calling endpoints; OpenRouter returns 404 and
# langchain-openai wraps it as OpenAIModelNotFoundError.
_OPENROUTER_FALLBACKS = (
    "openai/gpt-4.1-mini",
    "google/gemini-2.5-flash",
    "anthropic/claude-haiku-4.5",
)


def get_llm(model: str = FAST, temperature: float = 0.0, api_key: str | None = None) -> ChatOpenAI:
    """Return a chat model pointed at OpenRouter, or raise if the key is missing."""
    key = api_key or os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.")
    fallbacks = [m for m in _OPENROUTER_FALLBACKS if m != model]
    return ChatOpenAI(
        model=model,
        api_key=key,
        base_url=BASE_URL,
        temperature=temperature,
        extra_body={"models": fallbacks, "route": "fallback"},
    )


def structured(llm: ChatOpenAI, schema: type) -> Runnable:
    """Wrap a model so it returns instances of `schema` instead of free text."""
    # function_calling is the one method every OpenRouter provider translates;
    # json_schema mode is OpenAI-only.
    return llm.with_structured_output(schema, method="function_calling")


def check_models(models: tuple[str, ...] = (FAST, STRONG), client: httpx.Client | None = None) -> list[str]:
    """Return the model IDs in `models` that OpenRouter does not list."""
    client = client or httpx.Client(timeout=15)
    data = client.get(f"{BASE_URL}/models").json()["data"]
    available = {m["id"] for m in data}
    return [m for m in models if m not in available]


def check_key(api_key: str | None, client: httpx.Client | None = None) -> dict:
    """Ask OpenRouter whether a key is valid. Never raises; the answer is a dict.

    Returns {"ok": bool, "message": str, "label": str, "usage": float | None, "limit": float | None}.
    """
    key = (api_key or "").strip()
    if not key:
        return {"ok": False, "message": "The key is empty.", "label": "", "usage": None, "limit": None}
    client = client or httpx.Client(timeout=15)
    try:
        response = client.get(f"{BASE_URL}/auth/key", headers={"Authorization": f"Bearer {key}"})
    except httpx.HTTPError as exc:
        return {"ok": False, "message": f"Could not reach OpenRouter: {exc}", "label": "", "usage": None, "limit": None}
    if response.status_code in (401, 403):
        return {"ok": False, "message": "OpenRouter says this key is not valid.", "label": "", "usage": None, "limit": None}
    if response.status_code != 200:
        return {"ok": False, "message": f"OpenRouter answered {response.status_code}.", "label": "", "usage": None, "limit": None}
    data = response.json().get("data", {})
    return {
        "ok": True,
        "message": "Key is valid.",
        "label": str(data.get("label") or ""),
        "usage": data.get("usage"),
        "limit": data.get("limit"),
    }
