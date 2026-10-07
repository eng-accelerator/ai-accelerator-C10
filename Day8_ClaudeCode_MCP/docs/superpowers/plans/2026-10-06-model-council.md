# Model Council Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js app where three LLMs answer a question, review each other, and a decision model (Jev, falling back to Perplexity's decider, both via OpenRouter) decides whether a synthesizer call is worth paying for.

**Architecture:** One TypeScript Next.js app. A pure pipeline module (`src/lib/pipeline.ts`) runs answer → review → decide → synthesize/skip against an injected `CouncilClient` and emits typed events; a route handler streams those events as NDJSON; a client-side reducer renders them into a CRT terminal UI. All model calls go through one thin OpenRouter wrapper, so tests and the e2e fake mode swap in a scripted client.

**Tech Stack:** Next.js (App Router, latest 16.x), React 19, TypeScript (strict), `@openrouter/sdk`, `react-markdown` + `remark-gfm`, Vitest, Playwright, `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-model-council-design.md`

## Global Constraints

- **Context7 before library code.** Every task that touches a library starts with a Context7 lookup (`resolve-library-id` → `query-docs`). Known IDs: OpenRouter SDK `/openrouterteam/typescript-sdk`, Next.js `/vercel/next.js/v16.2.9`. If the docs contradict a code block in this plan, follow the docs, keep the same exported names and types, and note the change in the commit message.
- **Node ≥ 20.6** (needed for `--env-file` and `AbortSignal.any`).
- **OpenRouter only.** One key, `OPENROUTER_API_KEY`, in `.env.local`. No direct OpenAI or Perplexity API calls.
- **Default settings:** answer models `openai/gpt-6.1-sol`, `anthropic/claude-opus-5.5`, `google/gemini-3.8-flash`; synthesizer `anthropic/claude-sonnet-5.5`; deciders `typesafe/jev-1.13`, then `perplexity/pplx-decider-v1-27b`; threshold `0.6`.
- **Token caps:** answer 3,000; review 800; synthesis 4,000.
- **Question size:** maximum 20,000 characters.
- **Timeouts:** chat calls 90 s, with one retry on HTTP 429/5xx (and only if nothing has streamed yet); decider calls 30 s, then the next decider.
- **Decision rule:** `synthesize = any(probability >= threshold)`; if every decider fails, synthesize.
- **Design system:** monospace only (JetBrains Mono + IBM Plex Mono); dark only; no purple or indigo; amber `#ffd24a` used only for the status blip and the `◆ fired` marker; tokens exactly as spec §8.1.
- **Files kept out of git:** `.env.local`, `settings.json`, `.e2e-settings.json`, `node_modules/`, `.next/`, `test-results/`, `playwright-report/`.
- **Commit trailer.** Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. The commit commands below omit it for brevity; add it.

## Review Focus

1. **A very long question** (e.g. a whole document pasted in) must be refused with a clear message before any model is called: API returns 400 over 20,000 characters, and the UI disables `ask` and shows the limit. Tests: Task 6 (API), Task 8 (e2e).
2. **An empty or whitespace-only question** must never start a run: `ask` stays disabled, and the API returns 400. Tests: Task 6, Task 7.
3. **A decider that returns 200 with a missing or non-`noul` answer** must count as a decider failure and fall back, not crash or pass `undefined` into the threshold. Tests: Task 2, Task 4.
4. **A hand-edited, corrupt `settings.json`** must not break the app: it runs on the defaults, and the settings panel shows a warning. Tests: Task 1, Task 9.
5. **A model that returns 200 with empty text** must show as an error for that model, not as a blank "done" panel. Tests: Task 2, Task 5.

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
.env.example, .gitignore, settings.default.json, README.md
src/lib/events.ts          RunEvent union, Settings, Label, QuestionKey, Stage
src/lib/settings.ts        load/validate/save settings.json (falls back to defaults)
src/lib/openrouter.ts      CouncilClient interface + OpenRouter SDK implementation
src/lib/prompts.ts         all prompt text, the four decision questions, budget helpers
src/lib/signals.ts         withTimeout, sleep, errorMessage
src/lib/fakeClient.ts      scripted CouncilClient for tests and fake mode
src/lib/decider.ts         decider fallback chain + threshold
src/lib/pipeline.ts        runCouncil / runSynthesis
src/lib/fakeScenarios.ts   question-prefix scenarios for COUNCIL_FAKE=1
src/lib/http.ts            NDJSON streaming response + shared route helpers
src/lib/ndjson.ts          NDJSON stream reader
src/lib/runState.ts        pure reducer: RunEvent → UI state
src/lib/useRun.ts          React hook: fetch + stream + stop + retry
src/lib/format.ts          shortModel, formatCost
src/app/layout.tsx, src/app/globals.css, src/app/page.tsx
src/app/api/run/route.ts, src/app/api/synthesize/route.ts, src/app/api/settings/route.ts
src/components/TerminalWindow.tsx, Prompt.tsx, Hero.tsx, PromptLine.tsx, Markdown.tsx,
  AnswerPanel.tsx, ReviewsSection.tsx, DecisionPanel.tsx, SynthesisSection.tsx,
  RunFooter.tsx, RunView.tsx, SettingsPanel.tsx
scripts/smoke.ts, scripts/calibrate.ts
tests/unit/*.test.ts, tests/e2e/*.spec.ts
```

Within `src/lib`, files import each other with **relative paths** (so `tsx` scripts work without path aliases). Routes and components may use `@/`.

---

### Task 1: Project scaffold, shared types, settings

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `settings.default.json`
- Modify: `.gitignore`
- Create: `src/lib/events.ts`, `src/lib/settings.ts`
- Test: `tests/unit/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `events.ts`: `Label`, `LABELS: readonly Label[]`, `QuestionKey`, `Stage`, `Settings`, `DeciderAttempt`, `RunEvent`, `DecisionEvent`, `RunDoneEvent`.
  - `settings.ts`:
    - `settingsPath(): string`
    - `DEFAULT_SETTINGS: Settings`
    - `validateSettings(input: unknown): { ok: true; settings: Settings } | { ok: false; errors: string[] }`
    - `loadSettings(file?: string): Promise<{ settings: Settings; warning?: string }>`
    - `saveSettings(settings: Settings, file?: string): Promise<void>`

- [ ] **Step 1: Context7 lookup**

Query `/vercel/next.js/v16.2.9` for "manual installation package.json scripts tsconfig next.config.ts". Query Vitest (`resolve-library-id` "Vitest") for "vitest.config.ts resolve alias with ESM import.meta.url".

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "model-council",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "smoke": "tsx --env-file=.env.local scripts/smoke.ts",
    "calibrate": "tsx --env-file=.env.local scripts/calibrate.ts",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install next@latest react@latest react-dom@latest @openrouter/sdk react-markdown remark-gfm
npm install -D typescript @types/node @types/react @types/react-dom vitest tsx @playwright/test
```

- [ ] **Step 4: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
(Next may rewrite `jsx` on first run. Accept its change.)

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
```

`.env.example`:
```
# Get a key at https://openrouter.ai/settings/keys
OPENROUTER_API_KEY=sk-or-v1-...
```

`settings.default.json`:
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

`.gitignore` (replace contents):
```
node_modules/
.next/
next-env.d.ts
.env.local
settings.json
.e2e-settings.json
test-results/
playwright-report/
*.tsbuildinfo
```

- [ ] **Step 5: Create `src/lib/events.ts`**

```ts
export type Label = "A" | "B" | "C";
export const LABELS: readonly Label[] = ["A", "B", "C"];

export type QuestionKey =
  | "disagreement"
  | "unique_fact"
  | "unique_caveat"
  | "unique_recommendation";

export type Stage = "answers" | "reviews" | "decision" | "synthesis";

export interface Settings {
  answerModels: [string, string, string];
  synthesizer: string;
  deciders: string[];
  threshold: number;
}

export interface DeciderAttempt {
  model: string;
  error?: string;
}

export type RunEvent =
  | { type: "run_started"; runId: string; settings: Settings }
  | { type: "answer_delta"; label: Label; model: string; text: string }
  | { type: "answer_done"; label: Label; model: string; text: string; truncated: boolean; cost: number }
  | { type: "answer_error"; label: Label; model: string; message: string }
  | { type: "review_done"; reviewer: Label; model: string; text: string; cost: number }
  | { type: "review_error"; reviewer: Label; model: string; message: string }
  | {
      type: "decision";
      deciderUsed: string | null;
      attempts: DeciderAttempt[];
      probabilities: Record<QuestionKey, number> | null;
      fired: QuestionKey[];
      threshold: number;
      synthesize: boolean;
      cost: number;
    }
  | { type: "synthesis_delta"; text: string }
  | { type: "synthesis_done"; model: string; text: string; cost: number }
  | { type: "synthesis_error"; model: string; message: string }
  | { type: "skipped" }
  | { type: "run_failed"; reason: string }
  | { type: "run_done"; totalCost: number; costByStage: Record<Stage, number> };

export type DecisionEvent = Extract<RunEvent, { type: "decision" }>;
export type RunDoneEvent = Extract<RunEvent, { type: "run_done" }>;
```

- [ ] **Step 6: Write the failing settings tests**

`tests/unit/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  validateSettings,
} from "../../src/lib/settings";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "council-settings-"));
  file = path.join(dir, "settings.json");
});

describe("validateSettings", () => {
  it("accepts the defaults", () => {
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it("rejects anything other than exactly three answer models", () => {
    const r = validateSettings({ ...DEFAULT_SETTINGS, answerModels: ["a/b", "c/d"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/answerModels/);
  });

  it("rejects blank model IDs", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, synthesizer: "  " }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, answerModels: ["a/b", "", "c/d"] }).ok).toBe(false);
  });

  it("requires at least one decider", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, deciders: [] }).ok).toBe(false);
  });

  it("requires a threshold in [0, 1]", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: -0.1 }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1.1 }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: Number.NaN }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 0 }).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1 }).ok).toBe(true);
  });

  it("trims model IDs", () => {
    const r = validateSettings({ ...DEFAULT_SETTINGS, synthesizer: "  x/y  " });
    expect(r.ok && r.settings.synthesizer).toBe("x/y");
  });
});

describe("loadSettings / saveSettings", () => {
  it("returns defaults with no warning when the file is missing", async () => {
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toBeUndefined();
  });

  it("round-trips saved settings", async () => {
    const custom = { ...DEFAULT_SETTINGS, threshold: 0.75 };
    await saveSettings(custom, file);
    expect((await loadSettings(file)).settings).toEqual(custom);
  });

  it("falls back to defaults with a warning when the file is corrupt JSON", async () => {
    await fs.writeFile(file, "{ not json", "utf8");
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toMatch(/settings\.json/);
  });

  it("falls back to defaults with a warning when the file is invalid", async () => {
    await fs.writeFile(file, JSON.stringify({ ...DEFAULT_SETTINGS, threshold: 2 }), "utf8");
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toMatch(/threshold/);
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run tests/unit/settings.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/settings`.

- [ ] **Step 8: Implement `src/lib/settings.ts`**

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import defaults from "../../settings.default.json";
import type { Settings } from "./events";

export const DEFAULT_SETTINGS = defaults as Settings;

/** Overridable so tests and e2e runs never touch the user's real settings.json. */
export function settingsPath(): string {
  return process.env.COUNCIL_SETTINGS_PATH ?? path.join(process.cwd(), "settings.json");
}

type Validation = { ok: true; settings: Settings } | { ok: false; errors: string[] };

const isModelId = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateSettings(input: unknown): Validation {
  const s = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const answers = s.answerModels;
  if (!Array.isArray(answers) || answers.length !== 3 || !answers.every(isModelId)) {
    errors.push("answerModels must be exactly three non-empty model IDs");
  }
  if (!isModelId(s.synthesizer)) errors.push("synthesizer must be a non-empty model ID");
  const deciders = s.deciders;
  if (!Array.isArray(deciders) || deciders.length === 0 || !deciders.every(isModelId)) {
    errors.push("deciders must list at least one non-empty model ID");
  }
  const t = s.threshold;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > 1) {
    errors.push("threshold must be a number between 0 and 1");
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    settings: {
      answerModels: (answers as string[]).map((m) => m.trim()) as Settings["answerModels"],
      synthesizer: (s.synthesizer as string).trim(),
      deciders: (deciders as string[]).map((m) => m.trim()),
      threshold: t as number,
    },
  };
}

export async function loadSettings(
  file: string = settingsPath(),
): Promise<{ settings: Settings; warning?: string }> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { settings: DEFAULT_SETTINGS };
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { settings: DEFAULT_SETTINGS, warning: "settings.json is not valid JSON; using defaults" };
  }
  const v = validateSettings(parsed);
  if (!v.ok) {
    return {
      settings: DEFAULT_SETTINGS,
      warning: `settings.json is invalid (${v.errors.join("; ")}); using defaults`,
    };
  }
  return { settings: v.settings };
}

