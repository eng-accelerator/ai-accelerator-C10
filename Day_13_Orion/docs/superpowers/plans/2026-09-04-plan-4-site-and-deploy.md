# Plan 4: Curriculum site and deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Next.js curriculum site so its eighteen chapters describe the course as it is now (lessons, rules files, sandbox, agentic search, MCP, tests before review), keep its code strings in sync with the lesson files by script, align its colours to DESIGN.md, and ship it from Dileep's fork on Vercel.

**Architecture:** The site stays a static Next.js 15 app with hand-written chapter fixtures. Two mechanical changes run across every chapter file (the `notebook` field becomes `lesson`, and the code string gets sync markers); seven chapters get new prose and demo content; a sync script copies each lesson file's `web`-tagged cells into the chapter's `backendCode` between markers. Nothing on the site refers to notebooks, Colab, a previous version, or "what changed".

**Tech Stack:** Next.js 15, React 19, Tailwind 3, TypeScript 5, Python 3.13 for the sync script, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-04-orion-reframe-design.md` (sections 9, 11, 13) and `DESIGN.md`

## Global Constraints

- Chapter slugs and numbers do not change. URLs stay valid.
- The type `NotebookId` becomes `LessonId = "Lesson 1" | "Lesson 2" | "Lesson 3"` and the field `notebook` becomes `lesson` everywhere.
- Every chapter's `backendCode` is wrapped as `` `/* lesson:begin */\n<code>\n/* lesson:end */` `` so `scripts/sync_web_chapters.py` can replace the code between the markers.
- Site copy never contains "Notebook", "notebook", "Colab", "FAISS", ".cursorrules", "v2", or "what changed".
- Colours come from DESIGN.md tokens. `primary` is `#8B5CF6`.
- `npm run lint` and `npm run build` pass after every task that touches `web/`.
- Commit after every task with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer. Work on `main`.

---

## File structure

```
web/lib/schema.ts                         Task 1: LessonId, lesson field
web/lib/chapters/ch01..ch18.ts, playground.ts   Task 1 (field rename, markers); Task 3 (seven rewrites)
web/app/curriculum/page.tsx               Task 1 (labels), Task 4 (rules/skills/MCP card)
web/components/Home/{HeroBand,ChapterTimeline}.tsx, AppShell/ChapterSidebar.tsx   Task 1
web/tailwind.config.ts, app/globals.css   Task 2
scripts/sync_web_chapters.py              Task 5
src/orion_agent/cli.py                    Task 5 (sync-web command)
tests/test_sync_web.py                    Task 5
web/README.md                             Task 6
```

---

### Task 1: Lessons, not notebooks (mechanical, batched)

**Files:**
- Modify: `web/lib/schema.ts`, all 18 `web/lib/chapters/chNN.ts`, `web/lib/playground.ts`, `web/app/curriculum/page.tsx`, `web/components/Home/HeroBand.tsx`, `web/components/Home/ChapterTimeline.tsx`, `web/components/AppShell/ChapterSidebar.tsx`

- [ ] **Step 1: Rename the type and field in `schema.ts`**

Replace `export type NotebookId = "Notebook 01" | "Notebook 02" | "Notebook 03";` with `export type LessonId = "Lesson 1" | "Lesson 2" | "Lesson 3";` and in `ChapterDef` replace `notebook: NotebookId;` with `lesson: LessonId;`.

- [ ] **Step 2: Rewrite the field in every chapter file and the playground**

Run from `web/`:

```bash
for f in lib/chapters/ch*.ts lib/playground.ts; do
  sed -i '' -e 's/  notebook: "Notebook 01",/  lesson: "Lesson 1",/' \
            -e 's/  notebook: "Notebook 02",/  lesson: "Lesson 2",/' \
            -e 's/  notebook: "Notebook 03",/  lesson: "Lesson 3",/' "$f"
done
grep -l 'notebook:' lib/chapters/*.ts lib/playground.ts && echo "STOP: a file still has notebook:" || echo "renamed"
```

