# Orion reframe: notebooks to Python, rules, skills, web search

Date: 2026-09-04. Author: Dileep with Claude. Status: draft for review.

## 1. Goal

Rebuild the Day 13 "Build an AI Coding Agent" material so that:

1. The three notebooks become plain Python that Dileep teaches from Cursor, cell by cell, in the same beat order as the existing instructor script.
2. The code has one implementation. The lessons, the Orion IDE demo app, and the web curriculum all read from a single package.
3. The audit bugs are fixed: reviewer feedback reaches the coder, human rejects reset the counters and carry a reason, timeouts count as failures, file tools are jailed to a workspace, the restore cell restores.
4. The framing matches how coding agents are built in September 2026: agentic search over grep and glob rather than embeddings, tests as the verification primitive, rules in `.cursor/rules/*.mdc` and `AGENTS.md`, skills in `.cursor/skills/*/SKILL.md`, a sandboxed execute tool, and tools from an MCP server.
5. The agent gains web research through the Parallel Search MCP server.
6. The Orion IDE gets Rules and Skills tabs and shows skill loads in its trace.

### Constraints

- Delivery machine has uv but no conda and no Docker. The project is a uv project. The sandbox is a local jail, with a Docker backend left as a stub.
- Every SHOW line in the instructor script that names a notebook cell (for example "NB1 C3") must still resolve to one runnable cell. Cell numbers are preserved as tags.
- The web app at orion-tutorial.vercel.app keeps its 18 chapters and URLs. Only text and code strings change.
- Python only, taught live. Dileep runs the lesson files in Cursor and learners watch, the same format as the original session. There are no notebooks and no Colab links. `lessons/README.md` is the instructor's setup and run-of-files page. Whether the repo is shared with learners afterwards is Dileep's call and does not affect the design.
- This is a fresh build for a new cohort, not an upgrade. Nothing in the repo or the site refers to a previous version, to Ishan's session, or to what changed.
- The curriculum site ships from Dileep's fork (github.com/kvsdileep/orion-tutorial) on Dileep's Vercel account. Dileep does the Vercel import from Cursor; the repo carries everything the import needs.
- The frontend build of the Orion IDE is not taught. The transcript shows Ishan spent about five minutes at beat 58 describing his process and withheld the code. IDE changes are demo chrome and stay small.

## 2. Repository layout

```
orion-tutorial/
  pyproject.toml                 uv project; `orion` console script; python 3.13 pinned in .python-version
  .env.example                   OPENROUTER_API_KEY, PARALLEL_API_KEY (optional)
  AGENTS.md                      repo rules, read by the agent, Cursor, Claude Code, Codex
  DESIGN.md                      the frontend design system, verbatim as supplied
  .cursor/
    mcp.json                     Parallel Search MCP for Cursor
    rules/
      python.mdc                 globs **/*.py; the expert-Python conventions from NB1 C11
      tests.mdc                  globs tests/**/*.py, **/test_*.py; the STRICT_RULES set from NB2 C23
      frontend-design.mdc        globs **/*.tsx, **/*.css; short principles plus @DESIGN.md reference
    skills/
      add-feature/SKILL.md       plan, code, test, review checklist (the NB3 workflow)
      web-research/SKILL.md      search first, fetch only the winners, cite URLs
      frontend-design/SKILL.md   paths **/*.tsx; read DESIGN.md, list the states to check
      commit-deploy/SKILL.md     disable-model-invocation; run tests, commit, deploy (beat 58 material)
  sample_project/                app.py, chat.py, config.py; source of truth, never edited by the agent
  workspace/                     gitignored; `orion reset` copies sample_project here; lessons and IDE work here
  src/orion_agent/               the package (section 3)
  lessons/                       one Python file per web chapter, `# %%` cells (section 4)
    01_hands/ch01 … ch07
    02_self_awareness/ch08 … ch12
    03_brain/ch13 … ch18
    README.md
  orion-ide/                     moved from Notebooks/orion; backend imports orion_agent (section 8)
  web/                           Next.js curriculum; chapter strings synced from lessons (section 9)
  scripts/sync_web_chapters.py
  tests/                         pytest, stub chat model, no network (section 10)
  docs/superpowers/specs/        this file
