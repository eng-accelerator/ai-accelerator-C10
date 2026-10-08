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
