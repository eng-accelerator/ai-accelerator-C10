# Orion agent rules

This repository teaches how to build an AI coding agent with LangChain and LangGraph. Anyone editing it, human or agent, follows these rules.

## Environment
- Python is managed by uv. Run things with `uv run`, add packages with `uv add`. Never `pip install`.
- Secrets live in `.env`. Never commit one, never print one.
- Agent-generated files go under `workspace/`. Never write into `sample_project/`.

## Code
- Type hints on every function. Docstrings on public functions. Follow PEP 8.
- Prefer small modules with one job over large ones.
- Tests live in `tests/`, run offline, and use the stub model in `tests/conftest.py`.
- Run `uv run pytest` before you say a change is done.

## Files
- Do not create notebooks. Lessons are Python files with `# %%` cells.
- Do not edit `DESIGN.md`; it is the source of truth for anything visual.
