# Orion IDE

A small Cursor-like IDE that runs the same agent the lessons build: a chat with tools, an agent mode with a plan, tests, an AI review, and the human gate, plus panels for the repo's rules, skills, and checkpoint history. You bring your own OpenRouter key; the IDE asks for it on first load.

## Run

Build the frontend once, then one command serves everything:

```bash
cd orion-ide/frontend && npm install && npm run build && cd ../..
uv sync --group ide
uv run orion reset
uv run orion ide           # http://localhost:8000
```

For frontend development with live reload, run the backend the same way and the frontend separately:

```bash
cd orion-ide/frontend && npm run dev     # http://localhost:5173, proxies /api to :8000
```

## Your key

On first load the IDE opens the key screen if neither the browser nor the repo's `.env` has a key. Paste an OpenRouter key, click **Check** to have OpenRouter confirm it (you see its label and spend, never the key), and tick **Remember this key in this browser** to keep it in `localStorage`. The key rides along with each request to your local backend and is never stored server-side. The key icon at the bottom of the activity bar reopens the screen; its dot is green when a key is in place.

If `.env` has `OPENROUTER_API_KEY`, the IDE uses it and the key screen offers "use that one".

## Agent mode and the human gate

Type a feature request, click **Run Agent**, and watch the plan, the generated files, the tests, and the AI review stream in. The graph then pauses and the review dialog opens:

- **Diff / Full file** switches between a unified diff against the file on disk and the whole proposed file.
- **Approve and apply** writes the files into `workspace/` and runs the tests once more.
- **Reject** asks for a reason (required) and sends it to the coder verbatim. The loop runs again and pauses again.
- **X** hides the dialog. The run stays paused; **Open review** in the Agent panel brings it back, and so does reloading the page.
- **Reset workspace** restores `workspace/` from `sample_project/`.

Runs live in the backend process. If you restart it while a run is paused, the paused graph is gone; run the feature again. [docs/HUMAN_IN_THE_LOOP.md](../docs/HUMAN_IN_THE_LOOP.md) explains the mechanism.

## What is where

| Panel | Backed by |
|---|---|
| Explorer | `workspace/`, the copy of `sample_project/` that `orion reset` makes |
| Agent | `orion_agent.graphs.orchestrator` through `backend/agent/graph.py` |
| Review dialog | the `interrupt()` payload from `review_payload`, resumed through `/api/agent/approve` |
| Rules | `AGENTS.md` and `.cursor/rules/*.mdc`, through `/api/rules` |
| Skills | `.cursor/skills/*/SKILL.md`, through `/api/skills` |
| Time travel | the graph's checkpoint history, through `/api/agent/history` |
| Chat | `orion_agent.graphs.tool_agent` with every tool, the rules, and the skills catalog |
| Terminal | `orion_agent.sandbox.LocalSandbox` (argv only, no shell) |
| Key screen | `/api/key/status` and `/api/key/check` |

The backend has no agent logic of its own. Change the package and the IDE changes with it.

## API

| Route | Does |
|---|---|
| `POST /api/agent/run` | Starts a run; streams SSE events: `status`, `plan`, `code`, `test`, `review`, `skill_loaded`, `approval_needed`, then `paused` or `done` |
| `POST /api/agent/approve` | Resumes a paused run with `{thread_id, decision, feedback}`; 404 if the run is not in memory, 409 if it is not paused, 422 for a reject with no reason |
| `GET /api/agent/pending/{thread_id}` | `{waiting, review}`: the gate payload if the thread is paused |
| `GET /api/agent/history/{thread_id}` | Every checkpoint of the thread |
| `POST /api/chat` | The tool-agent chat, streamed |
| `GET /api/key/status`, `POST /api/key/check` | Whether `.env` has a key; validate a pasted key |
| `POST /api/workspace/reset` | Same as `uv run orion reset` |
| `GET/PUT /api/files/...`, `/api/rules/...`, `/api/skills/...` | The explorer, rules, and skills panels |

## Tests

```bash
uv run --group ide pytest orion-ide/backend/tests
```

The agent-flow tests drive run, reject, approve, double-approve, and unknown-thread through the HTTP API with scripted models, so no key is needed.
