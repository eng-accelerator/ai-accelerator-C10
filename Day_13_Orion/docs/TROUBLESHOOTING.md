# Troubleshooting

Start with `uv run orion doctor`. It checks the Python version, your key, the two model ids, and the workspace, and prints the fix for anything that fails. The rest of this page covers what doctor cannot see.

## Setup

**`OPENROUTER_API_KEY is not set`**
Copy `.env.example` to `.env` in the repository root and paste your key. The lessons load `.env` in `setup()`; the IDE backend loads it at start. If you put the key in the IDE's key screen instead, the lessons still need `.env`.

**`OpenRouter says this key is not valid`**
Keys start with `sk-or-v1-`. Copy the whole thing. A key with no credit on the account also fails on the first model call; add a few dollars at openrouter.ai.

**`No module named ipykernel_launcher` in Cursor**
Cursor picked the wrong Python. Command Palette, "Python: Select Interpreter", choose `.venv/bin/python` (Python 3.13). Then run the cell again.

**`Run this from inside the orion-tutorial repository`**
Open the repository folder itself in Cursor, not a parent folder and not `lessons/`. `setup()` walks up from the lesson file to find `pyproject.toml`.

**Python 3.14 was picked up instead of 3.13**
The project pins `>=3.13,<3.14`. `uv sync` creates `.venv` with 3.13 when it can find one; `uv python install 3.13` fetches it if not.

## Models

**`OpenAIModelNotFoundError` or a 404 from OpenRouter**
The model id is not available on your account or region. `get_llm` already sends a fallback list, so this is rare. `uv run orion check-models` says which of the two ids is missing; change `FAST` or `STRONG` in `src/orion_agent/llm.py`.

**A structured-output call returns garbage or raises a validation error**
Some cheap models do not follow the function-calling schema well. Switch the model for that lesson to `STRONG`, or in the IDE pick Claude Sonnet from the model list.

**The planner writes a plan for files that do not exist**
That is the point of `check_task_paths` and the path check after `plan`: a path outside `workspace/` ends the run with `path_rejected`. A path inside the workspace that does not exist yet is fine; the coder creates it.

## The human gate

**The website's playground says "human gate: pending" and nothing happens**
The curriculum site is static and cannot run a model; anything that looks like an agent run there is a recorded transcript. Approve and reject only work in the lessons (ch16) and in the local IDE (`uv run orion ide`).

**The agent paused and I closed the dialog**
The run is still waiting. Open the Agent panel and click **Open review**. Nothing is lost until you start a new run or restart the backend.

**I clicked approve and the status flashed back to "waiting"**
Fixed in this version. If you see it, you are running an older backend; restart it.

**`The agent is not waiting for a decision on this thread`**
The run already finished (look at the files in `workspace/`) or never paused. Start a new run. In the lessons, `pending_review(agent, config)` tells you which.

**`This run is not in memory (the backend restarted...)`**
Runs live in the backend process. If it restarted between the pause and your click, the paused graph is gone. Run the feature request again.

**I typed "Approve" in the lesson and it re-coded instead**
Also fixed. Decisions are normalised: `approve`, `yes`, `ok`, `True`, or the dict form all approve. Any other text is a reject with that text as the reason.

**I ran the feature-request cell twice**
The second run starts over on the same thread and pauses again. Approve or reject once; do not re-run C15. `pending_review` shows what is waiting.

## The IDE

**The page is blank at http://localhost:8000**
The frontend has not been built. Run `npm install && npm run build` in `orion-ide/frontend`, then restart `uv run orion ide`. For live-reloading development use `npm run dev` there and open http://localhost:5173 instead.

**`uvicorn is not installed`**
Run `uv sync --group ide`.

**Chat or agent returns `No OpenRouter API key`**
Neither the browser nor `.env` has a key. Click the key icon at the bottom of the activity bar.

**The explorer shows old files after a run**
Click the Explorer icon to refresh, or reload the page. The backend reads `workspace/` on every request.

## Lessons

**Lesson 3 cells are slow**
The strong model plans and reviews across three files. One feature takes one to three minutes. ch18's N0 cell replays the first feature only if ch16 did not run in the same kernel.

**ch14 N1 fails with a network error**
It calls the Parallel Search MCP server over the internet. It is the only cell that needs the network beyond OpenRouter; skip it if you are offline.

**The diff shows a line I did not ask to change, such as an emoji turned into `\u001f916`**
A cheaper model rewrote a line it should have copied. Reject with "keep every line you were not asked to change exactly as it is", or switch the model to Claude Sonnet for agent runs. The coder prompt already asks for this; the gate is where you catch the cases that slip.

**Tests fail with `SyntaxError` in a workspace file**
The agent wrote a broken file and you approved it, or a previous session left one. `uv run orion reset` restores the original three files.

**The generated code cannot `import diffusers` or another package**
Expected. The sandbox can import only what the repository environment has. ch09's hard task is designed to fail three times so you can see a give-up.