export async function saveSettings(settings: Settings, file: string = settingsPath()): Promise<void> {
  await fs.writeFile(file, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/unit/settings.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .env.example .gitignore settings.default.json src/lib/events.ts src/lib/settings.ts tests/unit/settings.test.ts
git commit -m "feat: scaffold project, shared event types, settings store"
```

---

### Task 2: OpenRouter client wrapper + live smoke test

**Files:**
- Create: `src/lib/openrouter.ts`, `scripts/smoke.ts`
- Test: `tests/unit/openrouter.test.ts`

**Interfaces:**
- Consumes: `loadSettings` (Task 1).
- Produces (`openrouter.ts`):
  - `ChatMessage { role: "system" | "user" | "assistant"; content: string }`
  - `ChatOptions { maxTokens: number; signal?: AbortSignal; onDelta?: (text: string) => void }`
  - `ChatResult { text: string; truncated: boolean; cost: number }`
  - `NoulQuestion { type: "noul"; instructions: string; criteria: { true: string; false: string } }`
  - `DecideResult { model: string; probabilities: Record<string, number>; cost: number }`
  - `CouncilClient { chat(model, messages, opts: ChatOptions): Promise<ChatResult>; decide(model, state: unknown, questions: Record<string, NoulQuestion>, opts?: { signal?: AbortSignal }): Promise<DecideResult> }`
  - `class EmptyResponseError extends Error`
  - `createOpenRouterClient(sdk?: SdkLike): CouncilClient`

- [ ] **Step 1: Context7 lookup**

Query `/openrouterteam/typescript-sdk`:
1. "chat.send chatRequest stream true chunk choices delta content finishReason usage cost maxTokens"
2. "alpha.decisions.create decisionsRequest noul answers usage cost"
3. "RequestOptions fetchOptions signal abort"

Confirm these five names before writing code:
- `chatRequest`
- `maxTokens`
- `finishReason`
- `usage.cost`
- `decisionsRequest`

If any differ, change only the mapping lines in `createOpenRouterClient`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/openrouter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createOpenRouterClient, EmptyResponseError, type SdkLike } from "../../src/lib/openrouter";

function fakeSdk(chunks: unknown[], decision?: unknown) {
  const calls: { req: any; opts: any }[] = [];
  const sdk = {
    chat: {
      send: async (req: unknown, opts: unknown) => {
        calls.push({ req, opts });
        return (async function* () {
          for (const c of chunks) yield c;
        })();
      },
    },
    alpha: {
      decisions: {
        create: async (req: unknown, opts: unknown) => {
          calls.push({ req, opts });
          return decision;
        },
      },
    },
  } as unknown as SdkLike;
  return { sdk, calls };
}

const Q = {
  a: { type: "noul" as const, instructions: "a?", criteria: { true: "yes", false: "no" } },
  b: { type: "noul" as const, instructions: "b?", criteria: { true: "yes", false: "no" } },
};

describe("chat", () => {
  it("concatenates deltas, reports each delta, and takes cost from the final chunk", async () => {
    const { sdk } = fakeSdk([
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" }, finishReason: "stop" }] },
      { choices: [], usage: { cost: 0.0123 } },
    ]);
    const deltas: string[] = [];
    const r = await createOpenRouterClient(sdk).chat("m/x", [{ role: "user", content: "hi" }], {
      maxTokens: 100,
      onDelta: (t) => deltas.push(t),
    });
    expect(r).toEqual({ text: "Hello", truncated: false, cost: 0.0123 });
    expect(deltas).toEqual(["Hel", "lo"]);
  });

  it("marks the answer truncated when the model stops on the length limit", async () => {
    const { sdk } = fakeSdk([{ choices: [{ delta: { content: "abc" }, finishReason: "length" }] }]);
    const r = await createOpenRouterClient(sdk).chat("m/x", [], { maxTokens: 3 });
    expect(r.truncated).toBe(true);
  });

  it("sends model, messages, maxTokens and stream:true, and passes the abort signal", async () => {
    const { sdk, calls } = fakeSdk([{ choices: [{ delta: { content: "ok" } }] }]);
    const ctrl = new AbortController();
    const messages = [{ role: "user" as const, content: "hi" }];
    await createOpenRouterClient(sdk).chat("m/x", messages, { maxTokens: 42, signal: ctrl.signal });
    expect(calls[0].req).toEqual({ chatRequest: { model: "m/x", messages, maxTokens: 42, stream: true } });
    expect(calls[0].opts.fetchOptions.signal).toBe(ctrl.signal);
  });

  it("throws EmptyResponseError when the model returns no text", async () => {
    const { sdk } = fakeSdk([{ choices: [{ delta: { content: "  " }, finishReason: "stop" }] }]);
    await expect(createOpenRouterClient(sdk).chat("m/x", [], { maxTokens: 10 })).rejects.toBeInstanceOf(
      EmptyResponseError,
    );
  });
});

describe("decide", () => {
  it("maps noul answers to probabilities and returns cost", async () => {
    const { sdk, calls } = fakeSdk([], {
      model: "typesafe/jev-1.13",
      answers: { a: { type: "noul", noul: 0.2 }, b: { type: "noul", noul: 0.9 } },
      usage: { cost: 0.0004 },
    });
    const r = await createOpenRouterClient(sdk).decide("typesafe/jev-1.13", { x: 1 }, Q);
    expect(r).toEqual({ model: "typesafe/jev-1.13", probabilities: { a: 0.2, b: 0.9 }, cost: 0.0004 });
    expect(calls[0].req).toEqual({ decisionsRequest: { model: "typesafe/jev-1.13", state: { x: 1 }, questions: Q } });
  });

  it("throws when an answer is missing", async () => {
    const { sdk } = fakeSdk([], { model: "d", answers: { a: { type: "noul", noul: 0.2 } }, usage: {} });
    await expect(createOpenRouterClient(sdk).decide("d", {}, Q)).rejects.toThrow(/"b"/);
  });

  it("throws when an answer is not a noul", async () => {
    const { sdk } = fakeSdk([], {
      model: "d",
      answers: { a: { type: "noul", noul: 0.2 }, b: { type: "choice", choice: "x" } },
      usage: {},
    });
    await expect(createOpenRouterClient(sdk).decide("d", {}, Q)).rejects.toThrow(/"b"/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/openrouter.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/openrouter`.

- [ ] **Step 4: Implement `src/lib/openrouter.ts`**

```ts
import { OpenRouter } from "@openrouter/sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens: number;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}

export interface ChatResult {
  text: string;
  truncated: boolean;
  cost: number;
}

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface DecideResult {
  model: string;
  probabilities: Record<string, number>;
  cost: number;
}

export interface CouncilClient {
  chat(model: string, messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult>;
  decide(
    model: string,
    state: unknown,
    questions: Record<string, NoulQuestion>,
    opts?: { signal?: AbortSignal },
  ): Promise<DecideResult>;
}

export class EmptyResponseError extends Error {
  constructor(model: string) {
    super(`${model} returned an empty response`);
    this.name = "EmptyResponseError";
  }
}

// The slice of the SDK we use. Written structurally so unit tests can pass a fake.
interface StreamChunk {
  choices?: { delta?: { content?: string | null }; finishReason?: string | null }[];
  usage?: { cost?: number | null } | null;
}
interface DecisionsResponseLike {
  model?: string;
  answers?: Record<string, { type: string; noul?: number }>;
  usage?: { cost?: number | null } | null;
}
export interface SdkLike {
  chat: { send(req: unknown, opts?: unknown): Promise<AsyncIterable<StreamChunk>> };
  alpha: { decisions: { create(req: unknown, opts?: unknown): Promise<DecisionsResponseLike> } };
}

export function createOpenRouterClient(
  sdk: SdkLike = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY }) as unknown as SdkLike,
): CouncilClient {
  return {
    async chat(model, messages, { maxTokens, signal, onDelta }) {
      const stream = await sdk.chat.send(
        { chatRequest: { model, messages, maxTokens, stream: true } },
        { fetchOptions: { signal } },
      );
      let text = "";
      let truncated = false;
      let cost = 0;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const delta = choice?.delta?.content ?? "";
        if (delta) {
          text += delta;
          onDelta?.(delta);
        }
        if (choice?.finishReason === "length") truncated = true;
        if (chunk.usage?.cost != null) cost = chunk.usage.cost;
      }
      if (!text.trim()) throw new EmptyResponseError(model);
      return { text, truncated, cost };
    },

    async decide(model, state, questions, opts = {}) {
      const res = await sdk.alpha.decisions.create(
        { decisionsRequest: { model, state, questions } },
        { fetchOptions: { signal: opts.signal } },
      );
      const probabilities: Record<string, number> = {};
      for (const key of Object.keys(questions)) {
        const a = res.answers?.[key];
        if (!a || a.type !== "noul" || typeof a.noul !== "number") {
          throw new Error(`${model} returned no noul answer for "${key}"`);
        }
        probabilities[key] = a.noul;
      }
      return { model: res.model ?? model, probabilities, cost: res.usage?.cost ?? 0 };
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/openrouter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Write `scripts/smoke.ts`**

```ts
import { createOpenRouterClient } from "../src/lib/openrouter";
import { loadSettings } from "../src/lib/settings";

const PING = {
  ping: {
    type: "noul" as const,
    instructions: "Does the text contain a greeting?",
    criteria: { true: "The text greets someone", false: "The text contains no greeting" },
  },
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }
  const { settings } = await loadSettings();
  const client = createOpenRouterClient();
  let failures = 0;

  for (const model of settings.deciders) {
    try {
      const r = await client.decide(model, { text: "Hello there, friend." }, PING);
      console.log(`OK   decide ${model}  p(yes)=${r.probabilities.ping.toFixed(2)}  $${r.cost.toFixed(5)}`);
    } catch (e) {
      failures++;
      console.log(`FAIL decide ${model}  ${message(e)}`);
    }
  }

  for (const model of [...settings.answerModels, settings.synthesizer]) {
    try {
      const r = await client.chat(model, [{ role: "user", content: "Reply with the single word: ok" }], {
        maxTokens: 256,
      });
      console.log(`OK   chat   ${model}  "${r.text.trim().slice(0, 24)}"  $${r.cost.toFixed(5)}`);
    } catch (e) {
      failures++;
      console.log(`FAIL chat   ${model}  ${message(e)}`);
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the live smoke test (needs the user's key)**

If `.env.local` with a real `OPENROUTER_API_KEY` is not present, **stop and ask the user** to create it and run `npm run smoke`, then paste the output.

Run: `npm run smoke`
Expected: six `OK` lines: two `decide`, four `chat`.

**Gate:** do not start Task 3 until at least one decider and all four chat models report `OK`. If a line fails, report it to the user verbatim. Watch in particular for:
- an unknown model ID;
- a decisions endpoint error;
- `returned an empty response` from a reasoning model.

Do not work around a failure silently.

- [ ] **Step 9: Commit**

```bash
git add src/lib/openrouter.ts scripts/smoke.ts tests/unit/openrouter.test.ts
git commit -m "feat: OpenRouter client wrapper (chat + decisions) and live smoke test"
```

---

### Task 3: Prompts, decision questions, budget helpers

**Files:**
- Create: `src/lib/prompts.ts`
- Test: `tests/unit/prompts.test.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `NoulQuestion` (Task 2); `Label`, `LABELS`, `QuestionKey` (Task 1).
- Produces:
  - Constants: `ANSWER_MAX_TOKENS = 3000`, `REVIEW_MAX_TOKENS = 800`, `SYNTHESIS_MAX_TOKENS = 4000`, `MAX_QUESTION_CHARS = 20_000`, `DECIDER_CONTEXT_TOKENS = 32_000`
  - System prompts: `ANSWER_SYSTEM`, `REVIEW_SYSTEM`, `SYNTHESIS_SYSTEM`
  - `FIRED_GUIDANCE: Record<QuestionKey, string>`
  - `answerMessages(question: string): ChatMessage[]`
  - `reviewMessages(question: string, answers: Partial<Record<Label, string>>): ChatMessage[]`
  - `synthesisMessages(question, answers: Partial<Record<Label, string>>, reviews: Partial<Record<Label, string>>, fired: QuestionKey[]): ChatMessage[]`
  - `DECISION_QUESTIONS: Record<QuestionKey, NoulQuestion>`, `QUESTION_KEYS: QuestionKey[]`
  - `DecisionState { question: string; answers: Partial<Record<Label, string>>; reviews: Partial<Record<Label, string>> }`
  - `buildDecisionState(question, answers, reviews): DecisionState`
  - `estimateTokens(text: string): number`, `decisionTokenEstimate(state: DecisionState): number`

- [ ] **Step 1: Write the failing tests**

`tests/unit/prompts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  ANSWER_MAX_TOKENS,
  ANSWER_SYSTEM,
  DECIDER_CONTEXT_TOKENS,
  DECISION_QUESTIONS,
  FIRED_GUIDANCE,
  MAX_QUESTION_CHARS,
  QUESTION_KEYS,
  REVIEW_MAX_TOKENS,
  answerMessages,
  buildDecisionState,
  decisionTokenEstimate,
  reviewMessages,
  synthesisMessages,
} from "../../src/lib/prompts";

describe("messages", () => {
  it("answerMessages is the answer system prompt plus the question", () => {
    expect(answerMessages("Why?")).toEqual([
      { role: "system", content: ANSWER_SYSTEM },
      { role: "user", content: "Why?" },
    ]);
  });

  it("reviewMessages labels answers and skips missing ones", () => {
    const user = reviewMessages("Q", { A: "alpha", C: "gamma" })[1].content;
    expect(user).toContain("### Answer A\n\nalpha");
    expect(user).toContain("### Answer C\n\ngamma");
    expect(user).not.toContain("Answer B");
  });

  it("synthesisMessages includes guidance only for fired questions", () => {
    const user = synthesisMessages("Q", { A: "a", B: "b" }, { A: "ra" }, ["unique_fact"])[1].content;
    expect(user).toContain(FIRED_GUIDANCE.unique_fact);
    expect(user).not.toContain(FIRED_GUIDANCE.disagreement);
    expect(user).toContain("### Review by reviewer A");
  });

  it("synthesisMessages explains the no-decider case when nothing fired", () => {
    const user = synthesisMessages("Q", { A: "a", B: "b" }, {}, [])[1].content;
    expect(user).toMatch(/No decision model was available/);
    expect(user).toContain("(no reviews available)");
  });
});

describe("decision questions", () => {
  it("has the four spec questions in order", () => {
    expect(QUESTION_KEYS).toEqual(["disagreement", "unique_fact", "unique_caveat", "unique_recommendation"]);
  });

  it("every question is a noul with instructions and both criteria (Perplexity rejects bare nouls)", () => {
    for (const q of Object.values(DECISION_QUESTIONS)) {
      expect(q.type).toBe("noul");
      expect(q.instructions.length).toBeGreaterThan(10);
      expect(q.criteria.true.length).toBeGreaterThan(5);
      expect(q.criteria.false.length).toBeGreaterThan(5);
    }
  });
});

describe("decider budget", () => {
  it("worst-case state fits Jev's 32,000-token context", () => {
    const state = buildDecisionState(
      "q".repeat(MAX_QUESTION_CHARS),
      { A: "a".repeat(ANSWER_MAX_TOKENS * 4), B: "b".repeat(ANSWER_MAX_TOKENS * 4), C: "c".repeat(ANSWER_MAX_TOKENS * 4) },
      { A: "r".repeat(REVIEW_MAX_TOKENS * 4), B: "r".repeat(REVIEW_MAX_TOKENS * 4), C: "r".repeat(REVIEW_MAX_TOKENS * 4) },
    );
    expect(decisionTokenEstimate(state)).toBeLessThan(DECIDER_CONTEXT_TOKENS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/prompts.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/prompts`.

- [ ] **Step 3: Implement `src/lib/prompts.ts`**

```ts
import type { ChatMessage, NoulQuestion } from "./openrouter";
import { LABELS, type Label, type QuestionKey } from "./events";

export const ANSWER_MAX_TOKENS = 3000;
export const REVIEW_MAX_TOKENS = 800;
export const SYNTHESIS_MAX_TOKENS = 4000;
export const MAX_QUESTION_CHARS = 20_000;
export const DECIDER_CONTEXT_TOKENS = 32_000;

export const ANSWER_SYSTEM =
  "You are one of three independent experts answering the same question. " +
  "Answer directly and completely. Use Markdown where it helps. Do not mention other models.";

export const REVIEW_SYSTEM =
  "You are reviewing three anonymous answers to a question, labelled A, B and C. " +
  "One of them may be yours; judge them on content only. In at most 600 words, write three short sections:\n" +
  "1. **Strengths**: what each answer does well.\n" +
  "2. **Unique content**: any fact, example, caveat or recommendation that appears in only one answer. Name the answer.\n" +
  '3. **Contradictions**: any point where answers disagree. Quote the conflicting claims. Write "None" if there are none.';

export const SYNTHESIS_SYSTEM =
  "You combine expert answers into the single best answer for the user. " +
  "Write the answer itself, not a comparison of the answers. " +
  "Do not mention answer labels, models or reviewers. Use Markdown where it helps.";

export const FIRED_GUIDANCE: Record<QuestionKey, string> = {
  disagreement: "The answers disagree. Resolve the disagreement and say which position is better supported, and why.",
  unique_fact: "Some answers contain facts or examples the others lack. Include every one that is correct.",
  unique_caveat: "Some answers raise caveats or risks the others miss. Keep every caveat that matters.",
  unique_recommendation: "Some answers make recommendations the others do not. Include them, and say when each applies.",
};

const NO_DECIDER_GUIDANCE =
  "No decision model was available. Merge the answers, keeping anything that only one answer adds.";

type ByLabel = Partial<Record<Label, string>>;

function formatAnswers(answers: ByLabel): string {
  return LABELS.filter((l) => answers[l] !== undefined)
    .map((l) => `### Answer ${l}\n\n${answers[l]}`)
    .join("\n\n");
}

function formatReviews(reviews: ByLabel): string {
  const text = LABELS.filter((l) => reviews[l] !== undefined)
    .map((l) => `### Review by reviewer ${l}\n\n${reviews[l]}`)
    .join("\n\n");
  return text || "(no reviews available)";
}

export function answerMessages(question: string): ChatMessage[] {
  return [
    { role: "system", content: ANSWER_SYSTEM },
    { role: "user", content: question },
  ];
}

export function reviewMessages(question: string, answers: ByLabel): ChatMessage[] {
  return [
    { role: "system", content: REVIEW_SYSTEM },
    { role: "user", content: `## Question\n\n${question}\n\n## Answers\n\n${formatAnswers(answers)}` },
  ];
}

export function synthesisMessages(
  question: string,
  answers: ByLabel,
  reviews: ByLabel,
  fired: QuestionKey[],
): ChatMessage[] {
  const focus = fired.length > 0 ? fired.map((k) => `- ${FIRED_GUIDANCE[k]}`).join("\n") : `- ${NO_DECIDER_GUIDANCE}`;
  return [
    { role: "system", content: SYNTHESIS_SYSTEM },
    {
      role: "user",
      content:
        `## Question\n\n${question}\n\n## Answers\n\n${formatAnswers(answers)}` +
        `\n\n## Reviews\n\n${formatReviews(reviews)}\n\n## Focus\n\n${focus}`,
    },
  ];
}

export const DECISION_QUESTIONS: Record<QuestionKey, NoulQuestion> = {
  disagreement: {
    type: "noul",
    instructions: "Do any of the answers contradict each other on a substantive point?",
    criteria: {
      true: "At least two answers make claims or recommendations that cannot both be right",
      false: "All answers are compatible, differing only in wording or order",
    },
  },
  unique_fact: {
    type: "noul",
    instructions: "Does any answer contain a fact or example that the other answers do not?",
    criteria: {
      true: "One answer adds a concrete fact, number, example or step absent from the others",
      false: "Every fact and example appears, in substance, in at least two answers",
    },
  },
  unique_caveat: {
    type: "noul",
    instructions: "Does any answer raise a caveat, risk or limitation that the others do not?",
    criteria: {
      true: "One answer warns about a risk, edge case or limitation the others miss",
      false: "Caveats are shared, or none are raised",
    },
  },
  unique_recommendation: {
    type: "noul",
    instructions: "Does any answer make a recommendation the others do not?",
    criteria: {
      true: "One answer recommends an action or choice the others do not mention",
      false: "Recommendations match across answers, or none are made",
    },
  },
};

export const QUESTION_KEYS = Object.keys(DECISION_QUESTIONS) as QuestionKey[];

export interface DecisionState {
  question: string;
  answers: ByLabel;
  reviews: ByLabel;
}

export function buildDecisionState(question: string, answers: ByLabel, reviews: ByLabel): DecisionState {
  return { question, answers, reviews };
}

/** Rough estimate: about 4 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function decisionTokenEstimate(state: DecisionState): number {
  return estimateTokens(JSON.stringify(state)) + estimateTokens(JSON.stringify(DECISION_QUESTIONS));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/prompts.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts tests/unit/prompts.test.ts
git commit -m "feat: prompts, four decision questions, decider token budget"
```

---

### Task 4: Signals, fake client, decider fallback

**Files:**
- Create: `src/lib/signals.ts`, `src/lib/fakeClient.ts`, `src/lib/decider.ts`
- Test: `tests/unit/decider.test.ts`

**Interfaces:**
- Consumes:
  - `CouncilClient`, `ChatMessage`, `EmptyResponseError` (Task 2)
  - `DECISION_QUESTIONS`, `QUESTION_KEYS`, `DecisionState` (Task 3)
  - `QuestionKey`, `DecisionEvent` (Task 1)
- Produces:
  - `signals.ts`:
    - `withTimeout(parent: AbortSignal | undefined, ms: number): AbortSignal`
    - `sleep(ms: number, signal?: AbortSignal): Promise<void>`
    - `errorMessage(err: unknown): string`
  - `fakeClient.ts`:
    - `FakeChatBehavior { text?; errorMessage?; statusCode?; failTimes?; truncated?; cost?; delayMs? }`
    - `FakeDecideBehavior { probabilities?: Partial<Record<string, number>>; errorMessage?; delayMs?; cost? }`
    - `FakeScript { chat?: (model: string, messages: ChatMessage[]) => FakeChatBehavior; decide?: Record<string, FakeDecideBehavior> }`
    - `FakeCall { kind: "chat" | "decide"; model: string; messages?: ChatMessage[]; state?: unknown }`
    - `class FakeHttpError extends Error { statusCode: number }`
    - `createFakeClient(script?: FakeScript): CouncilClient & { calls: FakeCall[] }`
  - `decider.ts`:
    - `DECIDER_TIMEOUT_MS = 30_000`
    - `DecisionOutcome = Omit<DecisionEvent, "type" | "threshold">`
    - `applyThreshold(p: Record<QuestionKey, number>, threshold: number): { fired: QuestionKey[]; synthesize: boolean }`
    - `runDecision(client, deciders: string[], state: DecisionState, threshold: number, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<DecisionOutcome>` (rejects only if `opts.signal` was aborted)

- [ ] **Step 1: Write the failing tests**

`tests/unit/decider.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyThreshold, runDecision } from "../../src/lib/decider";
import { createFakeClient } from "../../src/lib/fakeClient";
import { buildDecisionState } from "../../src/lib/prompts";

const state = buildDecisionState("Q", { A: "a", B: "b", C: "c" }, {});
const LOW = { disagreement: 0.1, unique_fact: 0.2, unique_caveat: 0.1, unique_recommendation: 0.3 };
const JEV = "typesafe/jev-1.13";
const PPLX = "perplexity/pplx-decider-v1-27b";

describe("applyThreshold", () => {
  it("skips when nothing reaches the threshold", () => {
    expect(applyThreshold(LOW, 0.6)).toEqual({ fired: [], synthesize: false });
  });
  it("counts a probability exactly at the threshold as fired", () => {
    expect(applyThreshold({ ...LOW, unique_caveat: 0.6 }, 0.6)).toEqual({ fired: ["unique_caveat"], synthesize: true });
  });
});

describe("runDecision", () => {
  it("uses the first decider when it succeeds", async () => {
    const client = createFakeClient({ decide: { [JEV]: { probabilities: { ...LOW, unique_fact: 0.81 }, cost: 0.0004 } } });
    const r = await runDecision(client, [JEV, PPLX], state, 0.6);
    expect(r.deciderUsed).toBe(JEV);
    expect(r.attempts).toEqual([{ model: JEV }]);
    expect(r.fired).toEqual(["unique_fact"]);
    expect(r.synthesize).toBe(true);
    expect(r.cost).toBe(0.0004);
    expect(client.calls.filter((c) => c.kind === "decide").map((c) => c.model)).toEqual([JEV]);
  });

  it("falls back to the next decider when the first errors", async () => {
    const client = createFakeClient({
      decide: { [JEV]: { errorMessage: "model not found" }, [PPLX]: { probabilities: LOW } },
    });
    const r = await runDecision(client, [JEV, PPLX], state, 0.6);
    expect(r.deciderUsed).toBe(PPLX);
    expect(r.attempts).toEqual([{ model: JEV, error: "model not found" }, { model: PPLX }]);
    expect(r.synthesize).toBe(false);
  });

  it("falls back when the first returns a malformed answer", async () => {
    const client = createFakeClient({
      decide: { [JEV]: { probabilities: { disagreement: 0.1 } }, [PPLX]: { probabilities: LOW } },
    });
    const r = await runDecision(client, [JEV, PPLX], state, 0.6);
    expect(r.deciderUsed).toBe(PPLX);
    expect(r.attempts[0].error).toMatch(/unique_fact/);
  });

  it("falls back when the first times out", async () => {
    const client = createFakeClient({
      decide: { [JEV]: { probabilities: LOW, delayMs: 200 }, [PPLX]: { probabilities: LOW } },
    });
    const r = await runDecision(client, [JEV, PPLX], state, 0.6, { timeoutMs: 20 });
    expect(r.deciderUsed).toBe(PPLX);
    expect(r.attempts[0].error).toBe("timed out");
  });

  it("synthesizes by default when every decider fails", async () => {
    const client = createFakeClient({
      decide: { [JEV]: { errorMessage: "down" }, [PPLX]: { errorMessage: "down" } },
    });
    const r = await runDecision(client, [JEV, PPLX], state, 0.6);
    expect(r).toMatchObject({ deciderUsed: null, probabilities: null, fired: [], synthesize: true, cost: 0 });
    expect(r.attempts).toHaveLength(2);
  });

  it("rejects without trying the next decider when the caller aborts", async () => {
    const client = createFakeClient({ decide: { [JEV]: { probabilities: LOW, delayMs: 200 } } });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    await expect(runDecision(client, [JEV, PPLX], state, 0.6, { signal: ctrl.signal })).rejects.toBeDefined();
    expect(client.calls.filter((c) => c.kind === "decide")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/decider.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/decider`.

- [ ] **Step 3: Implement `src/lib/signals.ts`**

```ts
export function withTimeout(parent: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function abortReason(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortReason(signal));
      },
      { once: true },
    );
  });
}

export function errorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "TimeoutError") return "timed out";
  if (err instanceof Error) return err.message;
  return String(err);
}
```

- [ ] **Step 4: Implement `src/lib/fakeClient.ts`**

```ts
import { EmptyResponseError, type ChatMessage, type CouncilClient } from "./openrouter";
import { sleep } from "./signals";

export interface FakeChatBehavior {
  text?: string;
  errorMessage?: string;
  statusCode?: number;
  /** Fail this many times, then succeed. Omit to fail every time. */
  failTimes?: number;
  truncated?: boolean;
  cost?: number;
  delayMs?: number;
}

export interface FakeDecideBehavior {
  probabilities?: Partial<Record<string, number>>;
  errorMessage?: string;
  delayMs?: number;
  cost?: number;
}

export interface FakeScript {
  chat?: (model: string, messages: ChatMessage[]) => FakeChatBehavior;
  decide?: Record<string, FakeDecideBehavior>;
}

export interface FakeCall {
  kind: "chat" | "decide";
  model: string;
  messages?: ChatMessage[];
  state?: unknown;
}

export class FakeHttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "FakeHttpError";
  }
}

const DEFAULT_PROBABILITY = 0.1;

export function createFakeClient(script: FakeScript = {}): CouncilClient & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const failures = new Map<string, number>();

  return {
    calls,

    async chat(model, messages, { signal, onDelta }) {
      calls.push({ kind: "chat", model, messages });
      const b = script.chat?.(model, messages) ?? {};
      await sleep(b.delayMs ?? 0, signal);
      if (b.errorMessage) {
        const key = `${model}::${messages[0]?.content ?? ""}`;
        const failed = failures.get(key) ?? 0;
        if (b.failTimes === undefined || failed < b.failTimes) {
          failures.set(key, failed + 1);
          throw new FakeHttpError(b.errorMessage, b.statusCode ?? 500);
        }
      }
      const text = b.text ?? `Answer from ${model}.`;
      if (!text.trim()) throw new EmptyResponseError(model);
      for (const part of text.match(/[\s\S]{1,24}/g) ?? []) onDelta?.(part);
      return { text, truncated: b.truncated ?? false, cost: b.cost ?? 0.001 };
    },

    async decide(model, state, questions, opts = {}) {
      calls.push({ kind: "decide", model, state });
      const b = script.decide?.[model] ?? {};
      await sleep(b.delayMs ?? 0, opts.signal);
      if (b.errorMessage) throw new FakeHttpError(b.errorMessage, 500);
      const probabilities: Record<string, number> = {};
      for (const key of Object.keys(questions)) {
        const p = b.probabilities === undefined ? DEFAULT_PROBABILITY : b.probabilities[key];
        if (p === undefined) throw new Error(`${model} returned no noul answer for "${key}"`);
        probabilities[key] = p;
      }
      return { model, probabilities, cost: b.cost ?? 0.0001 };
    },
  };
}
```

- [ ] **Step 5: Implement `src/lib/decider.ts`**

```ts
import type { CouncilClient } from "./openrouter";
import type { DecisionEvent, QuestionKey } from "./events";
import { DECISION_QUESTIONS, QUESTION_KEYS, type DecisionState } from "./prompts";
import { errorMessage, withTimeout } from "./signals";

export const DECIDER_TIMEOUT_MS = 30_000;

export type DecisionOutcome = Omit<DecisionEvent, "type" | "threshold">;

export function applyThreshold(
  probabilities: Record<QuestionKey, number>,
  threshold: number,
): { fired: QuestionKey[]; synthesize: boolean } {
  const fired = QUESTION_KEYS.filter((k) => probabilities[k] >= threshold);
  return { fired, synthesize: fired.length > 0 };
}

export async function runDecision(
  client: CouncilClient,
  deciders: string[],
  state: DecisionState,
  threshold: number,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<DecisionOutcome> {
  const attempts: DecisionOutcome["attempts"] = [];
  for (const model of deciders) {
    try {
      const res = await client.decide(model, state, DECISION_QUESTIONS, {
        signal: withTimeout(opts.signal, opts.timeoutMs ?? DECIDER_TIMEOUT_MS),
      });
      attempts.push({ model });
      const probabilities = res.probabilities as Record<QuestionKey, number>;
      return {
        deciderUsed: model,
        attempts,
        probabilities,
        ...applyThreshold(probabilities, threshold),
        cost: res.cost,
      };
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      attempts.push({ model, error: errorMessage(err) });
    }
  }
  return { deciderUsed: null, attempts, probabilities: null, fired: [], synthesize: true, cost: 0 };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/decider.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/signals.ts src/lib/fakeClient.ts src/lib/decider.ts tests/unit/decider.test.ts
git commit -m "feat: decider fallback chain with threshold, timeouts and scripted fake client"
```

---

### Task 5: Pipeline

**Files:**
- Create: `src/lib/pipeline.ts`
- Test: `tests/unit/pipeline.test.ts`

**Interfaces:**
- Consumes:
  - Task 4: `runDecision`, `withTimeout`, `sleep`, `errorMessage`, `createFakeClient`
  - Task 3: `answerMessages`, `reviewMessages`, `synthesisMessages`, `buildDecisionState`, `ANSWER_MAX_TOKENS`, `REVIEW_MAX_TOKENS`, `SYNTHESIS_MAX_TOKENS`, `ANSWER_SYSTEM`, `REVIEW_SYSTEM`, `SYNTHESIS_SYSTEM`, `FIRED_GUIDANCE`
  - Task 1: `LABELS`, `RunEvent`, `Settings`, `Stage`, `Label`, `QuestionKey`
- Produces:
  - `CHAT_TIMEOUT_MS = 90_000`, `RETRY_DELAY_MS = 1_000`
  - `RunInput { question; settings; client; emit: (e: RunEvent) => void; signal?; runId?; chatTimeoutMs?; retryDelayMs?; deciderTimeoutMs? }`
  - `runCouncil(input: RunInput): Promise<void>`. If aborted, it returns without emitting `run_done`.
  - `SynthesisInput { question; answers: Partial<Record<Label,string>>; reviews: Partial<Record<Label,string>>; fired: QuestionKey[]; model: string; client; emit; signal?; timeoutMs?; retryDelayMs? }`
  - `runSynthesis(input: SynthesisInput): Promise<number>` (returns cost; emits `synthesis_delta`, `synthesis_done` or `synthesis_error`)

- [ ] **Step 1: Write the failing tests**

`tests/unit/pipeline.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runCouncil } from "../../src/lib/pipeline";
import { createFakeClient, type FakeChatBehavior, type FakeScript } from "../../src/lib/fakeClient";
import { ANSWER_SYSTEM, FIRED_GUIDANCE, REVIEW_SYSTEM, SYNTHESIS_SYSTEM } from "../../src/lib/prompts";
import type { RunEvent, Settings } from "../../src/lib/events";

const settings: Settings = {
  answerModels: ["m/a", "m/b", "m/c"],
  synthesizer: "m/s",
  deciders: ["d/jev", "d/pplx"],
  threshold: 0.6,
};
const LOW = { disagreement: 0.1, unique_fact: 0.2, unique_caveat: 0.1, unique_recommendation: 0.3 };
const FACT = { ...LOW, unique_fact: 0.81 };

type Stage = "answer" | "review" | "synthesis";
const stageOf = (system: string): Stage =>
  system === ANSWER_SYSTEM ? "answer" : system === REVIEW_SYSTEM ? "review" : "synthesis";

function script(
  probabilities: Record<string, number> | null,
  chat: (model: string, stage: Stage) => FakeChatBehavior = () => ({}),
): FakeScript {
  return {
    chat: (model, messages) => chat(model, stageOf(messages[0].content)),
    decide: probabilities ? { "d/jev": { probabilities } } : { "d/jev": { errorMessage: "x" }, "d/pplx": { errorMessage: "x" } },
  };
}

async function run(s: FakeScript, signal?: AbortSignal) {
  const client = createFakeClient(s);
  const events: RunEvent[] = [];
  await runCouncil({
    question: "Q?",
    settings,
    client,
    emit: (e) => events.push(e),
    signal,
    retryDelayMs: 0,
    chatTimeoutMs: 1_000,
    deciderTimeoutMs: 1_000,
  });
  const types = events.map((e) => e.type).filter((t) => t !== "answer_delta" && t !== "synthesis_delta");
  return { client, events, types };
}

const chatCalls = (client: ReturnType<typeof createFakeClient>, stage: Stage) =>
  client.calls.filter((c) => c.kind === "chat" && stageOf(c.messages![0].content) === stage);

describe("runCouncil", () => {
  it("skip path: answers, reviews, decision, skipped, done; never calls the synthesizer", async () => {
    const { client, types } = await run(script(LOW));
    expect(types).toEqual([
      "run_started",
      "answer_done", "answer_done", "answer_done",
      "review_done", "review_done", "review_done",
      "decision", "skipped", "run_done",
    ]);
    expect(chatCalls(client, "synthesis")).toHaveLength(0);
  });

  it("synthesis path: streams the synthesis and tells it which questions fired", async () => {
    const { client, events, types } = await run(script(FACT));
    expect(types.slice(-3)).toEqual(["decision", "synthesis_done", "run_done"]);
    expect(events.some((e) => e.type === "synthesis_delta")).toBe(true);
    const synth = chatCalls(client, "synthesis")[0];
    expect(synth.model).toBe("m/s");
    expect(synth.messages![1].content).toContain(FIRED_GUIDANCE.unique_fact);
  });

  it("continues with two answers when one model fails, and reviews only those two", async () => {
    const { client, events } = await run(script(LOW, (m, s) => (m === "m/b" && s === "answer" ? { errorMessage: "boom", statusCode: 400 } : {})));
    expect(events).toContainEqual({ type: "answer_error", label: "B", model: "m/b", message: "boom" });
    const reviews = chatCalls(client, "review");
    expect(reviews.map((c) => c.model).sort()).toEqual(["m/a", "m/c"]);
    expect(reviews[0].messages![1].content).not.toContain("Answer B");
    expect(events.some((e) => e.type === "decision")).toBe(true);
  });

  it("fails the run when fewer than two models answer", async () => {
    const { client, types } = await run(script(LOW, (m, s) => (m !== "m/a" && s === "answer" ? { errorMessage: "down", statusCode: 400 } : {})));
    // Parallel answers can settle in any order, so check the middle as a multiset.
    expect(types[0]).toBe("run_started");
    expect(types.slice(1, 4).sort()).toEqual(["answer_done", "answer_error", "answer_error"]);
    expect(types.slice(4)).toEqual(["run_failed", "run_done"]);
    expect(client.calls.some((c) => c.kind === "decide")).toBe(false);
  });

  it("continues to the decision when a reviewer fails", async () => {
    const { events } = await run(script(LOW, (m, s) => (m === "m/c" && s === "review" ? { errorMessage: "slow", statusCode: 400 } : {})));
    expect(events).toContainEqual({ type: "review_error", reviewer: "C", model: "m/c", message: "slow" });
    expect(events.some((e) => e.type === "decision")).toBe(true);
  });

  it("retries once on a 5xx before anything streamed", async () => {
    const { client, events } = await run(script(LOW, (m, s) => (m === "m/a" && s === "answer" ? { errorMessage: "busy", statusCode: 503, failTimes: 1 } : {})));
    expect(chatCalls(client, "answer").filter((c) => c.model === "m/a")).toHaveLength(2);
    expect(events.some((e) => e.type === "answer_done" && e.label === "A")).toBe(true);
  });

  it("does not retry a 4xx", async () => {
    const { client } = await run(script(LOW, (m, s) => (m === "m/a" && s === "answer" ? { errorMessage: "bad", statusCode: 400, failTimes: 1 } : {})));
    expect(chatCalls(client, "answer").filter((c) => c.model === "m/a")).toHaveLength(1);
  });

  it("reports a synthesis error and still finishes the run", async () => {
    const { types } = await run(script(FACT, (_m, s) => (s === "synthesis" ? { errorMessage: "outage", statusCode: 400 } : {})));
    expect(types.slice(-3)).toEqual(["decision", "synthesis_error", "run_done"]);
  });

  it("synthesizes by default when no decider is available", async () => {
    const { events } = await run(script(null));
    const decision = events.find((e) => e.type === "decision");
    expect(decision).toMatchObject({ deciderUsed: null, synthesize: true });
    expect(events.some((e) => e.type === "synthesis_done")).toBe(true);
  });

  it("treats an empty model reply as that model's error", async () => {
    const { events } = await run(script(LOW, (m, s) => (m === "m/a" && s === "answer" ? { text: "" } : {})));
    const err = events.find((e) => e.type === "answer_error");
    expect(err).toMatchObject({ label: "A", message: "m/a returned an empty response" });
  });

  it("passes truncation through", async () => {
    const { events } = await run(script(LOW, (m, s) => (m === "m/a" && s === "answer" ? { truncated: true } : {})));
    expect(events.find((e) => e.type === "answer_done" && e.label === "A")).toMatchObject({ truncated: true });
  });

  it("sums cost by stage", async () => {
    const { events } = await run(script(FACT, () => ({ cost: 0.01 })));
    const done = events.find((e) => e.type === "run_done");
    expect(done).toMatchObject({ costByStage: { answers: 0.03, reviews: 0.03, decision: 0.0001, synthesis: 0.01 } });
    if (done?.type === "run_done") expect(done.totalCost).toBeCloseTo(0.0701, 6);
  });

  it("stops after abort: no reviews, no error events, no run_done", async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    const { client, types } = await run(script(LOW, () => ({ delayMs: 200 })), ctrl.signal);
    expect(chatCalls(client, "review")).toHaveLength(0);
    expect(types).toEqual(["run_started"]);
  });
});
```

Note: `costByStage.answers` sums three floats. If `toMatchObject` fails on float precision (e.g. `0.030000000000000002`), change those expectations to `toBeCloseTo` checks on each field. Do not change the implementation for this.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/pipeline.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/pipeline`.

- [ ] **Step 3: Implement `src/lib/pipeline.ts`**

```ts
import type { ChatMessage, ChatResult, CouncilClient } from "./openrouter";
import { LABELS, type Label, type QuestionKey, type RunEvent, type Settings, type Stage } from "./events";
import {
  ANSWER_MAX_TOKENS,
  REVIEW_MAX_TOKENS,
  SYNTHESIS_MAX_TOKENS,
  answerMessages,
  buildDecisionState,
  reviewMessages,
  synthesisMessages,
} from "./prompts";
import { runDecision } from "./decider";
import { errorMessage, sleep, withTimeout } from "./signals";

export const CHAT_TIMEOUT_MS = 90_000;
export const RETRY_DELAY_MS = 1_000;

type ByLabel = Partial<Record<Label, string>>;
type Emit = (e: RunEvent) => void;

export interface RunInput {
  question: string;
  settings: Settings;
  client: CouncilClient;
  emit: Emit;
  signal?: AbortSignal;
  runId?: string;
  chatTimeoutMs?: number;
  retryDelayMs?: number;
  deciderTimeoutMs?: number;
}

export interface SynthesisInput {
  question: string;
  answers: ByLabel;
  reviews: ByLabel;
  fired: QuestionKey[];
  model: string;
  client: CouncilClient;
  emit: Emit;
  signal?: AbortSignal;
  timeoutMs?: number;
  retryDelayMs?: number;
}

interface CallOptions {
  signal?: AbortSignal;
  timeoutMs: number;
  retryDelayMs: number;
  onDelta?: (text: string) => void;
}

function isRetryable(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number } | null;
  const status = e?.statusCode ?? e?.status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

/** One retry on 429/5xx, and only if nothing has streamed to the user yet. */
async function chatWithRetry(
  client: CouncilClient,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  opts: CallOptions,
): Promise<ChatResult> {
  let streamed = false;
  const onDelta = opts.onDelta
    ? (text: string) => {
        streamed = true;
        opts.onDelta!(text);
      }
    : undefined;
  const attempt = () =>
    client.chat(model, messages, { maxTokens, signal: withTimeout(opts.signal, opts.timeoutMs), onDelta });
  try {
    return await attempt();
  } catch (err) {
    if (opts.signal?.aborted || streamed || !isRetryable(err)) throw err;
    await sleep(opts.retryDelayMs, opts.signal);
    return attempt();
  }
}

const sumCost = (c: Record<Stage, number>) => c.answers + c.reviews + c.decision + c.synthesis;

export async function runCouncil(input: RunInput): Promise<void> {
  const { question, settings, client, emit, signal } = input;
  const call = { signal, timeoutMs: input.chatTimeoutMs ?? CHAT_TIMEOUT_MS, retryDelayMs: input.retryDelayMs ?? RETRY_DELAY_MS };
  const cost: Record<Stage, number> = { answers: 0, reviews: 0, decision: 0, synthesis: 0 };
  const finish = () => emit({ type: "run_done", totalCost: sumCost(cost), costByStage: { ...cost } });

  emit({ type: "run_started", runId: input.runId ?? crypto.randomUUID(), settings });

  // 1. Answers, in parallel.
  const answers: ByLabel = {};
  await Promise.all(
    settings.answerModels.map(async (model, i) => {
      const label = LABELS[i];
      try {
        const r = await chatWithRetry(client, model, answerMessages(question), ANSWER_MAX_TOKENS, {
          ...call,
          onDelta: (text) => emit({ type: "answer_delta", label, model, text }),
        });
        answers[label] = r.text;
        cost.answers += r.cost;
        emit({ type: "answer_done", label, model, text: r.text, truncated: r.truncated, cost: r.cost });
      } catch (err) {
        if (signal?.aborted) return;
        emit({ type: "answer_error", label, model, message: errorMessage(err) });
      }
    }),
  );
  if (signal?.aborted) return;

  const answered = LABELS.filter((l) => answers[l] !== undefined);
  if (answered.length < 2) {
    emit({ type: "run_failed", reason: `Only ${answered.length} of 3 models answered; at least 2 are needed to compare.` });
    finish();
    return;
  }

  // 2. Reviews: each model that answered reviews all anonymised answers, in parallel.
  const reviews: ByLabel = {};
  await Promise.all(
    answered.map(async (label) => {
      const model = settings.answerModels[LABELS.indexOf(label)];
      try {
        const r = await chatWithRetry(client, model, reviewMessages(question, answers), REVIEW_MAX_TOKENS, call);
        reviews[label] = r.text;
        cost.reviews += r.cost;
        emit({ type: "review_done", reviewer: label, model, text: r.text, cost: r.cost });
      } catch (err) {
        if (signal?.aborted) return;
        emit({ type: "review_error", reviewer: label, model, message: errorMessage(err) });
      }
    }),
  );
  if (signal?.aborted) return;

  // 3. Decision.
  let decision;
  try {
    decision = await runDecision(client, settings.deciders, buildDecisionState(question, answers, reviews), settings.threshold, {
      signal,
      timeoutMs: input.deciderTimeoutMs,
    });
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }
  cost.decision = decision.cost;
  emit({ type: "decision", ...decision, threshold: settings.threshold });

  // 4/5. Synthesize or skip.
  if (!decision.synthesize) {
    emit({ type: "skipped" });
    finish();
    return;
  }
  cost.synthesis = await runSynthesis({
    question,
    answers,
    reviews,
    fired: decision.fired,
    model: settings.synthesizer,
    client,
    emit,
    signal,
    timeoutMs: call.timeoutMs,
    retryDelayMs: call.retryDelayMs,
  });
  if (signal?.aborted) return;
  finish();
}

export async function runSynthesis(input: SynthesisInput): Promise<number> {
  const { model, emit, signal } = input;
  try {
    const r = await chatWithRetry(
      input.client,
      model,
      synthesisMessages(input.question, input.answers, input.reviews, input.fired),
      SYNTHESIS_MAX_TOKENS,
      {
        signal,
        timeoutMs: input.timeoutMs ?? CHAT_TIMEOUT_MS,
        retryDelayMs: input.retryDelayMs ?? RETRY_DELAY_MS,
        onDelta: (text) => emit({ type: "synthesis_delta", text }),
      },
    );
    emit({ type: "synthesis_done", model, text: r.text, cost: r.cost });
    return r.cost;
  } catch (err) {
    if (!signal?.aborted) emit({ type: "synthesis_error", model, message: errorMessage(err) });
    return 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/pipeline.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Run the whole unit suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all unit tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pipeline.ts tests/unit/pipeline.test.ts
git commit -m "feat: council pipeline with partial-failure handling, retry, abort and cost tracking"
```

---

### Task 6: API routes, NDJSON reader, fake scenarios

**Files:**
- Create: `src/lib/ndjson.ts`, `src/lib/fakeScenarios.ts`, `src/lib/http.ts`
- Create: `src/app/api/run/route.ts`, `src/app/api/synthesize/route.ts`, `src/app/api/settings/route.ts`
- Test: `tests/unit/ndjson.test.ts`, `tests/unit/api.test.ts`

**Interfaces:**
- Consumes:
  - Task 5: `runCouncil`, `runSynthesis`
  - Task 4: `createFakeClient`, `FakeChatBehavior`, `FakeDecideBehavior`
  - Task 3: `MAX_QUESTION_CHARS`, `QUESTION_KEYS`, `ANSWER_SYSTEM`, `REVIEW_SYSTEM`, `SYNTHESIS_SYSTEM`
  - Task 2: `createOpenRouterClient`
  - Task 1: `loadSettings`, `saveSettings`, `validateSettings`, `DEFAULT_SETTINGS`
- Produces:
  - `readNdjson<T>(body: ReadableStream<Uint8Array>, onItem: (item: T) => void): Promise<void>`
  - Fake scenarios:
    - `SCENARIOS = ["synth","skip","error","fail","nodecider","slow","synthfail"] as const`
    - `Scenario`
    - `scenarioFromQuestion(q: string): Scenario`
    - `createScenarioClient(question: string, settings: Settings, opts?: { delayMs?: number; isRetry?: boolean })`
  - HTTP:
    - `POST /api/run { question }` → NDJSON `RunEvent` stream. Returns 400 `{ error }` for an empty or over-long question, and 500 `{ error }` if the key is missing.
    - `POST /api/synthesize { question, answers, reviews, fired }` → NDJSON synthesis events.
    - `GET /api/settings` → `{ settings, warning: string | null, defaults, hasKey: boolean }`
    - `PUT /api/settings` → `{ settings }`, or 400 `{ errors: string[] }`
  - `http.ts`: `NDJSON_HEADERS`, `isFake(): boolean`, `missingKeyResponse(): Response | null`, `ndjsonStream(signal: AbortSignal, work: (emit: (e: RunEvent) => void) => Promise<void>): Response` (route files may only export handlers and route config, so shared helpers live here)
  - Env: `COUNCIL_FAKE=1` switches every route to the scenario client.

- [ ] **Step 1: Context7 lookup**

Query `/vercel/next.js/v16.2.9`:
1. "route handler POST streaming ReadableStream Response request.signal abort client disconnect"
2. "route segment config runtime nodejs in v16"

Confirm that `export const runtime = "nodejs"` is still valid. If it isn't, drop it.

- [ ] **Step 2: Write the failing tests**

`tests/unit/ndjson.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readNdjson } from "../../src/lib/ndjson";

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("parses objects split across chunks, including split multi-byte characters", async () => {
    const bytes = new TextEncoder().encode('{"a":"café"}\n{"b":2}\n{"c":3}');
    const cut = bytes.indexOf(0xc3) + 1; // split inside "é"
    const items: unknown[] = [];
    await readNdjson(streamOf([bytes.slice(0, 4), bytes.slice(4, cut), bytes.slice(cut)]), (i) => items.push(i));
    expect(items).toEqual([{ a: "café" }, { b: 2 }, { c: 3 }]);
  });

  it("ignores blank lines", async () => {
    const items: unknown[] = [];
    await readNdjson(streamOf([new TextEncoder().encode('\n{"a":1}\n\n')]), (i) => items.push(i));
    expect(items).toEqual([{ a: 1 }]);
  });
});
```

`tests/unit/api.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST as runPOST } from "../../src/app/api/run/route";
import { POST as synthPOST } from "../../src/app/api/synthesize/route";
import { GET as settingsGET, PUT as settingsPUT } from "../../src/app/api/settings/route";
import { readNdjson } from "../../src/lib/ndjson";
import { MAX_QUESTION_CHARS } from "../../src/lib/prompts";
import type { RunEvent } from "../../src/lib/events";

const json = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function events(res: Response): Promise<RunEvent[]> {
  const out: RunEvent[] = [];
  await readNdjson<RunEvent>(res.body!, (e) => out.push(e));
  return out;
}

const saved = { ...process.env };
beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "council-api-"));
  process.env.COUNCIL_SETTINGS_PATH = path.join(dir, "settings.json");
  process.env.COUNCIL_FAKE = "1";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("POST /api/run", () => {
  it("streams a full fake run ending in run_done", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "[skip] hello" }));
    expect(res.headers.get("Content-Type")).toMatch(/ndjson/);
    const types = (await events(res)).map((e) => e.type);
    expect(types[0]).toBe("run_started");
    expect(types).toContain("skipped");
    expect(types.at(-1)).toBe("run_done");
  });

  it("rejects an empty or whitespace question", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/question/);
  });

  it("rejects a question over the size limit", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "x".repeat(MAX_QUESTION_CHARS + 1) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/20,000/);
  });

  it("reports a missing API key", async () => {
    delete process.env.COUNCIL_FAKE;
    delete process.env.OPENROUTER_API_KEY;
    const res = await runPOST(json("/api/run", "POST", { question: "hi" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/OPENROUTER_API_KEY/);
  });
});

describe("POST /api/synthesize", () => {
  it("streams only the synthesis step", async () => {
    const res = await synthPOST(
      json("/api/synthesize", "POST", { question: "[synthfail] q", answers: { A: "a", B: "b" }, reviews: {}, fired: ["unique_fact"] }),
    );
    const types = (await events(res)).map((e) => e.type).filter((t) => t !== "synthesis_delta");
    expect(types).toEqual(["synthesis_done"]);
  });

  it("rejects a malformed body", async () => {
    const res = await synthPOST(json("/api/synthesize", "POST", { question: "q", answers: "nope", reviews: {}, fired: [] }));
    expect(res.status).toBe(400);
  });
});

describe("/api/settings", () => {
  it("GET returns defaults, no warning, and hasKey in fake mode", async () => {
    const body = await (await settingsGET()).json();
    expect(body.settings).toEqual(body.defaults);
    expect(body.warning).toBeNull();
    expect(body.hasKey).toBe(true);
  });

  it("GET reports hasKey false without a key outside fake mode", async () => {
    delete process.env.COUNCIL_FAKE;
    delete process.env.OPENROUTER_API_KEY;
    expect((await (await settingsGET()).json()).hasKey).toBe(false);
  });

  it("PUT saves valid settings and rejects invalid ones", async () => {
    const { defaults } = await (await settingsGET()).json();
    const ok = await settingsPUT(json("/api/settings", "PUT", { ...defaults, threshold: 0.8 }));
    expect(ok.status).toBe(200);
    expect((await (await settingsGET()).json()).settings.threshold).toBe(0.8);

    const bad = await settingsPUT(json("/api/settings", "PUT", { ...defaults, threshold: 3 }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors.join()).toMatch(/threshold/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ndjson.test.ts tests/unit/api.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/lib/ndjson.ts`**

```ts
export async function readNdjson<T>(body: ReadableStream<Uint8Array>, onItem: (item: T) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flushLines = () => {
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onItem(JSON.parse(line) as T);
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushLines();
  }
  buffer += decoder.decode();
  flushLines();
  const rest = buffer.trim();
  if (rest) onItem(JSON.parse(rest) as T);
}
```

- [ ] **Step 5: Implement `src/lib/fakeScenarios.ts`**

```ts
import type { QuestionKey, Settings } from "./events";
import { ANSWER_SYSTEM, REVIEW_SYSTEM, SYNTHESIS_SYSTEM } from "./prompts";
import { createFakeClient, type FakeChatBehavior, type FakeDecideBehavior } from "./fakeClient";

export const SCENARIOS = ["synth", "skip", "error", "fail", "nodecider", "slow", "synthfail"] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** A question starting with "[skip]", "[error]" etc. picks a scenario; anything else is "synth". */
export function scenarioFromQuestion(question: string): Scenario {
  const m = /^\[([a-z]+)\]/.exec(question.trim());
  return m && (SCENARIOS as readonly string[]).includes(m[1]) ? (m[1] as Scenario) : "synth";
}

const LOW: Record<QuestionKey, number> = {
  disagreement: 0.18,
  unique_fact: 0.22,
  unique_caveat: 0.12,
  unique_recommendation: 0.25,
};
const FACT: Record<QuestionKey, number> = { ...LOW, unique_fact: 0.81 };

export function createScenarioClient(
  question: string,
  settings: Settings,
  opts: { delayMs?: number; isRetry?: boolean } = {},
) {
  const scenario = scenarioFromQuestion(question);
  const delayMs = scenario === "slow" ? 5_000 : (opts.delayMs ?? 40);
  const [, second, third] = settings.answerModels;
  const fail: FakeChatBehavior = { errorMessage: "simulated provider error", statusCode: 400, delayMs };

  const chat = (model: string, messages: { content: string }[]): FakeChatBehavior => {
    const system = messages[0]?.content;
    if (system === ANSWER_SYSTEM) {
      if ((scenario === "error" || scenario === "fail") && model === second) return fail;
      if (scenario === "fail" && model === third) return fail;
      return { text: `**${model}** answers: keep the design simple.\n\n- measure first\n- change one thing at a time`, delayMs, cost: 0.012 };
    }
    if (system === REVIEW_SYSTEM) {
      return { text: "1. **Strengths**: all clear.\n2. **Unique content**: none.\n3. **Contradictions**: None", delayMs, cost: 0.004 };
    }
    if (system === SYNTHESIS_SYSTEM && scenario === "synthfail" && !opts.isRetry) {
      return { errorMessage: "simulated synthesizer outage", statusCode: 400, delayMs };
    }
    return { text: "## Combined answer\n\nMeasure first, then change one thing at a time.", delayMs, cost: 0.01 };
  };

  const decide: Record<string, FakeDecideBehavior> = {};
  for (const d of settings.deciders) {
    decide[d] =
      scenario === "nodecider"
        ? { errorMessage: "simulated decider outage", delayMs }
        : { probabilities: scenario === "skip" ? LOW : FACT, delayMs, cost: 0.0004 };
  }
  return createFakeClient({ chat, decide });
}
```

- [ ] **Step 6: Implement `src/lib/http.ts` and `src/app/api/run/route.ts`**

`src/lib/http.ts`:
```ts
import type { RunEvent } from "./events";
import { errorMessage } from "./signals";

export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Content-Type-Options": "nosniff",
};

export const isFake = () => process.env.COUNCIL_FAKE === "1";

export function missingKeyResponse(): Response | null {
  if (isFake() || process.env.OPENROUTER_API_KEY) return null;
  return Response.json(
    { error: "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example) and restart the server." },
    { status: 500 },
  );
}

/** Streams events produced by `work` as NDJSON; closes when work settles. */
export function ndjsonStream(signal: AbortSignal, work: (emit: (e: RunEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // client went away; the abort signal stops the work
        }
      };
      try {
        await work(emit);
      } catch (err) {
        if (!signal.aborted) emit({ type: "run_failed", reason: errorMessage(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}
```

`src/app/api/run/route.ts`:
```ts
import { loadSettings } from "@/lib/settings";
import { createOpenRouterClient } from "@/lib/openrouter";
import { createScenarioClient } from "@/lib/fakeScenarios";
import { isFake, missingKeyResponse, ndjsonStream } from "@/lib/http";
import { runCouncil } from "@/lib/pipeline";
import { MAX_QUESTION_CHARS } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ error: "question is required" }, { status: 400 });
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json(
      { error: `question is ${question.length.toLocaleString("en-US")} characters; the limit is 20,000` },
      { status: 400 },
    );
  }
  const missing = missingKeyResponse();
  if (missing) return missing;

  const { settings } = await loadSettings();
  const client = isFake() ? createScenarioClient(question, settings) : createOpenRouterClient();
  return ndjsonStream(req.signal, (emit) => runCouncil({ question, settings, client, emit, signal: req.signal }));
}
```

- [ ] **Step 7: Implement `src/app/api/synthesize/route.ts`**

```ts
import { loadSettings } from "@/lib/settings";
import { createOpenRouterClient } from "@/lib/openrouter";
import { createScenarioClient } from "@/lib/fakeScenarios";
import { runSynthesis } from "@/lib/pipeline";
import { QUESTION_KEYS } from "@/lib/prompts";
import { LABELS, type Label, type QuestionKey } from "@/lib/events";
import { isFake, missingKeyResponse, ndjsonStream } from "@/lib/http";

export const runtime = "nodejs";

type ByLabel = Partial<Record<Label, string>>;

function asByLabel(v: unknown): ByLabel | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: ByLabel = {};
  for (const [k, text] of Object.entries(v)) {
    if (!(LABELS as readonly string[]).includes(k) || typeof text !== "string") return null;
    out[k as Label] = text;
  }
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const answers = asByLabel(body?.answers);
  const reviews = asByLabel(body?.reviews);
  const fired = body?.fired;
  const firedOk = Array.isArray(fired) && fired.every((k) => (QUESTION_KEYS as string[]).includes(k as string));
  if (!question || !answers || Object.keys(answers).length < 2 || !reviews || !firedOk) {
    return Response.json({ error: "expected { question, answers (2+), reviews, fired }" }, { status: 400 });
  }
  const missing = missingKeyResponse();
  if (missing) return missing;

  const { settings } = await loadSettings();
  const client = isFake() ? createScenarioClient(question, settings, { isRetry: true }) : createOpenRouterClient();
  return ndjsonStream(req.signal, async (emit) => {
    await runSynthesis({
      question,
      answers,
      reviews,
      fired: fired as QuestionKey[],
      model: settings.synthesizer,
      client,
      emit,
      signal: req.signal,
    });
  });
}
```

- [ ] **Step 8: Implement `src/app/api/settings/route.ts`**

```ts
import { DEFAULT_SETTINGS, loadSettings, saveSettings, validateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { settings, warning } = await loadSettings();
  return Response.json({
    settings,
    warning: warning ?? null,
    defaults: DEFAULT_SETTINGS,
    hasKey: process.env.COUNCIL_FAKE === "1" || Boolean(process.env.OPENROUTER_API_KEY),
  });
}

export async function PUT(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const v = validateSettings(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  await saveSettings(v.settings);
  return Response.json({ settings: v.settings });
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ndjson.test.ts tests/unit/api.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 10: Typecheck and build**

Run: `npx tsc --noEmit && npx next build`
Expected: no type errors; build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/lib/ndjson.ts src/lib/fakeScenarios.ts src/lib/http.ts src/app/api tests/unit/ndjson.test.ts tests/unit/api.test.ts
git commit -m "feat: streaming run/synthesize/settings API with fake scenario mode"
```

---

### Task 7: Design system, terminal shell, prompt line

**Files:**
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `src/components/TerminalWindow.tsx`, `src/components/Prompt.tsx`, `src/components/Hero.tsx`, `src/components/PromptLine.tsx`
- Create: `playwright.config.ts`
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `MAX_QUESTION_CHARS` (Task 3).
- Produces:
  - `TerminalWindow({ status: "running" | "idle"; onSettings?: () => void; children })`
  - `Prompt({ cmd: string; children? })`
  - `Hero()`
  - `PromptLine({ running: boolean; onAsk: (q: string) => void; onStop: () => void })`
  - Test IDs used by later tasks: `hero`, `status`, `question`, `ask`, `stop`, `question-too-long`, `settings-link`.

- [ ] **Step 1: Context7 lookup**

Query `/vercel/next.js/v16.2.9` for "next/font/google multiple fonts variable CSS custom property in layout". Look up Playwright (`resolve-library-id` "Playwright") for "webServer config env reuseExistingServer workers".

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { COUNCIL_FAKE: "1", COUNCIL_SETTINGS_PATH: ".e2e-settings.json" },
  },
});
```

Then run: `npx playwright install chromium`

- [ ] **Step 3: Write the failing e2e test**

`tests/e2e/shell.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("idle page shows the terminal frame, hero and prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero")).toContainText("model-council");
  await expect(page.getByTestId("status")).toHaveText("idle");
  await expect(page.getByTestId("ask")).toBeDisabled();
});

