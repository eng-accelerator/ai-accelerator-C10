import httpx

from orion_agent import cli
from orion_agent.llm import FAST, STRONG


def make_root(tmp_path):
    (tmp_path / "sample_project").mkdir()
    (tmp_path / "sample_project" / "config.py").write_text("X = 1\n")
    (tmp_path / "sample_project" / "test_app.py").write_text("def test_x():\n    assert True\n")
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "generated").mkdir()
    (ws / "generated" / "junk.py").write_text("junk")
    (ws / "config.py").write_text("X = 999\n")
    return tmp_path


def test_reset_restores_workspace_from_sample_project(tmp_path):
    root = make_root(tmp_path)
    assert cli.main(["reset"], root=root) == 0
    assert sorted(p.name for p in (root / "workspace").iterdir()) == ["config.py", "test_app.py"]
    assert (root / "workspace" / "config.py").read_text() == "X = 1\n"


def test_reset_creates_workspace_if_missing(tmp_path):
    root = make_root(tmp_path)
    import shutil
    shutil.rmtree(root / "workspace")
    assert cli.main(["reset"], root=root) == 0
    assert (root / "workspace" / "config.py").exists()


def test_check_models_exit_code(monkeypatch, capsys):
    def handler(request):
        return httpx.Response(200, json={"data": [{"id": FAST}]})

    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    assert cli.main(["check-models"]) == 1
    assert STRONG in capsys.readouterr().out

    def all_present(request):
        return httpx.Response(200, json={"data": [{"id": FAST}, {"id": STRONG}]})

    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(all_present)))
    assert cli.main(["check-models"]) == 0


def test_doctor_reports_each_check(tmp_path, monkeypatch, capsys):
    root = make_root(tmp_path)
    (root / ".env").write_text("OPENROUTER_API_KEY=sk-or-test\n")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    def handler(request):
        if request.url.path.endswith("/auth/key"):
            return httpx.Response(200, json={"data": {"label": "orion", "usage": 1.0, "limit": None}})
        return httpx.Response(200, json={"data": [{"id": FAST}, {"id": STRONG}]})

    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    assert cli.main(["doctor"], root=root) == 0
    out = capsys.readouterr().out
    assert "OK" in out and "key" in out.lower() and "workspace" in out.lower()


def test_doctor_fails_without_a_key(tmp_path, monkeypatch, capsys):
    root = make_root(tmp_path)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(cli, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"data": []}))))
    assert cli.main(["doctor"], root=root) == 1
    assert ".env" in capsys.readouterr().out
