# Lessons

Eighteen Python files in three folders. Each file is a chapter; each `# %%` line starts a cell. You run the cells one at a time, in order, and read the output next to the code. There are no notebooks: the same files run top to bottom as scripts too.

You can also read the chapters as prose on the [curriculum site](https://orion-tutorial-reader.vercel.app). The files here are its source, and the only place the agent actually runs.

| Lesson | Files | What it gives the agent |
|---|---|---|
| 1 Hands | `01_hands/ch01` to `ch07` | A model, tools, the agent loop, files, rules, streaming, memory |
| 2 Self-awareness | `02_self_awareness/ch08` to `ch12` | Typed output, a sandbox, retries on error, a reviewer, rules and skills, inline edits |
| 3 Brain | `03_brain/ch13` to `ch18` | Codebase search, MCP tools, a planner, three specialists, the human gate, parallel coders, time travel |

[docs/EVOLUTION.md](../docs/EVOLUTION.md) says what each chapter adds to the graph, in order.

## Before the first cell

```bash
uv sync
cp .env.example .env        # paste your OpenRouter key; see docs/BYOK_SETUP.md
uv run orion doctor         # key valid, models found, workspace ready
uv run orion reset          # copies sample_project/ into workspace/
```

Open the repository folder in Cursor (the folder that holds `pyproject.toml`, not `lessons/`). Pick the interpreter `.venv/bin/python` (Python 3.13) if Cursor asks: Command Palette, "Python: Select Interpreter".

## Running a cell

Put the cursor anywhere in a cell and press **Shift+Enter**. Cursor opens an interactive window and runs that cell there; the output appears beside the code. Press Shift+Enter again to run the next cell. Variables survive between cells, so run each file from the top.

To run a whole file as a script instead:

```bash
uv run python lessons/01_hands/ch03_agent_graph.py
```

Every file starts with `ROOT, ws = setup()`. That loads your `.env` and hands you the `workspace/` folder the agent may touch.

## Cell tags

`# %% C3` is the third cell of the original course notebook; `# %% N1` is a cell added in this version. A trailing `web` on a tag marks a cell whose code is shown on the curriculum site. The tags are only names; they do not change what runs.

## Things to know

- **ch07's last cell (C18) resets the workspace.** Run it only when you want a clean copy.
- **Lesson 3 uses the strong model and takes minutes per feature.** ch16 pauses and waits for you at C15; C17 is where you approve. Read [docs/HUMAN_IN_THE_LOOP.md](../docs/HUMAN_IN_THE_LOOP.md) first.
- **ch16, ch17, and ch18 share one agent** when they run in the same interactive window. If you restart the kernel between them, ch18 replays the first feature on its own (cell N0).
- **ch14 N1 needs the internet** beyond OpenRouter: it calls the Parallel Search MCP server. It works without a key.
- **You can run the chatbot the agent edits** with `uv run streamlit run workspace/app.py` and watch each feature appear.
- **The workspace is disposable.** `uv run orion reset` restores the original three files at any time.

## When something breaks

`uv run orion doctor`, then [docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md). Terms you do not know are in [docs/GLOSSARY.md](../docs/GLOSSARY.md).