test("ask is disabled for a whitespace-only question and enabled for text", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("question").fill("   ");
  await expect(page.getByTestId("ask")).toBeDisabled();
  await page.getByTestId("question").fill("hello");
  await expect(page.getByTestId("ask")).toBeEnabled();
});

test("ask is disabled and the limit is shown for an over-long question", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("question").fill("x".repeat(20_001));
  await expect(page.getByTestId("ask")).toBeDisabled();
  await expect(page.getByTestId("question-too-long")).toContainText("20,000");
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx playwright test tests/e2e/shell.spec.ts`
Expected: FAIL. There is no page yet, so Next serves a 404 and the `hero` test ID is not found.

- [ ] **Step 5: Create `src/app/globals.css`**

```css
:root {
  --bg: #000000;
  --panel: #050805;
  --panel-lift: #070b07;
  --line: #143614;
  --line-bright: #1f4d1f;
  --green: #39ff7a;
  --green-dim: #2bbf5c;
  --green-faint: #1c7a3c;
  --sage: #5f8d68;
  --prose: #a9c9b0;
  --ink: #eafff1;
  --amber: #ffd24a;
  --cyan: #5cf6ff;
  --dot-red: #ff5f56;
  --dot-amber: #ffbd2e;
  --dot-green: #27c93f;
  --glow: 0 0 8px rgba(57, 255, 122, 0.45), 0 0 24px rgba(57, 255, 122, 0.18);
  --glow-soft: 0 0 6px rgba(57, 255, 122, 0.3);
  --radius-sm: 3px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --font: var(--font-jb), var(--font-plex), ui-monospace, monospace;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  color: var(--sage);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.6;
}

body {
  min-height: 100vh;
  padding: 32px 16px;
  background:
    radial-gradient(900px 600px at 85% -10%, rgba(57, 255, 122, 0.08), transparent 60%),
    radial-gradient(700px 500px at -10% 40%, rgba(57, 255, 122, 0.05), transparent 60%),
    var(--bg);
}

::selection { background: rgba(57, 255, 122, 0.3); color: var(--ink); }

.scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  background: repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0, 0, 0, 0.16) 3px, transparent 4px);
  mix-blend-mode: multiply;
  opacity: 0.5;
}