```

Removed: `Notebooks/` (notebooks, CONTENTS.md, README.md, test.csv, `sample_project/config.py.bak`). `lessons/README.md` is written fresh for the instructor: setup, how to run a cell, the three lessons with one line each, and the pre-session checklist.

## 3. Package: `orion_agent`

Each module has one job, a small public surface, and no dependency on the lessons or the IDE.

| Module | Does | Public interface | Depends on |
|---|---|---|---|
| `llm.py` | Builds chat models via OpenRouter. Holds the model registry. | `get_llm(model: str = FAST, temperature=0) -> ChatOpenAI`; `FAST`, `STRONG` constants; `check_models() -> list[str]` returns registry IDs missing from `GET /api/v1/models` | langchain-openai, httpx |
| `workspace.py` | Root-jailed filesystem. Every path is resolved against the root; escapes raise `WorkspaceError`. | `Workspace(root)`: `.resolve(rel)`, `.read(rel)`, `.write(rel, text)`, `.list(rel=".")`, `.glob(pattern)`, `.grep(pattern, glob="**/*.py") -> list[Match]`, `.snapshot() -> Path` (copy to temp dir), `.reset(from_dir)` | stdlib |
| `sandbox.py` | Runs code and commands without touching the host beyond a temp cwd. | `ExecResult(stdout, stderr, returncode, timed_out)`; `Sandbox` protocol with `run_python(code, timeout=10)` and `run(argv, cwd, timeout=30)`; `LocalSandbox` (uses `sys.executable -I`, temp cwd, scrubbed env with only PATH and HOME, `TimeoutExpired` caught and returned as `timed_out=True, returncode=-1`); `DockerSandbox` raises `NotImplementedError` with a comment pointing at the Docker and E2B options | stdlib |
| `tools.py` | LangChain tools over a Workspace and a Sandbox. | `make_tools(ws, sandbox) -> dict[str, BaseTool]` with keys `read_file`, `write_file`, `list_directory`, `grep_files`, `glob_files`, `run_python`, `run_command`; `basic_tools(ws)` returns the NB1 three | workspace, sandbox, langchain-core |
| `rules.py` | Loads layered rules the way Cursor does. | `load_rules(root, for_path: str | None = None) -> str`; `Rule(name, description, globs, always_apply, body, source)`; `list_rules(root) -> list[Rule]`. Order: every `AGENTS.md` from root to the target's directory, closest last; then `.cursor/rules/*.mdc` with `alwaysApply: true`; then `.mdc` whose globs match `for_path`. `@file` references inside a rule body are inlined once. | pyyaml |
| `skills.py` | Discovers skills and exposes them on demand. | `Skill(name, description, paths, path)`; `load_skills(root) -> list[Skill]` scans `.cursor/skills/**/SKILL.md` and `.claude/skills/**/SKILL.md`; `skills_catalog(skills, for_path=None) -> str` gives name and description lines for the system prompt, filtered by `paths`; `make_read_skill_tool(skills) -> BaseTool` named `read_skill(name)` returning the body | pyyaml, langchain-core |
| `mcp.py` | Tools from MCP servers. | `PARALLEL_SEARCH_URL = "https://search.parallel.ai/mcp"`; `get_mcp_tools() -> list[BaseTool]` builds `MultiServerMCPClient` with transport `http`, adds `Authorization: Bearer $PARALLEL_API_KEY` when set, returns `web_search` and `web_fetch`. Tools are async; callers use `ainvoke`. | langchain-mcp-adapters |
| `search.py` | Agentic codebase search for the lesson and the planner. | `search_codebase(ws, query) -> str` runs grep for each query word, ranks files by hit count, returns file plus matching lines; `repo_map(ws) -> str` lists files with top-level defs via `ast` | workspace |
| `embeddings.py` | The historical alternative, kept as a footnote. | `build_index(ws, embeddings) -> InMemoryVectorStore`; `semantic_search(store, query, k=3)` | langchain-core, langchain-openai |
| `schemas.py` | Pydantic models shared by graphs. | `CodeOutput(code, explanation)`, `ReviewResult(approved, feedback)`, `FileTask(filepath, description, action)`, `Plan(summary, file_tasks)`, `CodeResult(filepath, code, explanation)` | pydantic |
| `graphs/tool_agent.py` | NB1 loop. | `build_tool_agent(llm, tools, system_prompt=None, checkpointer=None) -> CompiledGraph` over `MessagesState`; `prebuilt_agent(llm, tools, system_prompt)` wraps `langchain.agents.create_agent` | langgraph |
| `graphs/self_correcting.py` | NB2 loops. | `AgentState`, `FullAgentState`; `build_bugbot(llm, sandbox, max_attempts=3)`; `build_full_agent(llm, sandbox, max_attempts=3)` with reviewer; `rules` field read from state and injected by `generate` | sandbox, schemas |
| `graphs/orchestrator.py` | NB3 graph (section 6). | `OrchestratorState`; `build_orchestrator(planner_llm, coder_llm, reviewer_llm, ws, sandbox, tools, skills, checkpointer) -> CompiledGraph` | everything above |
| `graphs/parallel.py` | NB3 Send fan-out. | `ParallelState`, `SingleFileState`, `build_parallel_agent(...)` | orchestrator nodes |
| `cli.py` | `orion` command. | `check-models`, `reset` (sample_project to workspace), `sync-web` | argparse |

Structured output everywhere passes `method="function_calling"` with a one-line comment on why (portability across OpenRouter providers).

Models: `FAST` is the gpt-4o-mini ID and `STRONG` is the current Claude Sonnet ID on OpenRouter. Both exact IDs are confirmed by running `orion check-models` during implementation and again the day before delivery.

## 4. Lessons

One file per web chapter. Every runnable cell starts with `# %% C<n> <label>` where `<n>` is the original notebook cell number, so the instructor script's SHOW lines resolve unchanged. New cells that did not exist in the notebooks are tagged `# %% N<n>`. Cells whose code should appear on the web chapter page carry a trailing `web` marker: `# %% C3 three tools web`.

