# Exercises: change Orion while you test it

Reading an agent teaches you its shape. Changing it teaches you how it works. Each exercise below is small, has a place to look, a change to make, and a way to see the result. They go from "edit one constant" to "add a node". Do them in order the first time; the later ones assume the earlier ones.

Before you start: `uv run orion doctor`, then `uv run orion reset` so the workspace is clean. After every exercise run `uv run pytest`; the suite is offline and should stay green.

## Lesson 1: hands

**1. Change the fast model.**
Open `src/orion_agent/llm.py` and set `FAST` to `google/gemini-2.5-flash`. Run `lessons/01_hands/ch01_llm_setup.py` cell C2. The hello sentence now comes from a different provider through the same key. Put it back afterwards, or keep it if you prefer.

**2. Make a tool lie, then fix its docstring.**
In `src/orion_agent/tools.py`, change the docstring of `list_directory` to "Read a file and return its contents." Run ch03 cell C4 and ask "What files are in the current directory?". Watch which tool the model picks. The model never sees the body of a function; it sees the docstring. Restore the docstring.

**3. Add a fourth tool.**
Add `count_lines(filepath: str) -> str` to `make_tools` that returns the number of lines in a workspace file. Add it to `basic_tools`. Run ch03 C8 with "How many lines does app.py have?". Then write a test for it in `tests/test_tools.py` that follows the shape of the existing ones.

**4. Write a rule and watch it apply.**
Create `.cursor/rules/naming.mdc` with `globs: **/*.py` and one line: "Every constant name must end with `_SETTING`." Run ch05 N1 and find your line in the assembled prompt. Run C11 and see whether the agent obeyed. Delete the rule when you are done, or the Lesson 3 coder will obey it too.

## Lesson 2: self-awareness

**5. Change the retry budget.**
In ch09 C16 set `max_attempts` to 1 and run it. The hard task gives up after one try. Set it to 5. It still fails, because the sandbox cannot install packages. Retrying does not fix an environment problem; that is the seed of the human gate.

**6. Move the reviewer before execution.**
In `src/orion_agent/graphs/self_correcting.py`, `build_full_agent` runs execute before review. Draw the graph the other way round on paper, then change the edges so review runs first. Run ch10 C21 and count model calls in the trace. Put it back and explain to yourself why the original order is cheaper.

**7. Write a skill and see it load.**
Create `.cursor/skills/docstrings/SKILL.md` with a name, a description ("How to write Google-style docstrings"), and a five-line playbook. Run ch11 N1 to see it in the catalog and N2 with a task about docstrings to see `read_skill("docstrings")` in the trace.

## Lesson 3: brain

**8. Lower the test cap and reach the gate with failures.**
`demo_orchestrator` in `src/orion_agent/lesson.py` builds the agent with the default `max_test_attempts=3`. Pass `max_test_attempts=1` and ask for a feature that is likely to break the tests (for example, rename `stream_response`). The human gate now shows failing tests and no AI review. Reject with a reason that fixes it.

**9. Change what the human sees.**
`review_payload` in `src/orion_agent/graphs/orchestrator.py` builds the gate payload. Add a `line_count` field per change. Run ch16 C15 and print it. Then show it in the IDE's `ReviewDialog.tsx` next to the file name. The tests in `tests/test_orchestrator.py` tell you what the payload must still contain.

**10. Accept a third decision.**
`normalize_decision` accepts approve and reject. Add "skip": apply nothing, end the run with `status="human_skipped"`. That needs a new return value in `human_review_node`, a third branch in `route_after_human`, and an edge to `END`. Write the test first (copy `test_capitalised_approve_applies_the_change` and change the expectations), then make it pass.

**11. Add a node.**
Add a `lint` node between `test` and `ai_review` that runs `python -m py_compile` on every generated file in the snapshot and routes back to `code` on failure. Draw it first: where does the edge from `test` go now, and what does `route_after_test` return? Then run ch16 C14 to see your node in the picture.

**12. Persist the checkpoints.**
`InMemorySaver` forgets everything when the process ends. Swap it for `SqliteSaver` from `langgraph-checkpoint-sqlite` (add the package with `uv add`). Run ch16 C15, restart the kernel, and approve from a fresh process with the same thread id. That is what a production human gate needs.

## The IDE

**13. Show the human's decision in the trace.**
The backend now emits a `human` event after the gate (`routers/agent.py`). The frontend ignores it. Add a line to `AgentPanel.tsx` that shows "You approved" or "You rejected: reason" under the status.

**14. Add a model to the menu.**
`AVAILABLE_MODELS` in `orion-ide/backend/config.py` is the list the IDE offers. Add one you have used at OpenRouter, rebuild nothing (the frontend fetches the list), and pick it from the key screen.

## When you are done

You have changed a tool, a rule, a skill, a retry budget, an edge, a node, a state field, a decision, a checkpointer, and the UI. That is every part of an agent. Pick the change you found most surprising and write three sentences about why, in your own words. That is the note to keep.