.glow { text-shadow: var(--glow); }
.glow-soft { text-shadow: var(--glow-soft); }

@keyframes blink { 50% { opacity: 0; } }

.cursor {
  display: inline-block;
  width: 0.6em;
  height: 1em;
  margin-left: 4px;
  background: var(--green);
  vertical-align: baseline;
  box-shadow: var(--glow-soft);
  animation: blink 1.1s step-end infinite;
}

/* window frame */
.window {
  max-width: 1360px;
  margin: 0 auto;
  background: var(--panel);
  border: 1px solid var(--line-bright);
  border-radius: var(--radius-lg);
  box-shadow: 0 0 40px rgba(57, 255, 122, 0.08);
  overflow: hidden;
}
.titlebar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--panel-lift);
  border-bottom: 1px solid var(--line);
}
.dots { display: flex; gap: 6px; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot.red { background: var(--dot-red); }
.dot.amber { background: var(--dot-amber); }
.dot.green { background: var(--dot-green); }
.path .hi { color: var(--green); }
.titlebar nav { margin-left: auto; display: flex; gap: 18px; align-items: center; }
.navlink { color: var(--sage); background: none; border: 0; font: inherit; cursor: pointer; padding: 0; }
.navlink:hover { color: var(--green); text-shadow: var(--glow-soft); }
.status { display: inline-flex; align-items: center; gap: 6px; color: var(--amber); }
.status .blip {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 8px rgba(255, 210, 74, 0.6);
  animation: blink 1.1s step-end infinite;
}
.status.idle { color: var(--sage); }
.status.idle .blip { background: var(--green-faint); box-shadow: none; animation: none; }

/* session */
.session { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.prompt { color: var(--sage); white-space: pre-wrap; }
.prompt .host { color: var(--cyan); }
.prompt .dollar { color: var(--green); }
.prompt .cmd { color: var(--ink); }
.rule { height: 1px; border: 0; margin: 0; background: linear-gradient(to right, transparent, var(--line-bright), transparent); }

.hero-banner {
  margin: 4px 0;
  font-size: 44px !important;
  font-weight: 800;
  line-height: 1.1;
  color: var(--ink);
  text-shadow: var(--glow);
}
.hero-role { color: var(--green); text-shadow: var(--glow-soft); margin: 0; }
.hero-meta { margin: 6px 0 0; color: var(--sage); }

.ask { display: flex; align-items: flex-start; gap: 8px; }
.ask textarea {
  flex: 1;
  min-height: 1.6em;
  padding: 0;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  caret-color: var(--green);
}
.btn {
  font: inherit;
  font-weight: 700;
  padding: 2px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--green);
  color: #001a08;
  cursor: pointer;
  box-shadow: 0 0 12px rgba(57, 255, 122, 0.35);
}
.btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
.btn-ghost {
  font: inherit;
  padding: 2px 12px;
  border: 1px solid var(--line-bright);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--green);
  cursor: pointer;
}
.btn-ghost:hover { border-color: var(--green); text-shadow: var(--glow-soft); }
.notice { color: var(--ink); margin: 0; }
.comment { color: var(--green-dim); margin: 0; }

