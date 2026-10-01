from __future__ import annotations

import os
from typing import Any

import gradio as gr
from openai import OpenAI

from assignment_2_multimodal_messages import build_multimodal_messages


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-4o-mini"
APP_TITLE = "Basic Multimodal Chat"


def stream_basic_chat(
    message: dict[str, Any],
    history: list[dict[str, Any]],
    api_key: str,
):
    """Stream a multimodal response into Gradio."""
    api_key = (api_key or os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        yield "Add your OpenRouter API key first."
        return

    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)

    # TODO 1: call client.chat.completions.create with:
    # model=DEFAULT_MODEL
    # messages=build_multimodal_messages(history, message)
    # stream=True
    # extra_body={"provider": {"data_collection": "deny"}}
    response = None

    answer = ""
    for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            # TODO 2: add delta to answer and yield the growing answer.
            pass


def build_demo() -> gr.ChatInterface:
    """Create the basic Gradio app."""
    # TODO 3: return gr.ChatInterface with:
    # fn=stream_basic_chat
    # multimodal=True
    # title=APP_TITLE
    # textbox=gr.MultimodalTextbox(file_types=["image"])
    # additional_inputs=[gr.Textbox(label="OpenRouter API Key", type="password")]
    raise NotImplementedError


demo = build_demo()


if __name__ == "__main__":
    demo.launch()
