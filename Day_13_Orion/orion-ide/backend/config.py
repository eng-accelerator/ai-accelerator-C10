import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

WORKSPACE_PATH = str(REPO_ROOT / "workspace")
DEFAULT_MODEL = "openai/gpt-4.1-mini"
BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

AVAILABLE_MODELS = [
    {"id": "openai/gpt-4.1-mini", "name": "GPT-4.1 Mini", "description": "Fast and affordable"},
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast chat; tool calls may fail under ZDR"},
    {"id": "openai/gpt-4o", "name": "GPT-4o", "description": "Most capable GPT-4 model"},
    {"id": "anthropic/claude-sonnet-4.5", "name": "Claude Sonnet 4.5", "description": "Strong at multi-file changes"},
    {"id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash", "description": "Google's fast model"},
    {"id": "deepseek/deepseek-chat-v3-0324", "name": "DeepSeek V3", "description": "Strong coding model"},
]
