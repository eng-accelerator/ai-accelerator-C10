"""Fetch the curated K8s docs subset listed in data_manifest.txt.

Idempotent: skips files that already exist locally. Safe to re-run.
"""
from __future__ import annotations

import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO_BASE = "https://raw.githubusercontent.com/kubernetes/website/main/"
HERE = Path(__file__).parent
MANIFEST = HERE / "data_manifest.txt"
OUT_DIR = HERE / "data" / "k8s-docs"


def parse_manifest() -> list[str]:
    paths: list[str] = []
    for line in MANIFEST.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        paths.append(line)
    return paths


def fetch_one(repo_path: str) -> tuple[str, bool, str]:
    rel = repo_path.split("content/en/docs/", 1)[-1]
    target = OUT_DIR / rel
    if target.exists() and target.stat().st_size > 0:
        return repo_path, True, "cached"
    target.parent.mkdir(parents=True, exist_ok=True)
    url = REPO_BASE + repo_path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "rag-session-fetcher"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            target.write_bytes(resp.read())
        return repo_path, True, "fetched"
    except Exception as exc:
        return repo_path, False, str(exc)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = parse_manifest()
    print(f"Fetching {len(paths)} K8s doc files into {OUT_DIR}")

    fetched = cached = failed = 0
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(fetch_one, p) for p in paths]
        for fut in as_completed(futs):
            path, ok, msg = fut.result()
            if ok and msg == "cached":
                cached += 1
            elif ok:
                fetched += 1
            else:
                failed += 1
                print(f"  FAIL {path}: {msg}", file=sys.stderr)

    on_disk = sum(1 for _ in OUT_DIR.rglob("*.md"))
    print(f"\nFetched {fetched} new, {cached} cached, {failed} failed.")
    print(f"Total .md files on disk: {on_disk}")
    if on_disk < 50:
        print("WARNING: fewer than 50 docs available — corpus may be too small for the session.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