/* panels */
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-md); }
.panel-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--green);
}
.panel-body { padding: 12px; color: var(--prose); }
.answers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.answers .panel-body { max-height: 60vh; overflow: auto; }
.status-line { font-size: 12px; color: var(--sage); white-space: nowrap; }
.err { color: var(--ink); margin: 0; }
.tag {
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid var(--line-bright);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--green-dim);
}
.reviews { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }

/* decision meters */
.decision { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.meter-row { display: grid; grid-template-columns: 200px 1fr 56px 90px; gap: 12px; align-items: center; }
.meter { position: relative; height: 9px; background: #020402; border: 1px solid var(--line); border-radius: 2px; }
.meter-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(to right, var(--green-dim), var(--green));
  box-shadow: 0 0 8px rgba(57, 255, 122, 0.45);
}
.meter-threshold { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); opacity: 0.7; }
.fired { color: var(--amber); text-shadow: 0 0 8px rgba(255, 210, 74, 0.45); }

/* markdown */
.markdown > :first-child { margin-top: 0; }
.markdown h1, .markdown h2, .markdown h3, .markdown h4 { color: var(--ink); font-size: 1em; margin: 1em 0 0.4em; }
.markdown p { margin: 0 0 0.8em; }
.markdown strong { color: var(--ink); }
.markdown a { color: var(--green); }
.markdown code { color: var(--green); }
.markdown pre {
  padding: 10px;
  overflow: auto;
  background: #020402;
  border: 1px solid var(--line-bright);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 12px rgba(57, 255, 122, 0.06);
}
.markdown ul, .markdown ol { padding-left: 1.4em; }
.markdown table { border-collapse: collapse; }
.markdown th, .markdown td { border: 1px solid var(--line); padding: 2px 6px; }