Expected: `renamed`.

- [ ] **Step 3: Wrap every `backendCode` in sync markers**

Run from `web/`:

```bash
python3 - <<'EOF'
import re, pathlib
for p in sorted(pathlib.Path("lib/chapters").glob("ch*.ts")):
    s = p.read_text()
    if "/* lesson:begin */" in s:
        continue
    new, n = re.subn(r"backendCode: `", "backendCode: `/* lesson:begin */\n", s, count=1)
    if n:
        # close the marker right before the template string's closing backtick
        idx = new.index("backendCode: `/* lesson:begin */")
        end = new.index("`,", idx + 20)
        new = new[:end] + "\n/* lesson:end */" + new[end:]
        p.write_text(new)
        print("wrapped", p.name)
    else:
        print("no backendCode in", p.name)
EOF
```

Expected: `wrapped` for every chapter that has a `backendCode`. A chapter without one prints `no backendCode in`; Task 3 adds one where the spec needs it.

- [ ] **Step 4: Update the labels**

- `app/curriculum/page.tsx`: rename `notebookGroups` to `lessonGroups`; each entry's `notebook:` becomes `lesson:` with `"Lesson 1"`, `"Lesson 2"`, `"Lesson 3"`; the filters use `ch.lesson === "Lesson N"`; the `<span>` that printed `{group.notebook}` prints `{group.lesson}`; titles become `"Hands: tools and the agent loop"`, `"Self-awareness: run, review, retry"`, `"Brain: plan, gate, parallelise"`; the page subtitle becomes `"Each chapter introduces one idea and lets you compare a baseline against the enhanced agent in an interactive demo."`.
- `components/Home/ChapterTimeline.tsx`: `{ch.notebook} / …` becomes `{ch.lesson} / …`.
- `components/AppShell/ChapterSidebar.tsx`: both `.notebook` references become `.lesson`.
- `components/Home/HeroBand.tsx`: the paragraph becomes `18 chapters across 3 lessons. From your first LLM call to an agent that plans, tests, reviews, and waits for your approval before it writes to disk.`

- [ ] **Step 5: Lint, build, and grep**

Run from `web/`:

```bash
npm install && npm run lint && npm run build
grep -rn "Notebook\|notebook\|Colab" --include=*.ts --include=*.tsx app components lib | grep -v node_modules
```

Expected: build passes; the grep prints nothing.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "Site: lessons instead of notebooks, sync markers on every code string

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: DESIGN.md tokens

**Files:**
- Modify: `web/tailwind.config.ts`, `web/app/globals.css`

- [ ] **Step 1: Replace the colour values in `tailwind.config.ts`**

Keep every colour name (components reference them); change only the values:

```ts
night: "#0B0B0D",
surface: "#121214",
"surface-hover": "#222228",
"surface-low": "#0B0B0D",
"surface-high": "#19191D",
"surface-container-low": "#121214",
terminal: "#0E0E11",
"code-bg": "#0E0E11",
panel: "#121214",
"panel-high": "#19191D",
hairline: "#1F1F24",
"outline-variant": "#2B2B32",
ink: "#F4F4F5",
"ink-variant": "#A1A1AA",
gray2: "#A1A1AA",
gray3: "#71717A",
primary: "#8B5CF6",
"primary-light": "#A78BFA",
"primary-dim": "#7C3AED",
secondary: "#60A5FA",
"secondary-dim": "#3B82F6",
accent: "#FB923C",
"accent-dim": "#EA580C",
volt: "#4ADE80",
cyan: "#60A5FA",
magenta: "#A78BFA",
amber: "#FACC15",
"code-keyword": "#A78BFA",
"code-string": "#4ADE80",
"code-func": "#F4F4F5",
"code-comment": "#71717A",
```

Also set `borderRadius` to `{ DEFAULT: "8px", sm: "6px", md: "8px", lg: "12px", xl: "16px" }`.

- [ ] **Step 2: Update `globals.css`**

`html, body` background `#0B0B0D`, colour `#F4F4F5`; `::selection` background `#211B38`, colour `#F4F4F5`; `.stage-bg` dot colour `#1F1F24`. Remove `.glass-header`'s `backdrop-filter` lines (DESIGN.md: no glass) and in `components/AppShell/TopNav.tsx` change `glass-header bg-night/80` to `bg-night`.

