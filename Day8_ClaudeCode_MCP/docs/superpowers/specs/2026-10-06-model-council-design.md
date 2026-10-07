# Model Council — Design Spec

Date: 2026-10-06
Status: Draft for review

## 1. Purpose

Model Council is a local web app. You type a question; three LLMs answer it; the three models review each other's answers; a decision model (Jev) judges whether the answers are interchangeable. Only if they are *not* interchangeable does a synthesizer model write a combined answer.

The decision step exists to save tokens: when all three models say the same thing, the synthesizer call is skipped and you read the three answers side by side.

**Who it's for:** one person, running it on their own machine. No accounts, no deployment.

**Success looks like:**
- When the three answers are interchangeable and the reviews found nothing new, the synthesizer is not called.
- When the answers disagree, or one adds a fact, caveat, example or recommendation the others lack, the synthesizer is called and told what differs.
- Every stage, the decision probabilities, and which decider answered are visible on screen as the run progresses.
- The cost of each stage is visible, so the savings from a skip can be seen.

## 2. Decisions

| Topic | Decision |
|---|---|
| Answer models | Defaults `openai/gpt-6.1-sol`, `anthropic/claude-opus-5.5`, `google/gemini-3.8-flash`; swappable in settings |
| Synthesizer | Default `anthropic/claude-sonnet-5.5`; swappable in settings |
| Decider | Jev `typesafe/jev-1.13` first; fallback `perplexity/pplx-decider-v1-27b`; both via OpenRouter |
| Provider | OpenRouter only. One key: `OPENROUTER_API_KEY`. No direct OpenAI or Perplexity APIs |
| Decision questions | Four yes/no (`noul`) questions; synthesize if any probability ≥ threshold |
| Threshold | Default 0.60; editable in settings |
| Self-review | Always runs; each model reviews all three anonymised answers |
| Answer cap | 3,000 output tokens per answer |
| Review cap | 800 output tokens per review |
| Stack | Single TypeScript app: Next.js (App Router), server-side pipeline, streamed to the browser |
| Look | CRT phosphor-green terminal design system (section 8) |
| Out of scope for v1 | Run history, saved runs, export, accounts, per-question model picker, OpenAI Decisions API, self-hosted Laya |

## 3. Architecture

### 3.1 Units

Each unit has one job and can be tested on its own.

| File | Job | Depends on |
|---|---|---|
| `src/lib/openrouter.ts` | Thin wrapper over the OpenRouter TypeScript SDK. Exposes `chat(model, messages, { maxTokens, signal })` (streaming) and `decide(model, state, questions, { signal })`. Returns text/answers plus `usage.cost`. | `@openrouter/sdk`, `OPENROUTER_API_KEY` |
| `src/lib/prompts.ts` | All prompt text: answer system prompt, review prompt, synthesizer prompt, and the four decision questions with `instructions` + `criteria`. | nothing |
| `src/lib/decider.ts` | Builds the decision `state`, calls deciders in configured order, falls back on error/timeout, applies the threshold. Returns `{ deciderUsed, probabilities, fired[], synthesize }`. | `openrouter.ts`, `prompts.ts` |
| `src/lib/pipeline.ts` | Runs one question end to end. Emits typed events through a callback. Knows nothing about HTTP. | `openrouter.ts`, `decider.ts`, `prompts.ts` |
| `src/lib/settings.ts` | Reads/validates/writes `settings.json`; falls back to `settings.default.json`. | filesystem |
| `src/app/api/run/route.ts` | POST `{ question }` → runs the pipeline → streams events as newline-delimited JSON. Aborts the pipeline when the client disconnects. | `pipeline.ts`, `settings.ts` |
| `src/app/api/synthesize/route.ts` | POST `{ question, answers, reviews, fired }` → re-runs only the synthesis step (retry button). | `pipeline.ts` |
| `src/app/api/settings/route.ts` | GET / PUT settings. | `settings.ts` |
| `src/app/page.tsx` + `src/components/*` | The terminal UI. Consumes the event stream and renders each stage. | event types only |

The OpenRouter client is passed into `pipeline.ts` and `decider.ts` as a parameter, so tests can substitute a fake.

### 3.2 Settings

`settings.default.json` (committed):

```json
{
  "answerModels": [
    "openai/gpt-6.1-sol",
    "anthropic/claude-opus-5.5",
    "google/gemini-3.8-flash"
  ],
  "synthesizer": "anthropic/claude-sonnet-5.5",
  "deciders": ["typesafe/jev-1.13", "perplexity/pplx-decider-v1-27b"],
  "threshold": 0.6
}
```