/* footer */
.run-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--green-faint);
}

/* settings */
.kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; align-items: center; padding: 12px; }
.kv label { color: var(--green); }
.kv input {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #020402;
  color: var(--prose);
  font: inherit;
}
.kv input:focus { outline: none; border-color: var(--green); }
.actions { display: flex; gap: 8px; padding: 0 12px 12px; }

@media (max-width: 1000px) {
  .answers, .reviews { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .titlebar .path { display: none; }
  .meter-row { grid-template-columns: 1fr 56px; }
  .meter-row .meter { grid-column: 1 / -1; }
  .kv { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .cursor, .status .blip { animation: none; }
}
```

- [ ] **Step 6: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-jb" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "Model Council",
  description: "Three models answer and review each other; a decision model decides whether to synthesize.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create the shell components**

`src/components/TerminalWindow.tsx`:
```tsx
export function TerminalWindow({
  status,
  onSettings,
  children,
}: {
  status: "running" | "idle";
  onSettings?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="scanlines" aria-hidden />
      <main className="window">
        <header className="titlebar">
          <div className="dots" aria-hidden>
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
          </div>
          <span className="path">
            <span className="hi">council</span>@local: <span className="hi">~/ask</span>
          </span>
          <nav>
            {onSettings && (
              <button className="navlink" data-testid="settings-link" onClick={onSettings}>
                ~/settings
              </button>
            )}
            <span className={`status ${status}`}>
              <span className="blip" aria-hidden />
              <span data-testid="status">{status}</span>
            </span>
          </nav>
        </header>
        <div className="session">{children}</div>
      </main>
    </>
  );
}
```

`src/components/Prompt.tsx`:
```tsx
export function Prompt({ cmd, children }: { cmd: string; children?: React.ReactNode }) {
  return (
    <div className="prompt">
      <span className="host">council~/ask</span> <span className="dollar">$</span> <span className="cmd">{cmd}</span>
      {children ? <> {children}</> : null}
    </div>
  );
}
```

`src/components/Hero.tsx`:
```tsx
import { Prompt } from "./Prompt";

export function Hero() {
  return (
    <section data-testid="hero">
      <Prompt cmd="whoami --full" />
      <h1 className="hero-banner">
        model-council<span className="cursor" aria-hidden />
      </h1>
      <p className="hero-role">&gt; three models answer, review each other, and synthesize only when it adds something</p>
      <p className="hero-meta">[x] answer ×3 &nbsp; [x] review ×3 &nbsp; [x] decide &nbsp; [x] synthesize if needed</p>
    </section>
  );
}
```

`src/components/PromptLine.tsx`:
```tsx
"use client";

import { useState } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/prompts";

export function PromptLine({
  running,
  onAsk,
  onStop,
}: {
  running: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_QUESTION_CHARS;
  const canAsk = trimmed.length > 0 && !tooLong && !running;
  const submit = () => {
    if (canAsk) onAsk(trimmed);
  };

  return (
    <div>
      <div className="ask prompt">
        <span>
          <span className="host">council~/ask</span> <span className="dollar">$</span> <span className="cmd">ask &quot;</span>
        </span>
        <textarea
          aria-label="question"
          data-testid="question"
          rows={Math.min(8, text.split("\n").length)}
          value={text}
          disabled={running}
          placeholder="type a question…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <button className="btn-ghost" data-testid="stop" onClick={onStop}>
            ^C stop
          </button>
        ) : (
          <button className="btn" data-testid="ask" disabled={!canAsk} onClick={submit}>
            ask
          </button>
        )}
      </div>
      {tooLong && (
        <p className="notice" data-testid="question-too-long">
          question is {trimmed.length.toLocaleString("en-US")} characters; the limit is 20,000
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create a temporary `src/app/page.tsx`**

Task 8 replaces this with the working page.

```tsx
"use client";

import { Hero } from "@/components/Hero";
import { PromptLine } from "@/components/PromptLine";
import { TerminalWindow } from "@/components/TerminalWindow";

export default function Home() {
  return (
    <TerminalWindow status="idle">
      <Hero />
      <PromptLine running={false} onAsk={() => {}} onStop={() => {}} />
    </TerminalWindow>
  );
}
```

- [ ] **Step 9: Run e2e to verify it passes**

Run: `npx playwright test tests/e2e/shell.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Visual check**

Run: `npx next dev -p 3100`. Open http://localhost:3100 with the Chrome tools and take a screenshot. Check the following:
- black background with the green radial glows
- scanlines visible
- traffic-light dots in the title bar
- glowing `model-council` banner with a blinking block cursor
- monospace font throughout
- no purple

Stop the server afterwards.

- [ ] **Step 11: Commit**

```bash
git add playwright.config.ts src/app/layout.tsx src/app/globals.css src/app/page.tsx src/components tests/e2e/shell.spec.ts
git commit -m "feat: CRT terminal design system, window shell and prompt line"
```

---

### Task 8: Run view: reducer, hook and stage components

**Files:**
- Create: `src/lib/runState.ts`, `src/lib/useRun.ts`, `src/lib/format.ts`
- Create: `src/components/Markdown.tsx`, `AnswerPanel.tsx`, `ReviewsSection.tsx`, `DecisionPanel.tsx`, `SynthesisSection.tsx`, `RunFooter.tsx`, `RunView.tsx`
- Modify: `src/app/page.tsx` (replace whole file)
- Test: `tests/unit/runState.test.ts`, `tests/e2e/run.spec.ts`

**Interfaces:**
- Consumes:
  - Task 6: `readNdjson`, `POST /api/run`, `POST /api/synthesize`
  - Task 7: `TerminalWindow`, `Prompt`, `Hero`, `PromptLine`
  - Task 3: `QUESTION_KEYS`
  - Task 1: `RunEvent`, `DecisionEvent`, `RunDoneEvent`, `LABELS`
- Produces:
  - `runState.ts`:
    - types `AnswerView`, `ReviewView`, `SynthesisView`, `RunState`
    - `initialRunState`
    - `startRun(question): RunState`
    - `retryingSynthesis(s): RunState`
    - `stopRun(s): RunState`
    - `reduceRun(s, e: RunEvent): RunState`
  - `useRun(): { state: RunState; ask(q: string): Promise<void>; stop(): void; retrySynthesis(): Promise<void> }`
  - `format.ts`: `shortModel(id: string): string`, `formatCost(n: number, digits?: number): string`
  - Test IDs:
    - `answer-A`, `answer-B`, `answer-C`, each with a `data-status` attribute
    - `reviews-toggle`, `review-A` / `review-B` / `review-C`
    - `decision`, `meter-<key>`, `decider-fallback`, `no-decider`
    - `synthesis`, `synthesis-retry`, `skip-note`
    - `run-failed`, `run-stopped`, `run-footer`

- [ ] **Step 1: Context7 lookup**

Query react-markdown (`resolve-library-id` "react-markdown") for "react-markdown v10 usage with remark-gfm, default export, className". Query React (`resolve-library-id` "React") for "useRef latest state in async callback".

- [ ] **Step 2: Write the failing reducer tests**

`tests/unit/runState.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reduceRun, retryingSynthesis, startRun, stopRun } from "../../src/lib/runState";
import type { RunEvent, Settings } from "../../src/lib/events";

const settings: Settings = { answerModels: ["m/a", "m/b", "m/c"], synthesizer: "m/s", deciders: ["d/j"], threshold: 0.6 };
const apply = (events: RunEvent[]) => events.reduce(reduceRun, startRun("Q?"));
const started: RunEvent = { type: "run_started", runId: "r", settings };

describe("reduceRun", () => {
  it("creates three pending answers on run_started", () => {
    const s = apply([started]);
    expect(s.phase).toBe("running");
    expect(s.answers.map((a) => [a.label, a.model, a.status])).toEqual([
      ["A", "m/a", "pending"],
      ["B", "m/b", "pending"],
      ["C", "m/c", "pending"],
    ]);
    expect(s.synthesis.model).toBe("m/s");
  });

  it("accumulates deltas then replaces with the final text", () => {
    const s1 = apply([
      started,
      { type: "answer_delta", label: "A", model: "m/a", text: "Hel" },
      { type: "answer_delta", label: "A", model: "m/a", text: "lo" },
    ]);
    expect(s1.answers[0]).toMatchObject({ status: "streaming", text: "Hello" });
    const s2 = reduceRun(s1, { type: "answer_done", label: "A", model: "m/a", text: "Hello!", truncated: true, cost: 0.01 });
    expect(s2.answers[0]).toMatchObject({ status: "done", text: "Hello!", truncated: true, cost: 0.01 });
  });

  it("records errors, reviews, skip and totals", () => {
    const s = apply([
      started,
      { type: "answer_error", label: "B", model: "m/b", message: "boom" },
      { type: "review_done", reviewer: "A", model: "m/a", text: "ok", cost: 0 },
      { type: "review_error", reviewer: "C", model: "m/c", message: "slow" },
      { type: "skipped" },
      { type: "run_done", totalCost: 0.05, costByStage: { answers: 0.03, reviews: 0.02, decision: 0, synthesis: 0 } },
    ]);
    expect(s.answers[1]).toMatchObject({ status: "error", error: "boom" });
    expect(s.reviews.map((r) => [r.reviewer, r.status])).toEqual([
      ["A", "done"],
      ["C", "error"],
    ]);
    expect(s.skipped).toBe(true);
    expect(s.phase).toBe("done");
    expect(s.totals?.totalCost).toBe(0.05);
  });

  it("a retried synthesis resets text and adds its cost to the totals", () => {
    let s = apply([
      started,
      { type: "synthesis_error", model: "m/s", message: "outage" },
      { type: "run_done", totalCost: 0.05, costByStage: { answers: 0.03, reviews: 0.02, decision: 0, synthesis: 0 } },
    ]);
    expect(s.synthesis).toMatchObject({ status: "error", error: "outage" });
    s = retryingSynthesis(s);
    expect(s.phase).toBe("running");
    expect(s.synthesis).toMatchObject({ status: "streaming", text: "" });
    s = reduceRun(s, { type: "synthesis_delta", text: "Comb" });
    s = reduceRun(s, { type: "synthesis_done", model: "m/s", text: "Combined", cost: 0.01 });
    expect(s.synthesis).toMatchObject({ status: "done", text: "Combined" });
    expect(s.totals?.totalCost).toBeCloseTo(0.06);
    expect(s.totals?.costByStage.synthesis).toBeCloseTo(0.01);
  });

  it("stopRun marks a running run as stopped and leaves a finished run alone", () => {
    expect(stopRun(apply([started]))).toMatchObject({ phase: "done", stopped: true });
    const finished = apply([started, { type: "run_done", totalCost: 0, costByStage: { answers: 0, reviews: 0, decision: 0, synthesis: 0 } }]);
    expect(stopRun(finished).stopped).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/runState.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/runState`.

- [ ] **Step 4: Implement `src/lib/runState.ts`**

```ts
import { LABELS, type DecisionEvent, type Label, type RunDoneEvent, type RunEvent, type Settings } from "./events";

export interface AnswerView {
  label: Label;
  model: string;
  status: "pending" | "streaming" | "done" | "error";
  text: string;
  truncated: boolean;
  cost: number;
  error?: string;
}

export interface ReviewView {
  reviewer: Label;
  model: string;
  status: "done" | "error";
  text: string;
  error?: string;
}

export interface SynthesisView {
  status: "idle" | "streaming" | "done" | "error";
  model: string;
  text: string;
  cost: number;
  error?: string;
}

export interface RunState {
  phase: "idle" | "running" | "done";
  question: string;
  settings: Settings | null;
  answers: AnswerView[];
  reviews: ReviewView[];
  decision: DecisionEvent | null;
  synthesis: SynthesisView;
  skipped: boolean;
  failedReason: string | null;
  stopped: boolean;
  totals: RunDoneEvent | null;
}

const emptySynthesis: SynthesisView = { status: "idle", model: "", text: "", cost: 0 };

export const initialRunState: RunState = {
  phase: "idle",
  question: "",
  settings: null,
  answers: [],
  reviews: [],
  decision: null,
  synthesis: emptySynthesis,
  skipped: false,
  failedReason: null,
  stopped: false,
  totals: null,
};

export function startRun(question: string): RunState {
  return { ...initialRunState, phase: "running", question };
}

export function retryingSynthesis(s: RunState): RunState {
  return { ...s, phase: "running", synthesis: { ...s.synthesis, status: "streaming", text: "", error: undefined } };
}

export function stopRun(s: RunState): RunState {
  return s.phase === "running" ? { ...s, phase: "done", stopped: true } : s;
}

function updateAnswer(s: RunState, label: Label, patch: (a: AnswerView) => AnswerView): RunState {
  return { ...s, answers: s.answers.map((a) => (a.label === label ? patch(a) : a)) };
}

export function reduceRun(s: RunState, e: RunEvent): RunState {
  switch (e.type) {
    case "run_started":
      return {
        ...s,
        settings: e.settings,
        answers: e.settings.answerModels.map((model, i) => ({
          label: LABELS[i],
          model,
          status: "pending",
          text: "",
          truncated: false,
          cost: 0,
        })),
        synthesis: { ...emptySynthesis, model: e.settings.synthesizer },
      };
    case "answer_delta":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "streaming", text: a.text + e.text }));
    case "answer_done":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "done", text: e.text, truncated: e.truncated, cost: e.cost }));
    case "answer_error":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "error", error: e.message }));
    case "review_done":
      return { ...s, reviews: [...s.reviews, { reviewer: e.reviewer, model: e.model, status: "done", text: e.text }] };
    case "review_error":
      return {
        ...s,
        reviews: [...s.reviews, { reviewer: e.reviewer, model: e.model, status: "error", text: "", error: e.message }],
      };
    case "decision":
      return { ...s, decision: e };
    case "synthesis_delta":
      return { ...s, synthesis: { ...s.synthesis, status: "streaming", text: s.synthesis.text + e.text } };
    case "synthesis_done": {
      // During a normal run totals is still null (run_done comes later and carries the cost).
      // After a retry, totals exists and the new cost is added to it.
      const totals = s.totals
        ? {
            ...s.totals,
            totalCost: s.totals.totalCost + e.cost,
            costByStage: { ...s.totals.costByStage, synthesis: s.totals.costByStage.synthesis + e.cost },
          }
        : null;
      return { ...s, totals, synthesis: { status: "done", model: e.model, text: e.text, cost: e.cost } };
    }
    case "synthesis_error":
      return { ...s, synthesis: { ...s.synthesis, status: "error", model: e.model, error: e.message } };
    case "skipped":
      return { ...s, skipped: true };
    case "run_failed":
      return { ...s, failedReason: e.reason };
    case "run_done":
      return { ...s, phase: "done", totals: e };
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/runState.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Implement `src/lib/format.ts` and `src/lib/useRun.ts`**

`src/lib/format.ts`:
```ts
export function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

export function formatCost(n: number, digits = 3): string {
  return `$${n.toFixed(digits)}`;
}
```

`src/lib/useRun.ts`:
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent } from "./events";
import { readNdjson } from "./ndjson";
import { initialRunState, reduceRun, retryingSynthesis, startRun, stopRun, type RunState } from "./runState";

