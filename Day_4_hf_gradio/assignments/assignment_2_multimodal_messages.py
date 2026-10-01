from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
from typing import Any


def image_file_to_data_url(file_path: str) -> str:
    """Convert an image file path into a base64 data URL."""
    path = Path(file_path)
    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type or not mime_type.startswith("image/"):
        raise ValueError("Please provide a supported image file.")

    # TODO 1: read the image bytes.
    # TODO 2: base64 encode the bytes and decode to text.
    # TODO 3: return f"data:{mime_type};base64,{encoded_text}".
    raise NotImplementedError


def get_uploaded_file_path(file_value: Any) -> str | None:
    """Normalize common Gradio file values into a path string."""
    # TODO 4: if file_value is a string, return it.
    # TODO 5: if file_value is a dict, return file_value["path"] or file_value["name"].
    # TODO 6: otherwise try file_value.path or file_value.name.
    raise NotImplementedError


def build_user_content(message: dict[str, Any]) -> str | list[dict[str, Any]]:
    """Convert Gradio multimodal input into OpenRouter user content."""
    text = (message.get("text") or "").strip()
    files = message.get("files") or []

    content: list[dict[str, Any]] = []
    if text:
        content.append({"type": "text", "text": text})

    for file_value in files:
        file_path = get_uploaded_file_path(file_value)
        if file_path:
            # TODO 7: append an image_url content block.
            # Shape:
            # {"type": "image_url", "image_url": {"url": image_file_to_data_url(file_path)}}
            pass

    if not content:
        return "Please send text or upload an image."
    if len(content) == 1 and content[0]["type"] == "text":
        return content[0]["text"]
    if not text:
        content.insert(0, {"type": "text", "text": "Please analyze this image."})
    return content


def build_multimodal_messages(
    history: list[dict[str, Any]],
    current_message: dict[str, Any],
) -> list[dict[str, Any]]:
    """Build messages for a vision-capable OpenRouter chat model."""
    messages: list[dict[str, Any]] = []

    for item in history:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            # TODO 8: append prior text messages.
            pass

    # TODO 9: append the latest user message using build_user_content(current_message).
    return messages
