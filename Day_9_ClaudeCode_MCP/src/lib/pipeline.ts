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
