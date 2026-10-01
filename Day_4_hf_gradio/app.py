from __future__ import annotations

import base64
import mimetypes
import os
from pathlib import Path
from typing import Any

import gradio as gr
from openai import OpenAI


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
MODEL_CHOICES = [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001",
    "anthropic/claude-3.5-haiku",
]
APP_TITLE = "Day 3 Vision Chat"


# cleans the model output
def clean_model_text(text: str) -> str:
    """Remove occasional chat-template tokens returned by some routed models."""
    for token in ("<s>", "<|im_start|>", "<|im_end|>", "<|OUT|>"):
        text = text.replace(token, "")
    return text


# returns the correct file path using the value passed
def get_file_path(file_value: Any) -> str | None:
    """Gradio file values can be strings, dictionaries, or tempfile-like objects."""
    if not file_value:
        return None
    if isinstance(file_value, str):
        return file_value
    if isinstance(file_value, dict):
        return file_value.get("path") or file_value.get("name")
    return getattr(file_value, "path", None) or getattr(file_value, "name", None)

# convert imgs so they can be processed by models
def image_file_to_data_url(file_path: str) -> str:
    path = Path(file_path)
    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type or not mime_type.startswith("image/"):
        raise ValueError(f"{path.name} is not a supported image file.")

    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def user_message_to_openrouter_content(message: dict[str, Any]) -> str | list[dict[str, Any]]:
    text = (message.get("text") or "").strip()
    files = message.get("files") or []

    content: list[dict[str, Any]] = []
    if text:
        content.append({"type": "text", "text": text})

    for file_value in files:
        file_path = get_file_path(file_value)
        if file_path:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_file_to_data_url(file_path)},
                }
            )

    if not content:
        return "Please send a message or upload an image."
    if len(content) == 1 and content[0]["type"] == "text":
        return content[0]["text"]
    if not text:
        content.insert(0, {"type": "text", "text": "Please analyze this image."})
    return content


def build_openrouter_messages(
    history: list[dict[str, Any]],
    current_message: dict[str, Any],
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []

    for item in history:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content.strip()})

    messages.append(
        {
            "role": "user",
            "content": user_message_to_openrouter_content(current_message),
        }
    )
    return messages


def stream_chat_response(
    message: dict[str, Any],
    history: list[dict[str, Any]],
    api_key: str,
    model: str,
    temperature: float,
    max_tokens: int,
):
    api_key = (api_key or os.getenv("OPENROUTER_API_KEY") or "").strip()
    model = (model or DEFAULT_MODEL).strip()

    if not api_key:
        yield "Set `OPENROUTER_API_KEY` in your environment or paste it in the API key box."
        return

    try:
        client = OpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=api_key,
            default_headers={
                "HTTP-Referer": "http://localhost:7860",
                "X-Title": APP_TITLE,
            },
        )
        response = client.chat.completions.create(
            model=model,
            messages=build_openrouter_messages(history, message),
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            extra_body={"provider": {"data_collection": "deny"}},
        )

        answer = ""
        for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                answer = clean_model_text(answer + delta)
                yield answer
    except Exception as exc:
        yield f"Error: {exc}"


def build_demo() -> gr.ChatInterface:
    api_key_input = gr.Textbox(
        label="OpenRouter API Key",
        type="password",
        value=os.getenv("OPENROUTER_API_KEY", ""),
    )
    model_input = gr.Dropdown(
        label="Model",
        choices=MODEL_CHOICES,
        value=DEFAULT_MODEL if DEFAULT_MODEL in MODEL_CHOICES else MODEL_CHOICES[0],
        allow_custom_value=True,
    )
    temperature_input = gr.Slider(
        label="Temperature",
        minimum=0,
        maximum=1,
        step=0.1,
        value=0.7,
    )
    max_tokens_input = gr.Slider(
        label="Max tokens",
        minimum=64,
        maximum=2048,
        step=64,
        value=512,
    )

    return gr.ChatInterface(
        fn=stream_chat_response,
        multimodal=True,
        title=APP_TITLE,
        textbox=gr.MultimodalTextbox(
            file_types=["image"],
            placeholder="Ask something, or upload an image and ask about it...",
        ),
        additional_inputs=[
            api_key_input,
            model_input,
            temperature_input,
            max_tokens_input,
        ],
        additional_inputs_accordion=gr.Accordion("OpenRouter settings", open=False),
    )


demo = build_demo()


if __name__ == "__main__":
    launch_kwargs: dict[str, Any] = {}
    if os.getenv("GRADIO_SHARE", "").lower() in {"1", "true", "yes"}:
        launch_kwargs["share"] = True
    if os.getenv("GRADIO_SERVER_PORT"):
        launch_kwargs["server_port"] = int(os.environ["GRADIO_SERVER_PORT"])
    demo.launch(**launch_kwargs)
