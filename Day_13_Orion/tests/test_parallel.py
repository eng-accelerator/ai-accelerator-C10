from orion_agent.graphs.parallel import build_parallel_agent
from orion_agent.schemas import CodeResult, FileTask, Plan
from orion_agent.workspace import Workspace
from tests.conftest import Scripted

PLAN = Plan(summary="two files", file_tasks=[
    FileTask(filepath="config.py", description="add A", action="modify"),
    FileTask(filepath="chat.py", description="add B", action="modify"),
])


def test_fans_out_one_coder_per_file(ws_dir):
    coder = Scripted(CodeResult(filepath="x", code="X = 1\n", explanation="e"))
    result = build_parallel_agent(Scripted(PLAN), coder, Workspace(ws_dir)).invoke({"feature_request": "add stuff"})
    assert sorted(g["filepath"] for g in result["generated_code"]) == ["chat.py", "config.py"]
    assert len(coder.prompts) == 2
    assert result["status"] == "collected"
    assert (ws_dir / "config.py").read_text().startswith("PAGE_TITLE")  # nothing written to disk
