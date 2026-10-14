from langchain_core.messages import AIMessage, HumanMessage

from orion_agent import __version__
from tests.conftest import Scripted, ScriptedChatModel


def test_version():
    assert __version__ == "0.1.0"


def test_scripted_chat_model_replays_and_records():
    model = ScriptedChatModel(responses=[AIMessage(content="one"), AIMessage(content="two")])
    assert model.invoke([HumanMessage(content="a")]).content == "one"
    assert model.invoke([HumanMessage(content="b")]).content == "two"
    assert len(model.calls) == 2


def test_scripted_repeats_last_output():
    s = Scripted(1, 2)
    assert [s.invoke("p1"), s.invoke("p2"), s.invoke("p3")] == [1, 2, 2]
    assert s.prompts == ["p1", "p2", "p3"]
