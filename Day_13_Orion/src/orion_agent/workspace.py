"""A directory the agent may touch, and nothing outside it.

For learners: this is the first safety rule of a coding agent. Every path a
tool receives goes through `Workspace.resolve`, which turns it into an absolute
path and raises `WorkspaceError` if the result would land outside the root.
`../secrets.txt` and `/etc/passwd` never reach the filesystem. The lessons use
`workspace/`, a copy of `sample_project/` that `uv run orion reset` remakes.
"""

from __future__ import annotations

import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

_SKIP_DIRS = {"__pycache__", ".git", ".venv", "node_modules"}


class WorkspaceError(Exception):
    """Raised when a path would leave the workspace."""


@dataclass(frozen=True)
class Match:
    """One line of one file that matched a search."""

    path: str
    line: int
    text: str


class Workspace:
    """A rooted directory with read, write, and search helpers that refuse to leave it."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve(self, rel: str) -> Path:
        """Turn a workspace-relative path into an absolute one, or raise WorkspaceError."""
        candidate = Path(rel)
        if candidate.is_absolute():
            raise WorkspaceError(f"absolute paths are not allowed: {rel}")
        full = (self.root / candidate).resolve()
        if full != self.root and self.root not in full.parents:
            raise WorkspaceError(f"path escapes the workspace: {rel}")
        return full

    def relative(self, full: Path) -> str:
        """Turn an absolute path inside the workspace back into a relative one."""
        return full.relative_to(self.root).as_posix()

    def read(self, rel: str) -> str:
        """Return the text of a file in the workspace."""
        return self.resolve(rel).read_text()

    def write(self, rel: str, text: str) -> str:
        """Write text to a file in the workspace, creating parents, and return its relative path."""
        full = self.resolve(rel)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(text)
        return self.relative(full)

    def list(self, rel: str = ".") -> list[str]:
        """List a directory's visible entries, each tagged [DIR] or [FILE]."""
        full = self.resolve(rel)
        entries = []
        for entry in sorted(full.iterdir(), key=lambda p: (p.is_file(), p.name)):
            if entry.name.startswith(".") or entry.name in _SKIP_DIRS:
                continue
            prefix = "[DIR]" if entry.is_dir() else "[FILE]"
            entries.append(f"{prefix} {entry.name}")
        return entries

    def glob(self, pattern: str) -> list[str]:
        """Return the relative paths of the files matching a pattern, sorted."""
        if pattern.startswith("/") or ".." in Path(pattern).parts:
            raise WorkspaceError(f"glob pattern must stay inside the workspace: {pattern}")
        out = []
        for p in self.root.glob(pattern):
            if p.is_file() and not (_SKIP_DIRS & set(p.relative_to(self.root).parts)):
                out.append(self.relative(p))
        return sorted(out)

    def grep(self, pattern: str, glob: str = "**/*.py", ignore_case: bool = True) -> list[Match]:
        """Search the matching files line by line for a regular expression."""
        flags = re.IGNORECASE if ignore_case else 0
        rx = re.compile(pattern, flags)
        matches = []
        for rel in self.glob(glob):
            for number, line in enumerate(self.read(rel).splitlines(), start=1):
                if rx.search(line):
                    matches.append(Match(path=rel, line=number, text=line.rstrip()))
        return matches

    def snapshot(self) -> Path:
        """Copy the workspace into a fresh temporary directory and return it."""
        target = Path(tempfile.mkdtemp(prefix="orion-ws-"))
        shutil.copytree(self.root, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*_SKIP_DIRS))
        return target

    def reset(self, from_dir: str | Path) -> None:
        """Empty the workspace and refill it from another directory."""
        for child in self.root.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        shutil.copytree(Path(from_dir), self.root, dirs_exist_ok=True, ignore=shutil.ignore_patterns(*_SKIP_DIRS))