const finishIfRunning = (s: RunState): RunState => (s.phase === "running" ? { ...s, phase: "done" } : s);

async function errorFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export function useRun() {
  const [state, setState] = useState<RunState>(initialRunState);
  const stateRef = useRef(state);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const apply = useCallback((e: RunEvent) => setState((s) => reduceRun(s, e)), []);

  const stream = useCallback(
    async (url: string, body: unknown, onHttpError: (message: string) => void) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: c.signal,
        });
        if (!res.ok || !res.body) {
          onHttpError(await errorFrom(res));
          return;
        }
        await readNdjson<RunEvent>(res.body, apply);
      } catch (err) {
        if (!c.signal.aborted) onHttpError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!c.signal.aborted) setState(finishIfRunning);
      }
    },
    [apply],
  );

  const ask = useCallback(
    async (question: string) => {
      setState(startRun(question));
      await stream("/api/run", { question }, (reason) => apply({ type: "run_failed", reason }));
    },
    [apply, stream],
  );

  const retrySynthesis = useCallback(async () => {
    const s = stateRef.current;
    if (!s.decision) return;
    const answers = Object.fromEntries(s.answers.filter((a) => a.status === "done").map((a) => [a.label, a.text]));
    const reviews = Object.fromEntries(s.reviews.filter((r) => r.status === "done").map((r) => [r.reviewer, r.text]));
    setState(retryingSynthesis);
    await stream(
      "/api/synthesize",
      { question: s.question, answers, reviews, fired: s.decision.fired },
      (message) => apply({ type: "synthesis_error", model: s.synthesis.model, message }),
    );
  }, [apply, stream]);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setState(stopRun);
  }, []);

  return { state, ask, stop, retrySynthesis };
}
```

- [ ] **Step 7: Implement the stage components**

`src/components/Markdown.tsx`:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
```

`src/components/AnswerPanel.tsx`:
```tsx
import type { AnswerView } from "@/lib/runState";
import { formatCost, shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";

const STATUS: Record<AnswerView["status"], (a: AnswerView) => string> = {
  pending: () => "○ waiting",
  streaming: () => "● streaming…",
  done: (a) => `✓ done · ${formatCost(a.cost)}`,
  error: () => "✗ error",
};

export function AnswerPanel({ answer }: { answer: AnswerView }) {
  return (
    <div className="panel" data-testid={`answer-${answer.label}`} data-status={answer.status}>
      <div className="panel-title">
        <span className="glow-soft">
          {answer.label.toLowerCase()}/ {shortModel(answer.model)}
        </span>
        <span className="status-line">
          {STATUS[answer.status](answer)}
          {answer.truncated && <span className="tag">[truncated]</span>}
        </span>
      </div>
      <div className="panel-body">
        {answer.status === "error" ? <p className="err">✗ error: {answer.error}</p> : <Markdown text={answer.text} />}
      </div>
    </div>
  );
}
```

`src/components/ReviewsSection.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { ReviewView } from "@/lib/runState";
import { shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";
import { Prompt } from "./Prompt";

export function ReviewsSection({ reviews }: { reviews: ReviewView[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...reviews].sort((a, b) => a.reviewer.localeCompare(b.reviewer));
  return (
    <section>
      <Prompt cmd="council review">
        <button className="navlink" data-testid="reviews-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "[-] collapse" : `[+] expand ${reviews.length} reviews`}
        </button>
      </Prompt>
      {open && (
        <div className="reviews">
          {sorted.map((r) => (
            <div className="panel" key={r.reviewer} data-testid={`review-${r.reviewer}`}>
              <div className="panel-title">
                <span>
                  review by {r.reviewer.toLowerCase()}/ {shortModel(r.model)}
                </span>
              </div>
              <div className="panel-body">
                {r.status === "error" ? <p className="err">✗ error: {r.error}</p> : <Markdown text={r.text} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

`src/components/DecisionPanel.tsx`:
```tsx
import type { DecisionEvent, QuestionKey } from "@/lib/events";
import { QUESTION_KEYS } from "@/lib/prompts";
import { shortModel } from "@/lib/format";
import { Prompt } from "./Prompt";

const ROW_LABEL: Record<QuestionKey, string> = {
  disagreement: "disagreement",
  unique_fact: "unique_fact",
  unique_caveat: "unique_caveat",
  unique_recommendation: "unique_recommend",
};

export function DecisionPanel({ decision }: { decision: DecisionEvent }) {
  const { deciderUsed, attempts, probabilities, fired, threshold } = decision;
  const via = deciderUsed ? shortModel(deciderUsed) : "none";
  const unavailable = attempts.filter((a) => a.error).map((a) => shortModel(a.model));

  return (
    <section data-testid="decision">
      <Prompt cmd={`decide --via ${via} --threshold ${threshold.toFixed(2)}`} />
      <div className="panel decision">
        {deciderUsed && unavailable.length > 0 && (
          <p className="comment" data-testid="decider-fallback">
            # via {via} ({unavailable.join(", ")} unavailable)
          </p>
        )}
        {!deciderUsed && (
          <p className="notice" data-testid="no-decider">
            no decider available · synthesizing by default
          </p>
        )}
        {probabilities &&
          QUESTION_KEYS.map((k) => {
            const p = probabilities[k];
            return (
              <div className="meter-row" key={k} data-testid={`meter-${k}`}>
                <span>{ROW_LABEL[k]}</span>
                <div className="meter" role="meter" aria-label={k} aria-valuemin={0} aria-valuemax={1} aria-valuenow={p}>
                  <div className="meter-fill" style={{ width: `${p * 100}%` }} />
                  <div className="meter-threshold" style={{ left: `${threshold * 100}%` }} />
                </div>
                <span className="glow-soft">{p.toFixed(2)}</span>
                <span className="fired">{fired.includes(k) ? "◆ fired" : ""}</span>
              </div>
            );
          })}
      </div>
    </section>
  );
}
```

`src/components/SynthesisSection.tsx`:
```tsx
import type { RunState } from "@/lib/runState";
import { formatCost, shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";
import { Prompt } from "./Prompt";

export function SynthesisSection({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  if (state.skipped) {
    return (
      <p className="comment" data-testid="skip-note">
        # [x] models agreed · synthesizer skipped
      </p>
    );
  }
  if (!state.decision?.synthesize) return null;

  const { synthesis } = state;
  const status =
    synthesis.status === "done"
      ? `✓ done · ${formatCost(synthesis.cost)}`
      : synthesis.status === "error"
        ? "✗ error"
        : "● streaming…";

  return (
    <section>
      <Prompt cmd={`synthesize --model ${shortModel(synthesis.model)}`} />
      <div className="panel" data-testid="synthesis">
        <div className="panel-title">
          <span className="glow-soft">combined answer</span>
          <span className="status-line">{status}</span>
        </div>
        <div className="panel-body">
          {synthesis.status === "error" ? (
            <>
              <p className="err">✗ error: {synthesis.error}</p>
              <button className="btn-ghost" data-testid="synthesis-retry" onClick={onRetry}>
                $ synthesize --retry
              </button>
            </>
          ) : (
            <Markdown text={synthesis.text} />
          )}
        </div>
      </div>
    </section>
  );
}
```

`src/components/RunFooter.tsx`:
```tsx
import type { RunState } from "@/lib/runState";
import { formatCost } from "@/lib/format";

export function RunFooter({ state }: { state: RunState }) {
  const t = state.totals;
  const label = state.phase === "running" ? "running…" : state.stopped ? "stopped" : "run complete";
  return (
    <div className="run-footer" data-testid="run-footer">
      <span>
        $ echo &quot;{label}&quot;
        <span className="cursor" aria-hidden />
      </span>
      {t && (
        <span>
          cost {formatCost(t.totalCost)} · ans {formatCost(t.costByStage.answers)} · rev {formatCost(t.costByStage.reviews)} ·
          decide {formatCost(t.costByStage.decision, 4)} · synth {formatCost(t.costByStage.synthesis)}
        </span>
      )}
    </div>
  );
}
```

`src/components/RunView.tsx`:
```tsx
import type { RunState } from "@/lib/runState";
import { AnswerPanel } from "./AnswerPanel";
import { DecisionPanel } from "./DecisionPanel";
import { Prompt } from "./Prompt";
import { ReviewsSection } from "./ReviewsSection";
import { RunFooter } from "./RunFooter";
import { SynthesisSection } from "./SynthesisSection";

export function RunView({ state, onRetrySynthesis }: { state: RunState; onRetrySynthesis: () => void }) {
  return (
    <>
      <hr className="rule" />
      <Prompt cmd={`council answer --models ${state.answers.length || 3}`} />
      <div className="answers">
        {state.answers.map((a) => (
          <AnswerPanel key={a.label} answer={a} />
        ))}
      </div>
      {state.reviews.length > 0 && <ReviewsSection reviews={state.reviews} />}
      {state.decision && <DecisionPanel decision={state.decision} />}
      <SynthesisSection state={state} onRetry={onRetrySynthesis} />
      {state.failedReason && (
        <p className="notice" data-testid="run-failed">
          ✗ {state.failedReason}
        </p>
      )}
      {state.stopped && (
        <p className="comment" data-testid="run-stopped">
          # ^C: run stopped
        </p>
      )}
      <RunFooter state={state} />
    </>
  );
}
```

- [ ] **Step 8: Replace `src/app/page.tsx`**

```tsx
"use client";

import { Hero } from "@/components/Hero";
import { PromptLine } from "@/components/PromptLine";
import { RunView } from "@/components/RunView";
import { TerminalWindow } from "@/components/TerminalWindow";
import { useRun } from "@/lib/useRun";

export default function Home() {
  const { state, ask, stop, retrySynthesis } = useRun();
  const running = state.phase === "running";

  return (
    <TerminalWindow status={running ? "running" : "idle"}>
      {state.phase === "idle" && <Hero />}
      <PromptLine running={running} onAsk={ask} onStop={stop} />
      {state.phase !== "idle" && <RunView state={state} onRetrySynthesis={retrySynthesis} />}
    </TerminalWindow>
  );
}
```

- [ ] **Step 9: Write the e2e tests**

`tests/e2e/run.spec.ts`:
```ts
import { test, expect, type Page } from "@playwright/test";

async function ask(page: Page, question: string) {
  await page.goto("/");
  await page.getByTestId("question").fill(question);
  await page.getByTestId("ask").click();
}

test("synthesize path: answers, decision with a fired signal, combined answer", async ({ page }) => {
  await ask(page, "[synth] how should I shard postgres?");
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
  for (const l of ["A", "B", "C"]) await expect(page.getByTestId(`answer-${l}`)).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("meter-unique_fact")).toContainText("◆ fired");
  await expect(page.getByTestId("meter-disagreement")).not.toContainText("fired");
  await expect(page.getByTestId("run-footer")).toContainText("run complete");
  await expect(page.getByTestId("status")).toHaveText("idle");
});

test("skip path: no synthesis panel, skip note shown", async ({ page }) => {
  await ask(page, "[skip] boiling point of water?");
  await expect(page.getByTestId("skip-note")).toContainText("synthesizer skipped");
  await expect(page.getByTestId("synthesis")).toHaveCount(0);
});

test("one model fails: its panel shows the error and the run continues", async ({ page }) => {
  await ask(page, "[error] question");
  await expect(page.getByTestId("answer-B")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("answer-B")).toContainText("simulated provider error");
  await expect(page.getByTestId("decision")).toBeVisible();
  await expect(page.getByTestId("reviews-toggle")).toContainText("expand 2 reviews");
});

test("two models fail: run fails with a reason and no decision", async ({ page }) => {
  await ask(page, "[fail] question");
  await expect(page.getByTestId("run-failed")).toContainText("at least 2 are needed");
  await expect(page.getByTestId("decision")).toHaveCount(0);
});

test("no decider: notice shown and synthesis runs by default", async ({ page }) => {
  await ask(page, "[nodecider] question");
  await expect(page.getByTestId("no-decider")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
});

test("reviews expand on click", async ({ page }) => {
  await ask(page, "[synth] question");
  await page.getByTestId("reviews-toggle").click();
  await expect(page.getByTestId("review-A")).toContainText("Strengths");
});

test("synthesis failure can be retried without re-running the answers", async ({ page }) => {
  await ask(page, "[synthfail] question");
  await expect(page.getByTestId("synthesis")).toContainText("simulated synthesizer outage");
  await page.getByTestId("synthesis-retry").click();
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
});

test("stop cancels a running question", async ({ page }) => {
  await ask(page, "[slow] question");
  await expect(page.getByTestId("status")).toHaveText("running");
  await page.getByTestId("stop").click();
  await expect(page.getByTestId("run-stopped")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("idle");
  await expect(page.getByTestId("answer-A")).toHaveAttribute("data-status", "pending");
});
```

- [ ] **Step 10: Run unit and e2e tests**

Run: `npm test && npx playwright test`
Expected: all unit tests pass; all 11 e2e tests pass (3 shell + 8 run).

- [ ] **Step 11: Visual check**

Run `npx next dev -p 3100` with `COUNCIL_FAKE=1`. Ask `[synth] test` and screenshot it, then ask `[skip] test` and screenshot it. Check the following:
- the three answer panels sit side by side and each scrolls on its own
- the meter fills glow
- the threshold tick is visible
- `◆ fired` is amber
- amber appears nowhere else except the `running` status blip

Stop the server.

- [ ] **Step 12: Commit**

```bash
git add src/lib/runState.ts src/lib/useRun.ts src/lib/format.ts src/components src/app/page.tsx tests/unit/runState.test.ts tests/e2e/run.spec.ts
git commit -m "feat: live run view with answers, reviews, decision meters, synthesis/skip, stop and retry"
```

---

### Task 9: Settings panel and missing-key notice

**Files:**
- Create: `src/components/SettingsPanel.tsx`
- Modify: `src/app/page.tsx` (replace whole file)
- Test: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes:
  - `GET /api/settings` and `PUT /api/settings` (Task 6)
  - `TerminalWindow` with `onSettings` (Task 7)
  - `Prompt` (Task 7)
  - `Settings` (Task 1)
- Produces:
  - `SettingsPanel({ onClose: () => void })`
  - Test IDs:
    - `settings-panel`
    - `setting-answer_1`, `setting-answer_2`, `setting-answer_3`, `setting-synthesizer`, `setting-decider_1`, `setting-decider_2`, `setting-threshold`
    - `settings-save`, `settings-reset`, `settings-close`
    - `settings-errors`, `settings-saved`, `settings-warning`
    - `missing-key`

- [ ] **Step 1: Write the failing e2e tests**

`tests/e2e/settings.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test.afterEach(async ({ request }) => {
  const { defaults } = await (await request.get("/api/settings")).json();
  await request.put("/api/settings", { data: defaults });
});

test("shows the current settings, saves a new threshold, and keeps it after reopening", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("setting-answer_1")).toHaveValue("openai/gpt-6.1-sol");
  await expect(page.getByTestId("setting-decider_1")).toHaveValue("typesafe/jev-1.13");
  await page.getByTestId("setting-threshold").fill("0.95");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-saved")).toBeVisible();
  await page.getByTestId("settings-close").click();
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("setting-threshold")).toHaveValue("0.95");
});

