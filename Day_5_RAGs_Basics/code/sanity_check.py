"""Pre-session sanity check for the instructor.

Run with `python sanity_check.py` from the `code/` directory.
Verifies: env vars, OpenRouter reachability, dataset present, key packages importable.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).parent


def step(msg: str) -> None:
    print(f"  {msg}")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def fail(msg: str) -> None:
    print(f"  FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    section("Environment")
    env_path = HERE / ".env"
    if env_path.exists():
        try:
            from dotenv import load_dotenv

            load_dotenv(env_path)
            step(f"Loaded {env_path}")
        except ImportError:
            step("python-dotenv not installed yet, skipping .env load")

    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        fail("OPENROUTER_API_KEY not set. Put it in code/.env or export it.")
    step(f"OPENROUTER_API_KEY present (prefix {key[:8]}...)")

    section("OpenRouter reachability")
    try:
        from openai import OpenAI
    except ImportError:
        fail("openai package not installed. Run: pip install -r requirements.txt")

    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
    try:
        r = client.chat.completions.create(
            model="anthropic/claude-haiku-4.5",
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            max_tokens=8,
        )
    except Exception as exc:
        fail(f"OpenRouter call failed: {exc}")
    answer = (r.choices[0].message.content or "").strip()
    if "OK" not in answer.upper():
        fail(f"Unexpected reply from claude-haiku-4.5: {answer!r}")
    step(f"claude-haiku-4.5 replied: {answer!r}")

    section("Dataset")
    docs_dir = HERE / "data" / "k8s-docs"
    if not docs_dir.exists():
        fail(f"{docs_dir} missing. Run: python download_data.py")
    n = sum(1 for _ in docs_dir.rglob("*.md"))
    if n < 50:
        fail(f"Only {n} docs found, expected ~70. Re-run download_data.py")
    step(f"{n} K8s doc files present in {docs_dir}")

    section("Goldset")
    import json

    goldset_path = HERE / "goldset.json"
    gs = json.loads(goldset_path.read_text())
    n_q = len(gs.get("questions", []))
    if n_q < 30:
        fail(f"goldset.json has only {n_q} questions, expected 30")
    step(f"{n_q} questions in goldset.json")

    section("Package imports")
    pkgs = [
        ("llama_index.core", "llama-index-core"),
        ("llama_index.embeddings.huggingface", "llama-index-embeddings-huggingface"),
        ("llama_index.vector_stores.lancedb", "llama-index-vector-stores-lancedb"),
        ("llama_index.retrievers.bm25", "llama-index-retrievers-bm25"),
        ("lancedb", "lancedb"),
        ("sentence_transformers", "sentence-transformers"),
        ("rank_bm25", "rank-bm25"),
        ("ragas", "ragas"),
        ("langgraph", "langgraph"),
    ]
    missing: list[str] = []
    for mod, pip_name in pkgs:
        try:
            __import__(mod)
            step(f"{mod} OK")
        except ImportError:
            missing.append(pip_name)
            step(f"{mod} MISSING ({pip_name})")
    if missing:
        fail("Run: pip install " + " ".join(missing))

    print("\nAll checks passed. Ready to teach.")


if __name__ == "__main__":
    main()