- [ ] **Step 3: Build and look**

Run from `web/`: `npm run build && npm run dev`
Open http://localhost:3000, the curriculum page, and one chapter. Check: dark canvas, purple primary buttons, one accent per screen, code blocks on `#0E0E11`, no glass header. Fix any component that hard-codes a hex value by pointing it at a token.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "Site: DESIGN.md tokens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The seven reframed chapters

**Files:**
- Modify: `web/lib/chapters/ch05.ts`, `ch09.ts`, `ch11.ts`, `ch13.ts`, `ch14.ts`, `ch15.ts`, `ch16.ts`

For each chapter below, replace the listed fields. Leave `slug`, `number`, `lesson`, `subtopicLabel`, `demos`, and any `chatConfig` not mentioned as they are. `backendCode` here is a placeholder that Task 5's sync replaces; write it as shown so the markers exist.

- [ ] **Step 1: ch05 (system-prompt)**

```ts
title: "System Prompt & Rules Files",
subtitle: "The system prompt comes from files: AGENTS.md and .cursor/rules, scoped by path.",
cursorFeature: "Cursor Rules",
intro: "A system prompt sets the agent's persona and conventions. In this course it is not a string in the code: it is assembled from AGENTS.md and the .mdc files under .cursor/rules, the same files Cursor reads. A rule can apply everywhere or only to files that match its globs, so the agent gets Python conventions for .py files and design rules for .tsx files without anyone pasting prompts.",
takeaway: "Rules in files beat rules in prompts. They live with the code, they are scoped by path, and every tool that opens the repo reads the same ones.",
backendFilename: "ch05_rules.py",
backendCode: `/* lesson:begin */
# synced from lessons/01_hands/ch05_rules.py
/* lesson:end */`,
```

In `chatConfig.systemPrompts`, change the `basic` prompt's label to `"No rules"` and the `expert` entry to `{ id: "expert", label: "python.mdc", prompt: <the body of .cursor/rules/python.mdc, verbatim> }`.

- [ ] **Step 2: ch09 (self-correction)**

```ts
title: "Self Correction in a Sandbox",
subtitle: "Run the code, read the error, try again. Bounded retries, and a timeout that cannot crash the graph.",
intro: "Generated code has to run before anyone trusts it. The agent executes each attempt through a small sandbox: an isolated interpreter, a scrubbed environment, a temporary working directory, and a timeout that comes back as a failed attempt instead of an exception. On failure the traceback goes into the next prompt and the loop tries again, at most three times.",
takeaway: "Execution is the first review. A jail is not a sandbox, so the chapter names what shipped agents use instead; the loop itself is the same one Cursor's Bugbot runs.",
backendFilename: "ch09_self_correction.py",
backendCode: `/* lesson:begin */
# synced from lessons/02_self_awareness/ch09_self_correction.py
/* lesson:end */`,
```

- [ ] **Step 3: ch11 (dynamic-rules)**

```ts
title: "Rules & Skills",
subtitle: "Rules are always on and scoped by glob. Skills load on demand when their description matches the task.",
cursorFeature: "Cursor Rules, Skills",
intro: "Two ways to shape an agent without editing its code. Rules (.cursor/rules/*.mdc) are injected for every file that matches their globs, so test files get stricter conventions than app code. Skills (.cursor/skills/<name>/SKILL.md) are longer playbooks: the agent sees one line per skill and calls read_skill to load a body only when it needs it. The trace shows that decision.",
takeaway: "Rules are context you always pay for; skills are context you load when it earns its place. Both are files in the repo, so Cursor and your own agent follow the same instructions.",
backendFilename: "ch11_rules_and_skills.py",
backendCode: `/* lesson:begin */
# synced from lessons/02_self_awareness/ch11_rules_and_skills.py
/* lesson:end */`,
```