Each file has a `# %% setup` cell that imports from the package, loads `.env`, and points `Workspace` at `workspace/`. Files run top to bottom with `uv run python lessons/…/chXX.py` and cell by cell in Cursor's interactive window (Shift+Enter on a `# %%` cell; `ipykernel` is a dev dependency for this). `lessons/README.md` covers setup on the teaching machine, the `.env` keys, the two ways to run, `orion reset`, and `orion check-models`. Async cells use top-level `await`; when run as a script the file wraps them in `asyncio.run` through a tiny `run()` helper in the setup cell.

### Cell map

| Chapter file | Original cells | Content and changes |
|---|---|---|
| `01_hands/ch01_llm_setup.py` | NB1 C1, C2 | Unchanged. |
| `01_hands/ch02_tools.py` | NB1 C3 | `basic_tools(ws)`; prints name, description, schema. Paths are relative to `workspace/`. |
| `01_hands/ch03_agent_graph.py` | NB1 C4–C8 | `build_tool_agent`. N1 at the end: `prebuilt_agent` as "what you just built, prebuilt". |
| `01_hands/ch04_code_generation.py` | NB1 C9, C10 | Unchanged; writes `workspace/generated/calculator.py`. |
| `01_hands/ch05_rules.py` | NB1 C11, C12 | `SYSTEM_PROMPT` now comes from `load_rules(root, "workspace/generated/data_processor.py")`. N1 prints which files contributed. |
| `01_hands/ch06_streaming.py` | NB1 C13 | `astream_events` kept. N1: `agent.astream(stream_mode="messages")` as the simpler API. |
| `01_hands/ch07_multi_turn.py` | NB1 C14–C18 | C14, C15 as before. N1: same two turns with `checkpointer=InMemorySaver()` and a `thread_id`. C16, C17 step trace. C18 cleanup becomes `orion reset`. |
| `02_self_awareness/ch08_structured_output.py` | NB2 C1–C7 | `method="function_calling"`. |
| `02_self_awareness/ch09_self_correction.py` | NB2 C8–C16 | C8 is `LocalSandbox().run_python`. N1: `time.sleep(20)` returns `timed_out=True` instead of crashing. N2: a loud "this is a jail, not a sandbox" cell naming what Cursor, Claude Code, and Codex use. C11–C16 as before, built by `build_bugbot`. |
| `02_self_awareness/ch10_reflection.py` | NB2 C17–C22 | `build_full_agent`. |
| `02_self_awareness/ch11_rules_and_skills.py` | NB2 C23 | C23 loads `tests.mdc` through `load_rules(root, "tests/test_x.py")` and shows the same agent produce stricter output for a test path than for `app.py`. N1: `load_skills`, print the catalog. N2: an agent with `read_skill` bound, asked for a task that needs `web-research`; trace shows the skill load before the answer. |
| `02_self_awareness/ch12_inline_edit.py` | NB2 C24, C25 | Unchanged. |
| `03_brain/ch13_codebase_search.py` | NB3 C1–C4 | C3 becomes `ws.grep("stream")` and `repo_map(ws)`. C4 becomes the ch03 tool agent with `grep_files`, `glob_files`, `read_file` answering "how does streaming work in this project". N1: `embeddings.py` demo labelled as the 2023–2025 approach and why grep won. |
| `03_brain/ch14_toolkit_and_planner.py` | NB3 C5–C8 | C5: `make_tools` plus `get_mcp_tools()`; prints the combined toolkit. C6: `run_command` on `python -c "import config; …"`. N1: the planner research loop calls `web_search` for a request that needs an external fact. C7 planner with `Plan` schema. C8 `OrchestratorState`. |
| `03_brain/ch15_specialists.py` | NB3 C9–C11 | Nodes imported from the package and each invoked once on a hand-built state. C10's prompt shows the feedback, test output, and human feedback sections. |
| `03_brain/ch16_human_in_the_loop.py` | NB3 C12–C18 | C12 human node and apply node. C13 compile; print says 7 nodes, 3 conditional routes. C15 run to the interrupt and print `result["__interrupt__"][0].value`. C16 `get_state`. C17 resume with `Command(resume={"decision": "approve"})`. N1: a second thread that resumes with `{"decision": "reject", "feedback": "…"}` and shows the coder using the reason. C18 verify files. |
| `03_brain/ch17_parallel.py` | NB3 C19–C22 | C19 `ws.snapshot()` replaces the fake restore. Rest unchanged. |
| `03_brain/ch18_time_travel.py` | NB3 C23–C26 | Unchanged. |

