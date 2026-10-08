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