In `chatConfig`, set `rules` to the body of `.cursor/rules/tests.mdc` and rename the toggle labels to `"No rules"` and `"tests.mdc"` if they exist.

- [ ] **Step 4: ch13 (codebase-rag)**

```ts
title: "Codebase Search: grep, glob, read",
subtitle: "The codebase brain is a model with grep in its hands, not an index.",
intro: "Before it plans, the agent has to find the code the request touches. It does that the way Cursor, Claude Code, and Codex do now: grep for the words in the request, rank the files by hits, read the ones that matter, repeat if needed. No index to build or keep fresh. Embeddings get one cell at the end as the approach these tools used from 2023 to 2025, and why grep won.",
takeaway: "Search is a loop the model drives, not a database you maintain. A small set of tools (grep, glob, read) plus a capable model finds the right code in a codebase of any size.",
backendFilename: "ch13_codebase_search.py",
backendCode: `/* lesson:begin */
# synced from lessons/03_brain/ch13_codebase_search.py
/* lesson:end */`,
```

Replace `chatConfig.conversations` with:

```ts
conversations: {
  default: [
    {
      role: "tool",
      toolName: "grep_files",
      toolArgs: { pattern: "stream" },
      content: `app.py:2: from chat import get_client, stream_response
app.py:30:            stream_response(client, st.session_state.messages)
chat.py:9: def stream_response(client, messages):
chat.py:13:        stream=True,`,
    },
    {
      role: "tool",
      toolName: "read_file",
      toolArgs: { filepath: "chat.py" },
      content: `from config import BASE_URL, MODEL
from openai import OpenAI


def get_client(api_key):
    return OpenAI(base_url=BASE_URL, api_key=api_key)


def stream_response(client, messages):
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,
    )
    for chunk in response:
        content = chunk.choices[0].delta.content
        if content:
            yield content`,
    },
    {
      role: "assistant",
      content: "Streaming lives in chat.py. stream_response opens a streaming completion and yields each chunk's text; app.py passes that generator to st.write_stream, which renders tokens as they arrive.",
    },
  ],
  "system prompt configuration": [
    {
      role: "tool",
      toolName: "grep_files",
      toolArgs: { pattern: "system|prompt" },
      content: "No matches.",
    },
    {
      role: "tool",
      toolName: "read_file",
      toolArgs: { filepath: "config.py" },
      content: `PAGE_TITLE = "My ChatBot"