## 5. Rules and skills

### Rules

`.cursor/rules/*.mdc` files with YAML frontmatter: `description`, `globs`, `alwaysApply`. `AGENTS.md` at the root holds the always-on repo rules in plain markdown. `frontend-design.mdc` contains the ten visual principles from DESIGN.md and the line `@DESIGN.md`; `load_rules` inlines the file so the agent sees the full design system only when it works on a `.tsx` or `.css` path.

`load_rules(root, for_path)` returns one string with a header per source (`# From .cursor/rules/python.mdc`) so learners can see the layering in the printed output.

### Skills

Each skill is a folder with `SKILL.md`. Frontmatter: `name` (must match the folder), `description`, optional `paths`, optional `disable-model-invocation`. Bodies are short and imperative.

The agent uses skills the way Cursor and Claude Code do:

1. `skills_catalog()` puts one line per skill into the system prompt.
2. `read_skill(name)` is a tool. The model calls it when the description matches the task.
3. The full body enters the conversation as a tool message, so the trace shows the decision.

Skills with `disable-model-invocation: true` are excluded from the catalog and only listed by the IDE.

## 6. Orchestrator graph

Nodes: `plan`, `code`, `test`, `ai_review`, `human_review`, `apply`, `verify`. State adds `test_output`, `test_attempts`, `human_feedback`, and keeps `review_attempts`.

| Node | Does |
|---|---|
| `plan` | Runs a tool agent with `grep_files`, `glob_files`, `read_file`, `read_skill`, `web_search`, `web_fetch` to gather context, then asks the planner LLM for a `Plan`. Stores `codebase_context` (the tool messages) and `file_tasks`. |
| `code` | For each file task, builds a prompt with the task, `codebase_context`, `load_rules(root, task.filepath)`, and the sections that apply: `Test output from the last run` when `status == "tests_failed"`, `Reviewer feedback` when `status == "needs_revision"`, `Human feedback` when `human_feedback` is set. Structured output `CodeResult`. |
| `test` | `ws.snapshot()`, writes generated files into the copy, runs `pytest -q` there if any test files exist, otherwise runs `python -c "import <each modified module>"`. Uses the sandbox. Increments `test_attempts`. Sets `status` to `tests_passed` or `tests_failed`. |
| `ai_review` | Fresh-context reviewer: sees only the generated files and `test_output`, returns `ReviewResult`. Increments `review_attempts`. Sets `status` to `approved` or `needs_revision`. |
| `human_review` | `interrupt(payload)` where payload has `plan`, `changes` (path, explanation, first 500 chars), `test_output`, `review_result`. Expects `{"decision": "approve" | "reject", "feedback": str}`. On reject: `status = "human_rejected"`, `human_feedback = feedback`, `review_attempts = 0`, `test_attempts = 0`. |
| `apply` | Writes generated files into the real workspace. |
| `verify` | Runs the same tests in the real workspace. Stores `test_output`, `status = "done"` or `"verify_failed"`. |

Routes:

