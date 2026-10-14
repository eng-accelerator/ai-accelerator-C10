"""The `orion` command: setup chores for learners.

    uv run orion doctor         check the key, the models, and the workspace
    uv run orion reset          restore workspace/ from sample_project/
    uv run orion check-models   verify the two model ids exist on OpenRouter
    uv run orion ide            serve the Orion IDE backend (and the built frontend)
    uv run orion sync-web       copy web-tagged lesson cells into the site

Run `uv run orion doctor` first. It says exactly what is missing and how to fix it.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

import httpx

from dotenv import dotenv_values

from orion_agent.llm import FAST, STRONG, check_key, check_models
from orion_agent.workspace import Workspace

REPO_ROOT = Path(__file__).resolve().parents[2]


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=15)


def reset(root: Path) -> Path:
    """Copy sample_project/ into workspace/, wiping anything the agent left there."""
    ws = Workspace(root / "workspace")
    ws.reset(root / "sample_project")
    return ws.root


def _key_from(root: Path) -> tuple[str, str]:
    """Return (key, where it came from): the environment first, then root/.env."""
    from_env = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if from_env:
        return from_env, "environment"
    env_file = root / ".env"
    if env_file.exists():
        value = (dotenv_values(env_file).get("OPENROUTER_API_KEY") or "").strip()
        if value and value != "your_openrouter_key":
            return value, str(env_file)
    return "", ""


def doctor(root: Path, client: httpx.Client | None = None) -> int:
    """Print one line per check and return 0 when everything a learner needs is in place."""
    client = client or _http_client()
    failures = 0

    def report(ok: bool, name: str, detail: str) -> None:
        nonlocal failures
        failures += 0 if ok else 1
        print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")

    report(sys.version_info[:2] == (3, 13), "python", f"{sys.version.split()[0]} (the project pins 3.13)")

    key, source = _key_from(root)
    if not key:
        report(False, "api key", "OPENROUTER_API_KEY not set. Copy .env.example to .env and paste your key from https://openrouter.ai/settings/keys")
    else:
        info = check_key(key, client=client)
        extra = f", label {info['label']}" if info.get("label") else ""
        usage = info.get("usage")
        limit = info.get("limit")
        if info["ok"] and usage is not None:
            extra += f", spent ${usage:.2f}" + (f" of ${limit:.2f}" if limit else "")
        report(info["ok"], "api key", f"{info['message']} (from {source}{extra})")

    try:
        missing = check_models((FAST, STRONG), client=client)
        report(not missing, "models", f"{FAST}, {STRONG}" if not missing else "missing on OpenRouter: " + ", ".join(missing))
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        report(False, "models", f"could not list OpenRouter models: {exc}")

    ws = root / "workspace"
    expected = sorted(p.name for p in (root / "sample_project").iterdir()) if (root / "sample_project").exists() else []
    if not ws.exists() or not any(ws.iterdir()):
        report(False, "workspace", "empty. Run `uv run orion reset`")
    else:
        present = sorted(p.name for p in ws.iterdir() if p.name not in ("__pycache__", ".pytest_cache"))
        report(True, "workspace", f"{len(present)} entries: {', '.join(present)}" + ("" if present == expected else " (run `uv run orion reset` for a clean copy)"))

    node = shutil.which("node")
    report(True, "node", f"found at {node} (only needed for the IDE frontend)" if node else "not found; only needed for the IDE frontend")

    print("All good. Open lessons/README.md or run `uv run orion ide`." if failures == 0 else f"{failures} check(s) failed. Fix them in the order shown.")
    return 0 if failures == 0 else 1


def serve_ide(root: Path, host: str = "127.0.0.1", port: int = 8000) -> int:
    """Run the IDE backend with uvicorn. Serves the built frontend too when orion-ide/frontend/dist exists."""
    try:
        import uvicorn
    except ImportError:
        print("uvicorn is not installed. Run `uv sync --group ide` first.")
        return 1
    backend = root / "orion-ide" / "backend"
    if not backend.exists():
        print(f"IDE backend not found at {backend}")
        return 1
    sys.path.insert(0, str(backend))
    os.chdir(backend)
    dist = root / "orion-ide" / "frontend" / "dist"
    if dist.exists():
        print(f"Orion IDE: http://{host}:{port}")
    else:
        print(f"Backend only on http://{host}:{port}. For the UI, run `npm run build` in orion-ide/frontend (then restart)")
        print("or `npm run dev` there for a live-reloading frontend on http://localhost:5173.")
    uvicorn.run("main:app", host=host, port=port, log_level="info")
    return 0


def main(argv: list[str] | None = None, root: Path = REPO_ROOT) -> int:
    """Run one `orion` subcommand and return its exit code."""
    parser = argparse.ArgumentParser(prog="orion", description="Orion teaching kit commands")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor", help="check the API key, the models, and the workspace")
    sub.add_parser("reset", help="restore workspace/ from sample_project/")
    sub.add_parser("check-models", help="verify the model IDs exist on OpenRouter")
    sub.add_parser("sync-web", help="copy web-tagged lesson cells into the site's chapter files")
    ide = sub.add_parser("ide", help="serve the Orion IDE backend, and the frontend if it is built")
    ide.add_argument("--port", type=int, default=8000)
    ide.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args(argv)

    if args.command == "doctor":
        return doctor(root, client=_http_client())

    if args.command == "ide":
        return serve_ide(root, host=args.host, port=args.port)

    if args.command == "reset":
        path = reset(root)
        print(f"workspace restored at {path}")
        return 0

    if args.command == "check-models":
        missing = check_models((FAST, STRONG), client=_http_client())
        if missing:
            print("Missing on OpenRouter: " + ", ".join(missing))
            return 1
        print(f"OK: {FAST}, {STRONG}")
        return 0

    if args.command == "sync-web":
        import importlib.util

        spec = importlib.util.spec_from_file_location("sync_web_chapters", root / "scripts" / "sync_web_chapters.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for name in module.sync(root):
            print(f"synced {name}")
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
