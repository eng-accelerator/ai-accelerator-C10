"""LangChain tools over a Workspace and a Sandbox.

For learners: a tool is a plain function with the `@tool` decorator. The
decorator builds a schema from the function name, the type hints, and the
docstring. That schema is the only thing the model ever sees; it never reads
the body. So the docstring is prompt engineering: it is how the model chooses
between `read_file` and `list_directory`.

Every tool returns a string, including on failure ("Error: ..."), so a mistake
comes back to the model as something it can read and react to, not an
exception that kills the run.
"""

from __future__ import annotations

import sys

from langchain_core.tools import BaseTool, tool

from orion_agent.sandbox import Sandbox
from orion_agent.workspace import Workspace, WorkspaceError


def make_tools(ws: Workspace, sandbox: Sandbox) -> dict[str, BaseTool]:
    """Build every tool bound to one workspace and one sandbox, keyed by tool name."""

    @tool
    def read_file(filepath: str) -> str:
        """Read a file inside the workspace and return its contents."""
        try:
            return ws.read(filepath)
        except FileNotFoundError:
            return f"Error: file not found: {filepath}"
        except (WorkspaceError, OSError, UnicodeError) as exc:
            return f"Error: {exc}"

    @tool
    def write_file(filepath: str, content: str) -> str:
        """Write content to a file inside the workspace, creating directories as needed."""
        try:
            return f"File written: {ws.write(filepath, content)}"
        except (WorkspaceError, OSError, UnicodeError) as exc:
            return f"Error: {exc}"

    @tool
    def list_directory(directory: str = ".") -> str:
        """List the files and folders in a workspace directory."""
        try:
            entries = ws.list(directory)
        except (FileNotFoundError, NotADirectoryError):
            return f"Error: not a directory: {directory}"
        except WorkspaceError as exc:
            return f"Error: {exc}"
        return "\n".join(entries) if entries else "Empty directory"

    @tool
    def grep_files(pattern: str, glob: str = "**/*.py") -> str:
        """Search file contents with a regular expression. Returns path:line: text for each hit."""
        try:
            matches = ws.grep(pattern, glob=glob)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        if not matches:
            return "No matches."
        return "\n".join(f"{m.path}:{m.line}: {m.text}" for m in matches)

    @tool
    def glob_files(pattern: str) -> str:
        """Find files by name pattern, for example **/*.py or tests/*.py."""
        try:
            files = ws.glob(pattern)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        return "\n".join(files) if files else "No files match."

    @tool
    def run_python(code: str) -> str:
        """Run a Python snippet in the sandbox and return its output."""
        return sandbox.run_python(code, cwd=ws.root).summary()

    @tool
    def run_command(command: list[str], cwd: str = ".") -> str:
        """Run a command (as an argv list, no shell) inside a workspace directory."""
        try:
            workdir = ws.resolve(cwd)
        except WorkspaceError as exc:
            return f"Error: {exc}"
        argv = [sys.executable if command and command[0] in ("python", "python3") else command[0], *command[1:]]
        return sandbox.run(argv, cwd=workdir).summary()

    return {
        "read_file": read_file,
        "write_file": write_file,
        "list_directory": list_directory,
        "grep_files": grep_files,
        "glob_files": glob_files,
        "run_python": run_python,
        "run_command": run_command,
    }


def basic_tools(ws: Workspace) -> list[BaseTool]:
    """The three tools from Lesson 1: read, write, list."""
    from orion_agent.sandbox import LocalSandbox

    t = make_tools(ws, LocalSandbox())
    return [t["read_file"], t["write_file"], t["list_directory"]]
