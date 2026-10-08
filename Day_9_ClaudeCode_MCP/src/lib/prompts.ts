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