- `test` → `ai_review` if passed; → `code` if failed and `test_attempts < 3`; → `human_review` if failed at the cap, so the human sees the failing output.
- `ai_review` → `human_review` if approved; → `code` if `needs_revision` and `review_attempts < 2`; → `human_review` with `review_result` prefixed "auto-approved after 2 rejections" at the cap.
- `human_review` → `apply` on approve; → `code` on reject.

Compiled with `MemorySaver`. Beat 44's drawing gains `test` and `verify`; beat 47's state table gains a test column. The parallel graph reuses `code` per file through `Send` and is otherwise unchanged.

## 7. Sandbox

`LocalSandbox` is honest about what it is. It prevents the common accidents: code runs in a temp directory, with `-I` so it ignores the user's site and environment, with a scrubbed environment, and with a timeout that returns rather than raises. It does not stop network access or resource exhaustion. The ch09 N2 cell says this and names the real options. `DockerSandbox` exists as a typed stub so the swap is one line.

`run_command` takes an argv list, never `shell=True`. The `execute_shell` tool from NB3 is renamed `run_command` and documented as such.

## 8. Orion IDE

Moved to `orion-ide/`. The backend depends on `orion_agent` through the uv workspace. Deleted from the backend: `agent/rag.py`, `agent/tools.py`, `agent/planner.py`, `agent/coder.py`, `agent/reviewer.py`, `agent/state.py`. `agent/graph.py` becomes a thin wrapper that calls `build_orchestrator` with the IDE's workspace, model choice, and rules root. `config.py` points `WORKSPACE_PATH` at the repo's `workspace/` and drops `faiss-cpu`, `langchain-community`, and `langchain-text-splitters` from requirements.

Routers:

- `/rules`: `GET` lists `AGENTS.md` and each `.mdc` with name, description, globs, alwaysApply; `GET /rules/{name}` returns the body; `PUT /rules/{name}` writes it.
- `/skills`: `GET` lists skills with name, description, paths; `GET /skills/{name}` returns the body; `PUT /skills/{name}` writes it; `POST /skills` scaffolds a folder and frontmatter from a name and description.
- `/agent` SSE trace emits a `skill_loaded` event with the skill name whenever `read_skill` is called, and a `tool_call` event for MCP tools like any other tool.

Frontend:

- `RulesEditor` becomes a list of rule files with a glob badge; selecting one opens it in the editor tab.
- New `SkillsPanel` with the same list pattern plus a "New skill" button; wired into `ActivityBar` and `SidebarContent`.
- `AgentPanel` renders `skill_loaded` steps with the accent-soft background.
- `tailwind.config.js` maps the existing `orion-*` colour names onto the DESIGN.md token values so the new panels and the old ones match.

No other IDE changes. The IDE is not taught; these are the surfaces the beats point at.

## 9. Web app

Chapters keep their slugs and numbers. Text and code strings change for:

| Chapter | New title | Cursor feature |
|---|---|---|
| ch05 | System Prompt & Rules Files | Cursor Rules |
| ch09 | Self Correction (sandboxed execute) | Bugbot |
| ch11 | Rules & Skills | Cursor Rules, Skills |
| ch13 | Codebase Search: grep, glob, read | Agent Mode |
| ch14 | Toolkit, MCP & Planner | Agent Mode, MCP |
| ch15 | Multi-Agent: Planner, Coder, Reviewer | Agent Mode |
| ch16 | Human-in-the-Loop with Tests | Agent Mode |

Site-wide changes:

- The home page and curriculum page describe the course as it is now. No version markers, no changelog, no reference to earlier material. Copy that says "Notebook 01/02/03" becomes "Lesson 1/2/3", and the `NotebookId` type and `notebook` field are renamed `lesson`.
- The curriculum page adds a short "Rules, skills, and MCP" card between Lesson 2 and Lesson 3 that links to ch11 and ch14.
- The playground page's code sample is replaced by the new orchestrator wiring from `orion_agent/graphs/orchestrator.py`.

`scripts/sync_web_chapters.py` reads each lesson file, concatenates the cells marked `web`, and writes them into the chapter's `backendCode` field between `/* lesson:begin */` and `/* lesson:end */` markers. Intro and takeaway prose and the canned demo outputs stay hand-written. `npm run lint` and `npm run build` must pass after the sync.

## 10. Testing

All tests run offline with a `StubChatModel` that returns scripted responses, including scripted tool calls and structured outputs. No test touches OpenRouter or the Parallel server.

