"""LangGraph graphs: the tool loop, the self-correcting loop, the orchestrator, the parallel coder.

Read them in this order; each one adds a node or an edge to the one before:

    tool_agent.py        Lesson 1   agent <-> tools, one conditional edge
    self_correcting.py   Lesson 2   generate -> execute -> retry; then with a reviewer
    orchestrator.py      Lesson 3   plan -> code -> test -> ai_review -> human_review -> apply -> verify
    parallel.py          Lesson 3   plan -> Send(code_file) x N -> collect

docs/ARCHITECTURE.md draws every one of them.
"""
