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