PAGE_ICON = "🤖"
MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"`,
    },
    {
      role: "assistant",
      content: "There is no system prompt anywhere yet. config.py holds four constants and chat.py sends messages straight through. Adding one means a constant in config.py and a system message prepended in stream_response.",
    },
  ],
},
```

and set `defaultPrompt: "how does streaming work"`.

- [ ] **Step 5: ch14 (orchestrator-state)**

```ts
title: "Toolkit, MCP & Planner",
subtitle: "Local tools, tools from an MCP server, and a planner that researches before it plans.",
cursorFeature: "Agent Mode, MCP",
intro: "The toolkit is the workspace tools from Lesson 1 plus grep, glob, a sandboxed run_python, and run_command, and then two more that arrive over the Model Context Protocol from Parallel's search server: web_search and web_fetch. They bind like any other tool. The planner uses them in a research loop before it emits a structured Plan: one entry per file, create or modify, what changes. The same MCP server is in .cursor/mcp.json, so Cursor's agent has it too.",
takeaway: "Tools are the agent's reach. MCP makes that reach configuration instead of code, and a planner that reads before it writes makes fewer, better file tasks.",
backendFilename: "ch14_toolkit_and_planner.py",
backendCode: `/* lesson:begin */
# synced from lessons/03_brain/ch14_toolkit_and_planner.py
/* lesson:end */`,
```

- [ ] **Step 6: ch15 (multi-agent)**

```ts
title: "Multi-Agent: Planner, Coder, Reviewer",
subtitle: "Three specialists, and what each one is told, including the feedback from the last round.",
intro: "The planner researches and plans. The coder generates one complete file per task, with the rules that apply to that path folded into its prompt, plus whatever came back from the last round: a failing test output, a reviewer's objections, or a human's reason for rejecting. The reviewer sees only the files and the test output, with no memory of how they were written. That fresh context is what makes its second opinion worth having.",
takeaway: "A loop only improves if feedback reaches the node that acts on it. Every prompt in this chapter is printed so you can see where the traceback, the review, and the human's note land.",
backendFilename: "ch15_specialists.py",
backendCode: `/* lesson:begin */
# synced from lessons/03_brain/ch15_specialists.py
/* lesson:end */`,
```

- [ ] **Step 7: ch16 (human-in-the-loop)**

```ts
title: "Human-in-the-Loop with Tests",
subtitle: "Plan, code, test, review, then stop and ask. A reject carries a reason back to the coder.",
intro: "Tests run before anyone reviews. The graph applies the generated files to a scratch copy of the workspace, runs pytest there, and routes failures back to the coder with the output. Only passing code reaches the AI reviewer, and only reviewed code reaches you. interrupt() freezes the graph with the plan, the diff previews, the test output, and the review in hand. You resume it with approve, or with reject and a sentence of feedback that the coder reads verbatim. Then it applies for real and verifies again.",
takeaway: "Tests are the verification primitive; the model reviewer is a second opinion; the human is the gate. A reject with a reason is worth more than a reject alone, so the graph resets its counters and tries again with your words in the prompt.",
backendFilename: "ch16_human_in_the_loop.py",
backendCode: `/* lesson:begin */
# synced from lessons/03_brain/ch16_human_in_the_loop.py
/* lesson:end */`,
```

If `ch16.ts` has `chatConfig.graphNodes`, set them to `plan`, `code`, `test`, `ai_review`, `human_review`, `apply`, `verify` and `graphEdges` to: `plan→code`, `code→test`, `test→ai_review` (label "tests pass"), `test→code` (label "fail", dashed), `ai_review→human_review` (label "approved"), `ai_review→code` (label "revise", dashed), `human_review→apply` (label "approve"), `human_review→code` (label "reject + reason", dashed), `apply→verify`.

- [ ] **Step 8: Lint, build, grep**

Run from `web/`:

```bash
npm run lint && npm run build
grep -rn "FAISS\|cursorrules\|Notebook\|Colab" --include=*.ts --include=*.tsx app components lib | grep -v node_modules
```

Expected: build passes; grep prints nothing. If ch17 or ch18 still mention FAISS in prose, replace the phrase with "codebase search".

- [ ] **Step 9: Commit**

```bash
git add web/lib/chapters
git commit -m "Site: rewrite the rules, sandbox, search, MCP, specialists, and human-gate chapters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Curriculum card and playground code

**Files:**
- Modify: `web/app/curriculum/page.tsx`, `web/lib/playground.ts`

- [ ] **Step 1: Add the card between Lesson 2 and Lesson 3**

In `CurriculumPage`, inside the `lessonGroups.map`, after the `</section>` of a group whose `lesson === "Lesson 2"`, render:

```tsx
{group.lesson === "Lesson 2" && (
  <section className="bg-surface border border-hairline rounded-lg p-6">
    <span className="font-code text-primary-light text-label-caps uppercase tracking-widest">Between the lessons</span>
    <h2 className="font-headline text-headline-sm text-ink mt-2">Rules, skills, and MCP</h2>
    <p className="font-body text-sm text-gray2 mt-2 max-w-3xl">
      Three files shape the agent without touching its code. Rules in .cursor/rules apply by path. Skills in .cursor/skills load on demand. An MCP server in .cursor/mcp.json adds tools the agent did not ship with. Cursor reads the same three.
    </p>
    <div className="flex gap-3 mt-4">
      <Link href="/curriculum/dynamic-rules" className="font-code text-sm text-primary-light hover:text-ink">Rules & skills →</Link>
      <Link href="/curriculum/orchestrator-state" className="font-code text-sm text-primary-light hover:text-ink">Toolkit & MCP →</Link>
    </div>
  </section>
)}
```

