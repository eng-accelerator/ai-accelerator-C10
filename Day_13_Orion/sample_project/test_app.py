"""Tests the agent runs before and after it changes this project."""

from types import SimpleNamespace

import config
from chat import get_client, stream_response


def test_config_points_at_openrouter() -> None:
    assert config.MODEL
    assert config.BASE_URL.startswith("https://")


def test_get_client_uses_the_configured_base_url() -> None:
    client = get_client("test-key")
    assert str(client.base_url).startswith(config.BASE_URL)


def test_stream_response_yields_only_text_chunks() -> None:
    class FakeStream:
        def __iter__(self):
            for text in ("Hel", "lo", None):
                yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: FakeStream())))
    assert "".join(stream_response(fake_client, [{"role": "user", "content": "hi"}])) == "Hello"
