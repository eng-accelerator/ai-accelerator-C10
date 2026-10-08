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