Because that JSX sits inside the map, wrap the section and the card in a fragment keyed on `group.lesson`.

- [ ] **Step 2: Replace the playground's `codeContent`**

Set `playground.codeContent` to the exact text of `src/orion_agent/graphs/orchestrator.py` from `def build_orchestrator(` to the end of the file, and `playground.codeFilename` to `"orchestrator.py"`. Copy it with:

```bash
python3 - <<'EOF'
import pathlib, re
src = pathlib.Path("src/orion_agent/graphs/orchestrator.py").read_text()
body = src[src.index("def build_orchestrator("):]
body = body.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
p = pathlib.Path("web/lib/playground.ts")
s = p.read_text()
start = s.index("codeContent: `") + len("codeContent: `")
end = s.index("`,", start)
p.write_text(s[:start] + body + s[end:])
print("playground code replaced")
EOF
```

Update the playground's `intro` to: `"This is the end product: an agent that researches the codebase, plans, generates every file, runs the tests, asks a reviewer, and waits for you before it writes to disk. The code on the left is the graph as it ships."`

- [ ] **Step 3: Lint, build, commit**

Run from `web/`: `npm run lint && npm run build`

```bash
git add web/app/curriculum/page.tsx web/lib/playground.ts
git commit -m "Site: rules, skills, and MCP card; playground shows the shipped orchestrator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Sync script and CLI command

**Files:**
- Create: `scripts/sync_web_chapters.py`, `tests/test_sync_web.py`
- Modify: `src/orion_agent/cli.py`

**Interfaces:**
- Produces: `sync_web_chapters.web_cells(lesson_path) -> str` (the `web`-tagged cells' code, joined by blank lines, tag lines stripped); `sync_web_chapters.sync(repo_root, chapter_map=CHAPTER_MAP) -> list[str]` (chapter files rewritten); `orion sync-web`.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_sync_web.py
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))

import sync_web_chapters as sync  # noqa: E402


def test_web_cells_keeps_only_tagged_cells(tmp_path):
    lesson = tmp_path / "ch01.py"
    lesson.write_text(
        "# %% setup\nfrom x import y\n\n# %% C1 hello web\nprint('a')\n\n# %% C2 not shown\nprint('b')\n\n# %% N1 also web\nprint('c')\n"
    )
    assert sync.web_cells(lesson) == "print('a')\n\nprint('c')"


def test_sync_replaces_between_markers_and_escapes(tmp_path):
    (tmp_path / "lessons").mkdir()
    (tmp_path / "lessons" / "ch01.py").write_text("# %% C1 web\nx = f\"`{a}` ${b}\"\n")
    chapters = tmp_path / "web" / "lib" / "chapters"
    chapters.mkdir(parents=True)
    ts = chapters / "ch01.ts"
    ts.write_text('export const ch01 = {\n  backendCode: `/* lesson:begin */\nold\n/* lesson:end */`,\n};\n')
    changed = sync.sync(tmp_path, {"ch01.ts": "lessons/ch01.py"})
    assert changed == ["ch01.ts"]
    out = ts.read_text()
    assert "old" not in out
    assert 'x = f"\\`{a}\\` \\${b}"' in out
    assert out.count("/* lesson:begin */") == 1 and out.count("/* lesson:end */") == 1