`settings.json` (git-ignored) holds the user's overrides. Validation: exactly three answer models, non-empty strings, at least one decider, threshold in [0, 1]. Model IDs are not checked against OpenRouter at save time; a bad ID shows up as an error in that model's panel.

`OPENROUTER_API_KEY` lives in `.env.local` (git-ignored). An `.env.example` documents it.

## 4. Pipeline

### 4.1 Stages

1. **Answer.** The three answer models run in parallel. Each gets the question and a short system prompt ("answer directly and completely"). `max_tokens` = 3,000. Output streams to the UI.
2. **Review.** Once all answer calls settle, each answer model that succeeded runs a review in parallel. It sees the question and all successful answers labelled **A, B, C** (model names hidden). It writes, in ≤ 800 tokens:
   - what each answer does well,
   - anything one answer contains that the others lack (fact, example, caveat, recommendation),
   - any point where the answers contradict each other.
3. **Decide.** The decider receives a `state` object:
   ```json
   {
     "question": "...",
     "answers": { "A": "...", "B": "...", "C": "..." },
     "reviews": { "A": "...", "B": "...", "C": "..." }
   }
   ```
   (`reviews` keyed by reviewer label.) Worst-case size is about 11,500 tokens, well under Jev's 32,000-token context.
   Deciders are tried in the order in `settings.deciders`. A decider is skipped on any error or after a 30-second timeout, and the next one is tried. If every decider fails, the run synthesizes by default.
4. **Synthesize** — only if any decision probability ≥ threshold, or no decider was available. The synthesizer gets the question, the labelled answers, the reviews, and the list of questions that fired (for example, "The answers disagree; resolve the disagreement and say which position is better supported."). Output streams to the UI.
5. **Skip** — otherwise. No synthesizer call. The UI shows the skip note under the three answers.

### 4.2 The four decision questions

All are `noul` questions. Each carries both `instructions` and `criteria`, because Perplexity's decider returns HTTP 400 for a `noul` question that has neither.

| Key | Instructions | criteria.true | criteria.false |
|---|---|---|---|
| `disagreement` | Do any of the answers contradict each other on a substantive point? | At least two answers make claims or recommendations that cannot both be right | All answers are compatible, differing only in wording or order |
| `unique_fact` | Does any answer contain a fact or example that the other answers do not? | One answer adds a concrete fact, number, example or step absent from the others | Every fact and example appears, in substance, in at least two answers |
| `unique_caveat` | Does any answer raise a caveat, risk or limitation that the others do not? | One answer warns about a risk, edge case or limitation the others miss | Caveats are shared, or none are raised |
| `unique_recommendation` | Does any answer make a recommendation the others do not? | One answer recommends an action or choice the others do not mention | Recommendations match across answers, or none are made |

**Rule:** `synthesize = any(p ≥ threshold)`. The questions with `p ≥ threshold` form the `fired` list.

### 4.3 Events

`pipeline.ts` emits these events, in order (types live in `src/lib/events.ts`):

```ts
type RunEvent =
  | { type: "run_started"; runId: string; settings: Settings }
  | { type: "answer_delta"; label: "A" | "B" | "C"; model: string; text: string }
  | { type: "answer_done"; label; model; text: string; truncated: boolean; cost: number }
  | { type: "answer_error"; label; model; message: string }
  | { type: "review_done"; reviewer: "A" | "B" | "C"; model; text: string; cost: number }
  | { type: "review_error"; reviewer; model; message: string }
  | { type: "decision"; deciderUsed: string | null; attempts: { model: string; error?: string }[];
      probabilities: Record<QuestionKey, number> | null; fired: QuestionKey[];
      threshold: number; synthesize: boolean; cost: number }
  | { type: "synthesis_delta"; text: string }
  | { type: "synthesis_done"; model: string; text: string; cost: number }
  | { type: "synthesis_error"; model: string; message: string }
  | { type: "skipped" }
  | { type: "run_failed"; reason: string }        // fewer than 2 answers succeeded
  | { type: "run_done"; totalCost: number; costByStage: Record<Stage, number> };
```

Costs come from OpenRouter's `usage.cost` on each response.

## 5. Failure handling

