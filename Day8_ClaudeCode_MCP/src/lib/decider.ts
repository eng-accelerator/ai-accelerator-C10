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
