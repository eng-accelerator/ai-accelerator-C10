from __future__ import annotations

import os
from typing import Any

import gradio as gr
from openai import OpenAI

from assignment_2_multimodal_messages import build_multimodal_messages


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-4o-mini"
MODEL_CHOICES = [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001",
    "anthropic/claude-3.5-haiku",
]
APP_TITLE = "Advanced Multimodal Chat"


def stream_advanced_chat(
    message: dict[str, Any],
    history: list[dict[str, Any]],
    api_key: str,
    model: str,
    temperature: float,
    max_tokens: int,
):
    """Stream a configurable multimodal response into Gradio."""
    api_key = (api_key or os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        yield "Add your OpenRouter API key first."
        return

    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)

    # TODO 1: call client.chat.completions.create with:
    # model=(model or DEFAULT_MODEL).strip()
    # messages=build_multimodal_messages(history, message)
    # temperature=temperature
    # max_tokens=max_tokens
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
    """Create the advanced Gradio app with configurable controls."""
    api_key_input = gr.Textbox(label="OpenRouter API Key", type="password")

    # TODO 3: create a gr.Dropdown for model selection using MODEL_CHOICES.
    model_input = None

    # TODO 4: create a gr.Slider for temperature from 0 to 1.5.
    temperature_input = None

    # TODO 5: create a gr.Slider for max tokens from 64 to 2048.
    max_tokens_input = None

    # TODO 6: return gr.ChatInterface with multimodal=True and all four inputs.
    raise NotImplementedError


demo = build_demo()


if __name__ == "__main__":
    demo.launch()