| What fails | What happens |
|---|---|
| One answer model errors or times out (90 s; one retry on 429/5xx with backoff) | `answer_error` event; run continues with the other two |
| Two or more answer models fail | `run_failed`; no reviews, no decision; any successful answer stays visible |
| A reviewer fails | `review_error`; decision proceeds with the reviews it has |
| A decider fails (30 s) | Next decider in the list; if all fail, `deciderUsed: null`, `synthesize: true` |
| Synthesizer fails | `synthesis_error`; answers stay visible; UI offers `$ synthesize --retry`, which calls `/api/synthesize` with the run's answers, reviews and decision, re-running only that step |
| Answer hits the 3,000-token cap | `truncated: true`; shown as a `[truncated]` tag, not an error |
| `OPENROUTER_API_KEY` missing | Page shows a one-line setup message instead of the prompt |
| User presses `^C stop` | Client aborts the request; server aborts every in-flight OpenRouter call through `AbortSignal` |

## 6. UI

### 6.1 Layout

One page framed as a single terminal window (max width ~1,360px), reading top to bottom like a shell session. Each stage is a prompt line followed by a panel.

```
┌● ● ●  council@local: ~/ask ───────────── ~/settings   ● running ┐
│ council~/ask $ ask "…question…"█                                 │
│ council~/ask $ council answer --models 3                        │
│ ┌ a/ gpt-6.1-sol ──┐┌ b/ opus-5.5 ─────┐┌ c/ gemini-3.8-flash ┐ │
│ │ status · cost    ││ status · cost    ││ status · cost       │ │
│ │ markdown answer  ││ markdown answer  ││ markdown answer     │ │
│ └──────────────────┘└──────────────────┘└─────────────────────┘ │
│ council~/ask $ council review   [+] expand 3 reviews            │
│ council~/ask $ decide --via jev-1.13 --threshold 0.60           │
│  disagreement      [███░░░░░░░|·]  0.28                         │
│  unique_fact       [████████░░|█]  0.81  ◆ fired                │
│  unique_caveat     [██░░░░░░░░|·]  0.17                         │
│  unique_recommend  [███░░░░░░░|·]  0.31                         │
│ council~/ask $ synthesize --model sonnet-5.5                    │
│ ┌ combined answer ─────────────────────────────────────────────┐ │
│ └──────────────────────────────────────────────────────────────┘ │
│   — or —  # [x] models agreed · synthesizer skipped              │
│ $ echo "run complete"█   cost $0.112 · ans · rev · decide · synth│
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Components

- **Title bar.** Traffic-light dots; path label `council@local: ~/ask`; `~/settings` link; amber blinking status blip reading `running` or `idle`.
- **Idle hero.** When no run has started, a `whoami`-style banner `model-council_` (glowing, with block cursor) and a one-line description sit above the prompt.
- **Prompt input.** A command line: `council~/ask $ ask "` + text input + blinking caret. Enter submits; Shift+Enter adds a newline. Disabled while a run is active.
- **Answer panels.** Three side by side, titled like directory names (`a/ gpt-6.1-sol`). Status line: `● streaming…` / `✓ done · $0.031` / `✗ error: …` / `[truncated]`. Each panel scrolls on its own (max height about 60vh) so the three stay aligned. They stack to one column below about 1,000px.
- **Reviews.** Collapsed by default behind `[+] expand 3 reviews`; expanded, one panel per reviewer.
- **Decision panel.** Header shows the decider used and the threshold. Four bar-meter rows: label, glowing fill sized to the probability, a tick at the threshold, the number to two decimals. A question that fired gets an amber `◆ fired`. If Jev failed: `via pplx-decider (jev unavailable)`. If all failed: `no decider available · synthesizing by default`.
- **Synthesis panel or skip line.** A streamed Markdown panel, or the shell comment `# [x] models agreed · synthesizer skipped`.
- **Run footer.** Echo line with cursor; per-stage and total cost.
- **Stop control.** `^C stop` beside the active prompt line during a run.
- **Settings.** A panel laid out like the neofetch block: green keys (`answer_1`, `answer_2`, `answer_3`, `synthesizer`, `decider_1`, `decider_2`, `threshold`) with editable sage values; `$ save` and `$ reset --defaults` buttons.
- **Markdown.** Answers and synthesis render Markdown. Code blocks use the inset command-box style. Headings use `#eafff1`.

## 7. Testing

- **Unit (Vitest), no network.** Use a fake OpenRouter client to cover:
  - threshold logic (none fire → skip; any ≥ threshold → synthesize; exactly at threshold counts)
  - decider fallback order and the all-fail default
  - partial failures from section 5
  - event order
  - abort propagation
