# Glossary

Plain-language definitions of every term the repository uses. Read it once, then come back when a word in the code or the lessons is unfamiliar.

| Term | What it means here |
|---|---|
| **Agent** | A program that lets a model decide what to do next, runs that action, shows the model the result, and repeats until the model says it is done. In Orion an agent is always a LangGraph graph. |
| **Agent loop** | The two-node graph in `graphs/tool_agent.py`: the model decides, the tools run, the model sees the result. Every other graph in the repo grows out of this one. |
| **Apply** | The node that writes generated code into `workspace/`. Until apply runs, the code exists only inside the graph's state. |
| **BYOK** | Bring your own key. Orion never ships a model key. You paste your own OpenRouter key into `.env` or into the IDE, and it is used from there. |
| **Checkpointer** | A LangGraph object (`InMemorySaver` in this repo) that saves the graph's state after every node. It is what makes pausing, resuming, multi-turn memory, and time travel possible. |
| **Command(resume=...)** | The LangGraph call that answers an interrupt. The graph wakes up inside the node that paused, with your value in hand. |
| **Conditional edge** | A function that reads the state and returns the name of the next node. All routing in Orion is done this way; `route_after_test` is the busiest one. |
| **Diff** | A line-by-line comparison of the file on disk and the file the agent proposes. The human gate shows one per file so you can review what changes rather than whole files. |
| **Human gate** or **human-in-the-loop** | The `human_review` node. The graph stops there and waits for a person to approve or reject before anything is written to disk. |
| **interrupt()** | The LangGraph primitive the human gate is built on. It freezes the run and hands a payload to whoever called the graph. |
| **LangChain** | The library that wraps model calls, tool definitions, and structured output. Orion uses it for `ChatOpenAI`, `@tool`, and `with_structured_output`. |
| **LangGraph** | The library for building graphs of nodes, edges, and state, with checkpoints and interrupts. Every agent in Orion is a LangGraph `StateGraph`. |
| **MCP** | Model Context Protocol. A standard way for a server to publish tools. Lesson 3 pulls `web_search` and `web_fetch` from Parallel's MCP server; Cursor reads the same server from `.cursor/mcp.json`. |
| **Node** | A function that takes the state and returns the fields it changed. `plan_node`, `code_node`, `test_node`, and the rest in `graphs/orchestrator.py`. |
| **OpenRouter** | One API in front of many model providers. One key, many models, chosen by id such as `openai/gpt-4.1-mini` or `anthropic/claude-sonnet-4.5`. |
| **Orchestrator** | The Lesson 3 graph: plan, code, test, AI review, human review, apply, verify. The finished Orion agent. |
| **Payload** | What `interrupt()` hands back: the plan, every proposed file with its diff, the test output, and the AI reviewer's verdict. |
| **Planner** | The specialist that turns a feature request into a `Plan`: a summary and a list of files to create or modify. It researches the codebase first with grep, glob, and read. |
| **Reducer** | A function attached to a state field that says how to merge updates. `add_to_list` in `graphs/parallel.py` concatenates what the fanned-out coders return. `MessagesState` uses one to append messages. |
| **Reviewer** | The specialist that sees only the generated files and the test output, with no memory of how they were written, and returns `ReviewResult(approved, feedback)`. |
| **Rules** | Files the agent reads into its system prompt: `AGENTS.md` and `.cursor/rules/*.mdc`. Scoped by path, so a test file gets stricter rules than app code. |
| **Sandbox** | Where generated code runs. `LocalSandbox` is a jail (isolated interpreter, scrubbed environment, temp directory, timeout), not a real sandbox. `DockerSandbox` is the stub for a real one. |
| **Send** | The LangGraph primitive that fans one node out into several copies with different inputs. Lesson 3's parallel coder uses one `Send` per file task. |
| **Skill** | A folder with a `SKILL.md`. The agent sees one line per skill in its prompt and loads the full playbook with `read_skill(name)` only when it matches the task. |
| **State** | The dictionary that flows through a graph. Each node reads it and returns only the fields it changed. `OrchestratorState` lists every field the finished agent carries. |
| **Structured output** | Asking the model for a Pydantic object instead of free text, so `.code` and `.explanation` are fields rather than something to parse out of prose. |
| **Thread id** | The key the checkpointer uses to tell runs apart. Pass the same `{"configurable": {"thread_id": ...}}` to resume a paused run or to continue a conversation. |
| **Time travel** | Walking a thread's checkpoint history with `get_state_history` to see what was planned, generated, tested, reviewed, and decided at every step. |
| **Tool** | A plain Python function with the `@tool` decorator. The decorator builds a schema from the name, type hints, and docstring; the model sees the schema, never the body. |
| **Verify** | The node that runs the tests once more on the real `workspace/` after apply. The agent proposed, acted, then checked its own work. |
| **Workspace** | The `workspace/` folder, a copy of `sample_project/` that the agent may read and write. Every tool refuses paths outside it. `uv run orion reset` restores it. |
