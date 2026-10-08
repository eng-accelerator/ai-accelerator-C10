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
