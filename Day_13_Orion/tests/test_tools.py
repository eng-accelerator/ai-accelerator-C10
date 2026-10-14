from orion_agent.sandbox import LocalSandbox
from orion_agent.tools import basic_tools, make_tools
from orion_agent.workspace import Workspace


def test_basic_tools_names_and_schemas(ws_dir):
    tools = basic_tools(Workspace(ws_dir))
    assert [t.name for t in tools] == ["read_file", "write_file", "list_directory"]
    assert "filepath" in tools[0].args_schema.model_json_schema()["properties"]


def test_read_write_list(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert t["write_file"].invoke({"filepath": "generated/a.py", "content": "print(1)\n"}) == "File written: generated/a.py"
    assert t["read_file"].invoke({"filepath": "generated/a.py"}) == "print(1)\n"
    assert "[DIR] generated" in t["list_directory"].invoke({"directory": "."})


def test_escape_is_an_error_string_not_an_exception(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    out = t["read_file"].invoke({"filepath": "../secret.txt"})
    assert out.startswith("Error:")


def test_missing_file_is_an_error_string(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert t["read_file"].invoke({"filepath": "nope.py"}).startswith("Error: file not found")


def test_read_file_on_a_directory_is_an_error_string(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    (ws_dir / "pkg").mkdir()
    assert t["read_file"].invoke({"filepath": "pkg"}).startswith("Error:")


def test_write_file_on_a_directory_is_an_error_string(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert t["write_file"].invoke({"filepath": ".", "content": "x"}).startswith("Error:")


def test_grep_and_glob(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert "chat.py:2:" in t["grep_files"].invoke({"pattern": "def stream_response"})
    assert t["grep_files"].invoke({"pattern": "zzz_no_match"}) == "No matches."
    assert t["glob_files"].invoke({"pattern": "*.py"}) == "app.py\nchat.py\nconfig.py"


def test_run_python_and_run_command(ws_dir):
    t = make_tools(Workspace(ws_dir), LocalSandbox())
    assert "hello" in t["run_python"].invoke({"code": "print('hello')"})
    out = t["run_command"].invoke({"command": ["python", "-c", "import config; print(config.PAGE_TITLE)"], "cwd": "."})
    assert "My ChatBot" in out
