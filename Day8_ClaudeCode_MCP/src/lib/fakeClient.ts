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