- **Unit.** Prompt builder (labels anonymised, model names absent); decider state stays under 32,000 tokens at maximum answer and review sizes (rough estimate of 4 characters per token); settings validation.
- **`npm run smoke` (live, run manually).** One minimal `decide` call each to `typesafe/jev-1.13` and `perplexity/pplx-decider-v1-27b`, and one short `chat` call to each configured model. Prints OK/FAIL and cost. This is the first build task, to confirm the model IDs and the decisions endpoint.
- **`npm run calibrate` (live, run manually).** About six fixed questions: three expected to agree (e.g. "What is the boiling point of water at sea level?") and three expected to diverge (open design or judgement questions). Prints the four probabilities and the skip/synthesize result for each, to check the 0.6 threshold.
- **End-to-end (Playwright).** Uses a fake pipeline mode (`COUNCIL_FAKE=1`) that replays scripted events, to check that the UI renders the synthesize path, the skip path, a single-model error, and `run_failed`.

## 8. Design system: CRT phosphor terminal

Adapted from the user-supplied terminal portfolio system. Portfolio content (name banner, avatar, project cards, social pills) is dropped; the visual system is kept.

### 8.1 Tokens

```css
:root {
  --bg: #000000;
  --panel: #050805;
  --panel-lift: #070b07;
  --line: #143614;
  --line-bright: #1f4d1f;
  --green: #39ff7a;        /* the single accent */
  --green-dim: #2bbf5c;
  --green-faint: #1c7a3c;
  --sage: #5f8d68;         /* labels, secondary text */
  --prose: #a9c9b0;        /* long-form answer text (deviation, see 8.3) */
  --ink: #eafff1;          /* headings, strong */
  --amber: #ffd24a;        /* status blip + "fired" marker only */
  --cyan: #5cf6ff;         /* prompt glyphs only */
  --dot-red: #ff5f56; --dot-amber: #ffbd2e; --dot-green: #27c93f;
  --glow: 0 0 8px rgba(57,255,122,0.45), 0 0 24px rgba(57,255,122,0.18);
  --glow-soft: 0 0 6px rgba(57,255,122,0.30);
  --radius-sm: 3px; --radius-md: 6px; --radius-lg: 8px;
  --font: "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
}
```

The page is dark only; there is no light theme.

### 8.2 Effects

- **Background.** `#000` with two radial glows: `rgba(57,255,122,0.08)` top-right and `rgba(57,255,122,0.05)` left.
- **Scanlines.** A fixed, `pointer-events: none`, high z-index overlay painted with `repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,0.16) 3px, transparent 4px)`, `mix-blend-mode: multiply`, opacity 0.5.
- **Glow.** `.glow` / `.glow-soft` classes, used sparingly: hero banner, prompt glyphs, buttons, meter fills, fired markers.
- **Cursor.** Blinking block cursor, `step-end` keyframe, 1.1 s. Used after the prompt, the hero banner and the footer echo.
- **Selection.** `::selection { background: rgba(57,255,122,0.30) }`.
- **Bullets and rules.** `[x]` bracket bullets; thin green gradient rules between stages.
- **Reduced motion.** Under `prefers-reduced-motion`, cursors stop blinking and the status blip stops pulsing.

### 8.3 Deviations from the source system

1. **Answer prose uses `--prose` `#a9c9b0`** instead of `--sage`, so long answers stay readable under the scanlines. Sage stays for labels and secondary text.
2. **Window max width is ~1,360px** instead of 1,120px, so three answer columns each get about 420px.
3. **Answers render as Markdown**, styled with the system's tokens.

### 8.4 Hard rules

- Monospace only.
- No purple or indigo, no Inter, no emoji headings, no stock imagery.
- Left-aligned and command-driven.
- Amber appears in exactly two places: the status blip and the fired marker.

## 9. Build notes

- **Context7 first.** Every implementation task that touches a library starts with a Context7 documentation lookup: OpenRouter SDK `chat` and `alpha.decisions`, Next.js App Router streaming route handlers, the Markdown renderer, Vitest, Playwright.
- **Smoke test second.** The first build task is `npm run smoke`, to confirm all six model IDs (three answer models, the synthesizer, two deciders) and the decisions endpoint before anything depends on them.
- **Files to keep out of git:** `.env.local`, `settings.json`, `node_modules`, `.next`.