def test_sync_fails_loudly_without_markers(tmp_path):
    (tmp_path / "lessons").mkdir()
    (tmp_path / "lessons" / "ch01.py").write_text("# %% C1 web\nprint(1)\n")
    chapters = tmp_path / "web" / "lib" / "chapters"
    chapters.mkdir(parents=True)
    (chapters / "ch01.ts").write_text("export const ch01 = { backendCode: `no markers` };\n")
    try:
        sync.sync(tmp_path, {"ch01.ts": "lessons/ch01.py"})
    except ValueError as exc:
        assert "ch01.ts" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_chapter_map_matches_files():
    for chapter, lesson in sync.CHAPTER_MAP.items():
        assert (REPO / "web" / "lib" / "chapters" / chapter).exists(), chapter
        assert (REPO / lesson).exists(), lesson
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_sync_web.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sync_web_chapters'`

- [ ] **Step 3: Write `scripts/sync_web_chapters.py`**

```python
"""Copy each lesson's `web`-tagged cells into its chapter's backendCode on the site."""

from __future__ import annotations

import re
import sys
from pathlib import Path

TAG = re.compile(r"^# %% (\S+)(.*)$")
BEGIN = "/* lesson:begin */"
END = "/* lesson:end */"

CHAPTER_MAP: dict[str, str] = {
    "ch01.ts": "lessons/01_hands/ch01_llm_setup.py",
    "ch02.ts": "lessons/01_hands/ch02_tools.py",
    "ch03.ts": "lessons/01_hands/ch03_agent_graph.py",
    "ch04.ts": "lessons/01_hands/ch04_code_generation.py",
    "ch05.ts": "lessons/01_hands/ch05_rules.py",
    "ch06.ts": "lessons/01_hands/ch06_streaming.py",
    "ch07.ts": "lessons/01_hands/ch07_multi_turn.py",
    "ch08.ts": "lessons/02_self_awareness/ch08_structured_output.py",
    "ch09.ts": "lessons/02_self_awareness/ch09_self_correction.py",
    "ch10.ts": "lessons/02_self_awareness/ch10_reflection.py",
    "ch11.ts": "lessons/02_self_awareness/ch11_rules_and_skills.py",
    "ch12.ts": "lessons/02_self_awareness/ch12_inline_edit.py",
    "ch13.ts": "lessons/03_brain/ch13_codebase_search.py",
    "ch14.ts": "lessons/03_brain/ch14_toolkit_and_planner.py",
    "ch15.ts": "lessons/03_brain/ch15_specialists.py",
    "ch16.ts": "lessons/03_brain/ch16_human_in_the_loop.py",
    "ch17.ts": "lessons/03_brain/ch17_parallel.py",
    "ch18.ts": "lessons/03_brain/ch18_time_travel.py",
}


def web_cells(lesson_path: Path) -> str:
    """Return the code of every cell whose tag line ends with `web`, joined by blank lines."""
    blocks: list[str] = []
    current: list[str] | None = None
    for line in lesson_path.read_text().splitlines():
        match = TAG.match(line)
        if match:
            if current is not None:
                blocks.append("\n".join(current).strip("\n"))
            current = [] if match.group(2).split() and match.group(2).split()[-1] == "web" else None
            continue
        if current is not None:
            current.append(line)
    if current is not None:
        blocks.append("\n".join(current).strip("\n"))
    return "\n\n".join(b for b in blocks if b)


def _escape(code: str) -> str:
    return code.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def sync(repo_root: Path, chapter_map: dict[str, str] = CHAPTER_MAP) -> list[str]:
    changed: list[str] = []
    for chapter, lesson in chapter_map.items():
        ts_path = repo_root / "web" / "lib" / "chapters" / chapter
        text = ts_path.read_text()
        if BEGIN not in text or END not in text:
            raise ValueError(f"{chapter} has no {BEGIN} / {END} markers")
        start = text.index(BEGIN) + len(BEGIN)
        end = text.index(END)
        code = _escape(web_cells(repo_root / lesson))
        new = text[:start] + "\n" + code + "\n" + text[end:]
        if new != text:
            ts_path.write_text(new)
            changed.append(chapter)
    return changed


if __name__ == "__main__":
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    for name in sync(root):
        print(f"synced {name}")
```

- [ ] **Step 4: Add `sync-web` to the CLI**

