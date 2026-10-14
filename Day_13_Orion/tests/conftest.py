from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field


class ScriptedChatModel(BaseChatModel):
    """Chat model that replays queued AIMessages and records what it was asked."""

    responses: list[AIMessage]
    calls: list[list[BaseMessage]] = Field(default_factory=list)

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        self.calls.append(list(messages))
        if self.responses:
            msg = self.responses.pop(0)
        else:
            msg = AIMessage(content="(no scripted response left)")
        return ChatResult(generations=[ChatGeneration(message=msg)])

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self


class Scripted:
    """Stand-in for a structured-output runnable: returns outputs in order, repeats the last."""

    def __init__(self, *outputs: Any) -> None:
        self.outputs = list(outputs)
        self.prompts: list[str] = []

    def invoke(self, prompt: str, config: Any = None) -> Any:
        self.prompts.append(prompt)
        if len(self.outputs) > 1:
            return self.outputs.pop(0)
        return self.outputs[0]


@pytest.fixture
def ws_dir(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "app.py").write_text(
        'import streamlit as st\nfrom chat import stream_response\n\ndef main():\n    st.title("Chat")\n'
    )
    (ws / "chat.py").write_text(
        "\ndef stream_response(client, messages):\n    for chunk in client.stream(messages):\n        yield chunk\n"
    )
    (ws / "config.py").write_text('PAGE_TITLE = "My ChatBot"\nMODEL = "openai/gpt-4o-mini"\n')
    return ws
