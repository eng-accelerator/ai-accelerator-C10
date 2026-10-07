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