In `src/orion_agent/cli.py`, add `sub.add_parser("sync-web", help="copy web-tagged lesson cells into the site's chapter files")` after the other parsers, and handle it:

```python
    if args.command == "sync-web":
        import importlib.util

        spec = importlib.util.spec_from_file_location("sync_web_chapters", root / "scripts" / "sync_web_chapters.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for name in module.sync(root):
            print(f"synced {name}")
        return 0
```

- [ ] **Step 5: Run the tests, then the real sync**

Run:

```bash
uv run pytest tests/test_sync_web.py -v
uv run orion sync-web
cd web && npm run lint && npm run build
```

Expected: 4 passed; eighteen `synced chNN.ts` lines; a clean build. Open two chapter pages and confirm the code panel shows the lesson cells.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync_web_chapters.py tests/test_sync_web.py src/orion_agent/cli.py web/lib/chapters
git commit -m "Sync the site's chapter code from the lesson files

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Site README and deployment

**Files:**
- Create: `web/README.md`

- [ ] **Step 1: Write `web/README.md`**

```markdown
# Curriculum site

The Next.js companion to the lessons: eighteen chapter pages with interactive demos, a curriculum overview, and a playground that shows the shipped orchestrator.

## Run locally

```bash
cd web
npm install
npm run dev
```

## Keep the code panels in sync

Chapter code comes from the lesson files. After editing a lesson, run from the repo root:

```bash
uv run orion sync-web
```

Only cells whose tag line ends with `web` are copied. Prose and demo transcripts in `lib/chapters/*.ts` are written by hand.

## Deploy

The site deploys from this repository on Vercel.

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `web` |
| Build command | `npm run build` |
| Install command | `npm install` |
| Environment variables | none |
| Production branch | `main` |

Import the repository in the Vercel dashboard (Add New Project, pick the GitHub repo, set Root Directory to `web`). Every push to `main` deploys to production; every other branch gets a preview URL. The production URL is whatever Vercel assigns to the project; record it here after the first deploy.
```

- [ ] **Step 2: Final checks**

Run from the repo root:

```bash
uv run pytest
cd web && npm run lint && npm run build && cd ..
grep -rn "Notebook\|notebook\|Colab\|FAISS\|cursorrules\|v2\b\|what changed" --include=*.ts --include=*.tsx --include=*.md web/app web/components web/lib web/README.md README.md lessons | grep -v node_modules
git status --short
```

Expected: tests green, build clean, grep prints nothing, status clean.

- [ ] **Step 3: Commit and push**

```bash
git add web/README.md
git commit -m "Site README: local run, sync, Vercel settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: Import on Vercel (Dileep, from Cursor or the dashboard)**

Add New Project, choose `kvsdileep/orion-tutorial`, Root Directory `web`, no environment variables, deploy. Paste the assigned URL into `web/README.md` and the root `README.md`, commit, push. Open the URL and click through the home page, the curriculum page, chapters 5, 11, 13, 14, 16, and the playground.

---

## Self-review

**Spec coverage.** Section 9: seven chapters retitled and rewritten (Task 3); "Notebook 01/02/03" becomes "Lesson 1/2/3" with the type and field renamed (Task 1); the rules/skills/MCP card (Task 4); playground code from the orchestrator (Task 4); `scripts/sync_web_chapters.py` with markers, and `npm run lint && npm run build` after each change (Tasks 1, 5). Section 11 deployment: fork, root directory `web`, production on `main`, README with settings (Task 6). DESIGN.md governs UI code: Task 2.

**Deviations, stated.** The spec's `cli sync-web` is implemented by loading `scripts/sync_web_chapters.py` from the CLI so the script also runs standalone. The chapter code strings become whatever the lesson files' `web` cells contain, so they no longer include the notebook-era imports; the site's copy describes the lessons as they are.

**Type consistency.** `CHAPTER_MAP` paths match Plan 2's file names exactly. Marker strings are identical in Task 1's wrapping script and Task 5's sync. `LessonId` values match the strings the curriculum page filters on.