test("rejects an invalid threshold with a readable error", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await page.getByTestId("setting-threshold").fill("2");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-errors")).toContainText("threshold");
});

test("reset restores the defaults", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await page.getByTestId("setting-synthesizer").fill("x/other");
  await page.getByTestId("settings-save").click();
  await page.getByTestId("settings-reset").click();
  await expect(page.getByTestId("setting-synthesizer")).toHaveValue("anthropic/claude-sonnet-5.5");
});

test("a corrupt settings file shows a warning in the panel", async ({ page }) => {
  const fs = await import("node:fs/promises");
  await fs.writeFile(".e2e-settings.json", "{ not json", "utf8");
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("settings-warning")).toContainText("not valid JSON");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/e2e/settings.spec.ts`
Expected: FAIL — `settings-link` not found (the page passes no `onSettings` yet).

- [ ] **Step 3: Implement `src/components/SettingsPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/events";
import { Prompt } from "./Prompt";

const FIELDS = ["answer_1", "answer_2", "answer_3", "synthesizer", "decider_1", "decider_2", "threshold"] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string>;

function toForm(s: Settings): Form {
  return {
    answer_1: s.answerModels[0],
    answer_2: s.answerModels[1],
    answer_3: s.answerModels[2],
    synthesizer: s.synthesizer,
    decider_1: s.deciders[0] ?? "",
    decider_2: s.deciders[1] ?? "",
    threshold: String(s.threshold),
  };
}

function fromForm(f: Form) {
  return {
    answerModels: [f.answer_1, f.answer_2, f.answer_3],
    synthesizer: f.synthesizer,
    deciders: [f.decider_1, f.decider_2].map((d) => d.trim()).filter(Boolean),
    threshold: f.threshold.trim() === "" ? Number.NaN : Number(f.threshold),
  };
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { settings: Settings; defaults: Settings; warning: string | null }) => {
        setForm(toForm(d.settings));
        setDefaults(d.defaults);
        setWarning(d.warning);
      })
      .catch((e) => setErrors([String(e)]));
  }, []);

  async function save(next: Form) {
    setErrors([]);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromForm(next)),
    });
    const body = await res.json();
    if (!res.ok) {
      setErrors(body.errors ?? [`HTTP ${res.status}`]);
      return;
    }
    setForm(toForm(body.settings));
    setWarning(null);
    setSaved(true);
  }

  return (
    <section data-testid="settings-panel">
      <Prompt cmd="cat ~/.council/settings.json" />
      <div className="panel">
        <div className="panel-title">
          <span className="glow-soft">council@settings ----------</span>
        </div>
        {warning && (
          <p className="notice" data-testid="settings-warning" style={{ padding: "8px 12px 0" }}>
            ! {warning}
          </p>
        )}
        {form && (
          <div className="kv">
            {FIELDS.map((f) => (
              <div key={f} style={{ display: "contents" }}>
                <label htmlFor={`setting-${f}`}>{f}</label>
                <input
                  id={`setting-${f}`}
                  data-testid={`setting-${f}`}
                  value={form[f]}
                  spellCheck={false}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <p className="notice" data-testid="settings-errors" style={{ padding: "0 12px 8px" }}>
            ✗ {errors.join("; ")}
          </p>
        )}
        {saved && (
          <p className="comment" data-testid="settings-saved" style={{ padding: "0 12px 8px" }}>
            # [x] saved
          </p>
        )}
        <div className="actions">
          <button className="btn" data-testid="settings-save" disabled={!form} onClick={() => form && save(form)}>
            $ save
          </button>
          <button
            className="btn-ghost"
            data-testid="settings-reset"
            disabled={!defaults}
            onClick={() => defaults && save(toForm(defaults))}
          >
            $ reset --defaults
          </button>
          <button className="btn-ghost" data-testid="settings-close" onClick={onClose}>
            :q
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { PromptLine } from "@/components/PromptLine";
import { RunView } from "@/components/RunView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TerminalWindow } from "@/components/TerminalWindow";
import { useRun } from "@/lib/useRun";

export default function Home() {
  const { state, ask, stop, retrySynthesis } = useRun();
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const running = state.phase === "running";

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { hasKey: boolean }) => setHasKey(d.hasKey))
      .catch(() => setHasKey(true));
  }, []);

  return (
    <TerminalWindow status={running ? "running" : "idle"} onSettings={() => setShowSettings((v) => !v)}>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {state.phase === "idle" && <Hero />}
      {hasKey === false ? (
        <p className="notice" data-testid="missing-key">
          ✗ OPENROUTER_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart `npm run dev`.
        </p>
      ) : (
        <PromptLine running={running} onAsk={ask} onStop={stop} />
      )}
      {state.phase !== "idle" && <RunView state={state} onRetrySynthesis={retrySynthesis} />}
    </TerminalWindow>
  );
}
```

- [ ] **Step 5: Run all tests**

Run: `npm test && npx playwright test`
Expected: all unit tests pass; all 15 e2e tests pass (3 shell + 8 run + 4 settings).

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.tsx src/app/page.tsx tests/e2e/settings.spec.ts
git commit -m "feat: settings panel (neofetch style) and missing-key notice"
```

---

### Task 10: Calibration script and README

**Files:**
- Create: `scripts/calibrate.ts`, `README.md`

**Interfaces:**
- Consumes:
  - `runCouncil` (Task 5)
  - `createOpenRouterClient` (Task 2)
  - `loadSettings` (Task 1)
  - `QUESTION_KEYS` (Task 3)
  - `DecisionEvent`, `RunEvent` (Task 1)
- Produces:
  - `npm run calibrate`: prints one line per case with the expected result, the actual result, the decider used, the four probabilities, and the cost.

- [ ] **Step 1: Write `scripts/calibrate.ts`**

```ts
import { createOpenRouterClient } from "../src/lib/openrouter";
import { loadSettings } from "../src/lib/settings";
import { runCouncil } from "../src/lib/pipeline";
import { QUESTION_KEYS } from "../src/lib/prompts";
import type { DecisionEvent, RunEvent } from "../src/lib/events";

const CASES: { expect: "skip" | "synthesize"; question: string }[] = [
  { expect: "skip", question: "What is the boiling point of water at sea level, in Celsius?" },
  { expect: "skip", question: "What is the capital of Japan?" },
  { expect: "skip", question: "How many bytes are in a kibibyte?" },
  { expect: "synthesize", question: "Should a three-person startup build its first product as microservices or a monolith? Recommend one." },
  { expect: "synthesize", question: "What is the best way for an experienced developer to learn a new programming language?" },
  { expect: "synthesize", question: "Is it better to rent or buy a home in a large city? Give your recommendation." },
];

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }
  const { settings } = await loadSettings();
  const client = createOpenRouterClient();
  console.log(`threshold ${settings.threshold}\n`);
  console.log(["expect", "actual", "decider", ...QUESTION_KEYS.map((k) => k.slice(0, 12)), "cost", "question"].join("\t"));

  let mismatches = 0;
  for (const c of CASES) {
    const seen: { decision?: DecisionEvent; cost: number; failed?: string } = { cost: 0 };
    await runCouncil({
      question: c.question,
      settings,
      client,
      emit: (e: RunEvent) => {
        if (e.type === "decision") seen.decision = e;
        if (e.type === "run_done") seen.cost = e.totalCost;
        if (e.type === "run_failed") seen.failed = e.reason;
      },
    });
    const d = seen.decision;
    const actual = seen.failed ? "failed" : d?.synthesize ? "synthesize" : "skip";
    if (actual !== c.expect) mismatches++;
    const probs = QUESTION_KEYS.map((k) => (d?.probabilities ? d.probabilities[k].toFixed(2) : "--"));
    console.log(
      [c.expect, actual, d?.deciderUsed ?? "none", ...probs, `$${seen.cost.toFixed(3)}`, c.question.slice(0, 50)].join("\t"),
    );
  }
  console.log(`\n${CASES.length - mismatches}/${CASES.length} matched expectations`);
}

main();
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Write `README.md`**

````markdown
# Model Council

Three models answer your question and review each other's answers. A decision model (Jev, with Perplexity's decider as fallback, both via OpenRouter) checks whether the answers actually differ. The synthesizer only runs when they do, which saves tokens on questions every model answers the same way.

## Setup

1. Node 20.6 or newer.
2. `npm install`
3. `cp .env.example .env.local`, then add your OpenRouter key.
4. `npm run smoke` checks that every configured model and the decisions endpoint respond.
5. `npm run dev`, then open http://localhost:3000.

## Settings

Click `~/settings` in the title bar. Defaults are in `settings.default.json`; your changes are saved to `settings.json`, which is not committed.

| key | default |
|---|---|
| answer_1–3 | `openai/gpt-6.1-sol`, `anthropic/claude-opus-5.5`, `google/gemini-3.8-flash` |
| synthesizer | `anthropic/claude-sonnet-5.5` |
| decider_1, decider_2 | `typesafe/jev-1.13`, `perplexity/pplx-decider-v1-27b` |
| threshold | `0.6`. The synthesizer runs if any of the four decision probabilities is at or above this. |

## Tuning the threshold

`npm run calibrate` runs six fixed questions (three that should skip, three that should synthesize) and prints the four probabilities for each. Raise the threshold if the synthesizer runs on questions where the models clearly agree; lower it if it skips questions where they don't.

## Tests

- `npm test`: unit tests. No network, no cost.
- `npm run e2e`: Playwright against a fake pipeline (`COUNCIL_FAKE=1`). No network, no cost.
- `npm run smoke` and `npm run calibrate`: live, and billed to your OpenRouter account.

## Fake mode

`COUNCIL_FAKE=1 npm run dev` runs the UI with no API calls. Start a question with `[synth]`, `[skip]`, `[error]`, `[fail]`, `[nodecider]`, `[slow]` or `[synthfail]` to pick a scenario.
````

- [ ] **Step 4: Run calibration (needs the user's key)**

If `.env.local` isn't set up, ask the user to run `npm run calibrate` and paste the output.

Run: `npm run calibrate`
Expected: six result lines and a `N/6 matched expectations` summary. **Report the table to the user.** Do not change the threshold yourself. The threshold is the user's choice.

- [ ] **Step 5: Final verification**

Run: `npm test && npx tsc --noEmit && npx playwright test && npx next build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/calibrate.ts README.md
git commit -m "docs: README and live threshold calibration script"
```
