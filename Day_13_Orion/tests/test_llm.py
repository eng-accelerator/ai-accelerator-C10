import httpx
import pytest

from orion_agent.llm import BASE_URL, FAST, STRONG, check_models, get_llm, structured
from orion_agent.schemas import CodeOutput


def test_get_llm_requires_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        get_llm()


def test_get_llm_points_at_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    llm = get_llm(STRONG, temperature=0.2)
    assert llm.model_name == STRONG
    assert llm.temperature == 0.2
    assert str(llm.openai_api_base).rstrip("/") == BASE_URL
    assert llm.extra_body["route"] == "fallback"
    assert STRONG not in llm.extra_body["models"]
    assert FAST in llm.extra_body["models"]


def test_structured_uses_function_calling(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    runnable = structured(get_llm(), CodeOutput)
    assert runnable is not None  # ChatOpenAI raises on unsupported methods; construction is the check


def test_check_models_reports_missing_ids():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/models")
        return httpx.Response(200, json={"data": [{"id": FAST}]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert check_models(client=client) == [STRONG]
    assert check_models(models=(FAST,), client=client) == []


def test_check_key_reports_a_valid_key():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/auth/key")
        assert request.headers["Authorization"] == "Bearer sk-or-good"
        return httpx.Response(200, json={"data": {"label": "orion", "usage": 0.5, "limit": 10.0, "is_free_tier": False}})

    from orion_agent.llm import check_key

    info = check_key("sk-or-good", client=httpx.Client(transport=httpx.MockTransport(handler)))
    assert info["ok"] is True
    assert info["label"] == "orion"
    assert info["usage"] == 0.5 and info["limit"] == 10.0


def test_check_key_reports_an_invalid_or_missing_key():
    from orion_agent.llm import check_key

    def unauthorized(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "User not found."}})

    info = check_key("sk-or-bad", client=httpx.Client(transport=httpx.MockTransport(unauthorized)))
    assert info["ok"] is False and "not valid" in info["message"]
    assert check_key("", client=httpx.Client())["ok"] is False
    assert "empty" in check_key("   ", client=httpx.Client())["message"]


def test_check_key_reports_network_trouble_without_raising():
    from orion_agent.llm import check_key

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no network")

    info = check_key("sk-or-good", client=httpx.Client(transport=httpx.MockTransport(boom)))
    assert info["ok"] is False and "reach" in info["message"]
