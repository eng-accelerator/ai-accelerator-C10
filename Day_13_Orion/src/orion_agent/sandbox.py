"""Run generated code with the common accidents prevented.

LocalSandbox is a jail, not a sandbox: it runs code in a temporary directory,
with a scrubbed environment, in isolated mode, with a timeout that returns
instead of raising. It does not block network access or limit CPU or memory.
Shipped coding agents use Seatbelt (macOS), bubblewrap (Linux), Docker, or a
microVM. Swap in DockerSandbox when you need that.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

_SAFE_ENV_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT")


@dataclass(frozen=True)
class ExecResult:
    """What a finished (or timed-out) subprocess left behind."""

    stdout: str
    stderr: str
    returncode: int
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        """True when the process exited cleanly and did not time out."""
        return self.returncode == 0 and not self.timed_out

    def summary(self) -> str:
        """Render the result as the text a model reads back as a tool result."""
        parts = [f"Exit code: {self.returncode}"]
        if self.timed_out:
            parts[0] += " (timed out)"
        if self.stdout:
            parts.append(f"STDOUT:\n{self.stdout.rstrip()}")
        if self.stderr:
            parts.append(f"STDERR:\n{self.stderr.rstrip()}")
        if len(parts) == 1:
            parts.append("(no output)")
        return "\n".join(parts)


class Sandbox(Protocol):
    """What the graphs need from a place to run code."""

    def run_python(self, code: str, *, timeout: float = 10, cwd: Path | None = None) -> ExecResult: ...

    def run(self, argv: list[str], *, cwd: Path | None = None, timeout: float = 30) -> ExecResult: ...


class LocalSandbox:
    """Runs code on this machine in isolated mode, with a scrubbed environment and a timeout."""

    def __init__(self, python: str | None = None) -> None:
        self.python = python or sys.executable

    @staticmethod
    def _env() -> dict[str, str]:
        return {k: os.environ[k] for k in _SAFE_ENV_KEYS if k in os.environ}

    def run(self, argv: list[str], *, cwd: Path | None = None, timeout: float = 30) -> ExecResult:
        """Run an argv list with no shell and return the result instead of raising."""
        auto_dir = None
        if cwd is None:
            auto_dir = Path(tempfile.mkdtemp(prefix="orion-sbx-"))
        workdir = Path(cwd) if cwd is not None else auto_dir
        try:
            proc = subprocess.run(
                list(argv),
                cwd=workdir,
                env=self._env(),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            return ExecResult(stdout=stdout, stderr=f"Timed out after {timeout}s", returncode=-1, timed_out=True)
        except FileNotFoundError as exc:
            return ExecResult(stdout="", stderr=str(exc), returncode=127)
        finally:
            if auto_dir is not None:
                shutil.rmtree(auto_dir, ignore_errors=True)
        return ExecResult(stdout=proc.stdout, stderr=proc.stderr, returncode=proc.returncode)

    def run_python(self, code: str, *, timeout: float = 10, cwd: Path | None = None) -> ExecResult:
        """Run a Python snippet, importable from `cwd`, and return the result instead of raising."""
        if cwd is None:
            return self.run([self.python, "-I", "-c", code], timeout=timeout)
        # The snippet lives in its own file so a first-line `from __future__ import ...` still
        # compiles. Isolated mode drops the working directory from sys.path, so put it back.
        workdir = Path(cwd).resolve()
        script_dir = Path(tempfile.mkdtemp(prefix="orion-snip-"))
        script = script_dir / "snippet.py"
        script.write_text(code)
        bootstrap = (
            "import pathlib, sys\n"
            f"sys.path.insert(0, {str(workdir)!r})\n"
            f"path = {str(script)!r}\n"
            "source = pathlib.Path(path).read_text()\n"
            "exec(compile(source, path, 'exec'), {'__name__': '__main__', '__file__': path})\n"
        )
        try:
            return self.run([self.python, "-I", "-c", bootstrap], cwd=workdir, timeout=timeout)
        finally:
            shutil.rmtree(script_dir, ignore_errors=True)


class DockerSandbox:
    """Placeholder for a real sandbox. Not implemented in this course.

    A working version runs `docker run --rm --network none -v <tmp>:/work python:3.13-slim`
    per call. Hosted options: E2B, Modal Sandboxes, Daytona.
    """

    def __init__(self, image: str = "python:3.13-slim") -> None:
        raise NotImplementedError("DockerSandbox is a stub. Use LocalSandbox, or implement this class.")