| Test | Asserts |
|---|---|
| `test_workspace.py` | `../etc/passwd` and absolute paths raise `WorkspaceError`; `grep` and `glob` return workspace-relative paths; `snapshot` and `reset` round-trip. |
| `test_sandbox.py` | `run_python("import time; time.sleep(20)", timeout=1)` returns `timed_out=True`; `print(1/0)` returns `returncode != 0` with the traceback in `stderr`; the child's environment contains no `OPENROUTER_API_KEY`. |
| `test_rules.py` | Nested `AGENTS.md` closest wins; `globs` match by path; `alwaysApply` rules appear for every path; `@DESIGN.md` is inlined once; output headers name each source. |
| `test_skills.py` | Catalog contains only enabled skills; `paths` filtering; `read_skill` returns the body and errors on unknown names. |
| `test_self_correcting.py` | A stub that fails once then succeeds ends with `attempts == 2`; a stub that always fails stops at `max_attempts`. |
| `test_orchestrator.py` | The coder's second prompt contains the reviewer feedback; the coder's prompt after a failed test contains the traceback; a human reject resets both counters and the next coder prompt contains the feedback; the AI reviewer is consulted again after a human reject; auto-approve fires at the cap; the interrupt payload contains `test_output`. |
| `test_mcp.py` | `get_mcp_tools` builds the client config with the Bearer header only when the key is set (client construction mocked). |
| `test_lessons_smoke.py` | Every lesson file parses, every cell tag is unique within the file, and every `C<n>` from the cell map in this spec is present. |

`orion check-models` is a manual pre-delivery step, not a test.

## 11. Cleanup and migration

1. Create `src/orion_agent`, `pyproject.toml`, `.python-version`, and the tests. Get tests green.
2. Write `AGENTS.md`, `DESIGN.md`, `.cursor/rules`, `.cursor/skills`, `.cursor/mcp.json`.
3. Write the 18 lesson files. Run each end to end once with real models and cache the outputs in the generated notebooks.
4. Move `Notebooks/orion` to `orion-ide/`, rewire the backend, add the two routers and the two panels.
5. Update the seven web chapters, run the sync script, build.
6. Delete `Notebooks/`. Write `lessons/README.md` for the instructor and the root `README.md` for anyone who lands on the repo.
7. Push `reframe-python` to origin. After Dileep's review, merge to `main` on the fork so the Vercel production deploy points at `main`.
8. Rewrite instructor script beats 17, 25, 32, 38, 39, 42 to 47, and 58 to point at the new cells. This is a separate deliverable after the code is reviewed.

### Deployment

- Origin is `kvsdileep/orion-tutorial`, a public fork of `ishandutta0098/orion-tutorial` with only `main` on the remote today. Ishan's upstream stays untouched.
- Vercel: Dileep imports the fork as a new project from Cursor with root directory `web`, framework Next.js, no environment variables (the site is static fixtures). Suggested project name `orion-tutorial`; the final URL is whatever Vercel assigns, since the original name is taken. Production branch `main`; every push to `reframe-python` gets a preview URL for review before merge.
- `web/README.md` documents the import settings so the deploy is reproducible.

## 12. Out of scope

- Docker or E2B sandbox implementation. The stub and the warning cell are in scope.
- Any change to lesson order or timing. The improvement report's three-block format is a delivery decision, not a code change.
- Sharing the Orion IDE with learners. Ishan withheld it; whether to publish it after the hackathon is Dileep's call.
- Deploying the Orion IDE. It runs locally for the demo; only the curriculum site deploys.
- Tavily or other search providers. `mcp.py` takes a server map, so adding one later is configuration.

## 13. Decisions taken in this spec

- Cell tags preserve the original cell numbers so the instructor script does not need renumbering. New cells use `N<n>`. The tags are for Dileep; learners see them as ordinary cell labels.
- No notebooks. The cost of a second format is drift, and the only person running the code live is the instructor, in Cursor.
- Learners watch. The site stays a visual companion during the session, as before; it does not become a self-serve course.
- Lessons work on a gitignored `workspace/` copy of `sample_project/`, so the repo never contains agent-generated edits and "restore" is one command.
- The reviewer runs after tests, with fresh context. Tests are the primary check; the reviewer is a second opinion.
- The Parallel Search MCP runs keyless by default. The API key is optional and only raises rate limits.
- Skills are discovered from both `.cursor/skills` and `.claude/skills` because Cursor reads both and learners use both tools.
- `frontend-design` is both a rule (glob-scoped, always injected for UI paths) and a skill (a checklist the agent can pull). The rule carries the design tokens; the skill carries the process.
