import { describe, it, expect } from "vitest";
import { createOpenRouterClient, EmptyResponseError, type SdkLike } from "../../src/lib/openrouter";

function fakeSdk(chunks: unknown[], decision?: unknown) {
  const calls: { req: any; opts: any }[] = [];
  const sdk = {
    chat: {
      send: async (req: unknown, opts: unknown) => {
        calls.push({ req, opts });
        return (async function* () {
          for (const c of chunks) yield c;
        })();
      },
    },
    alpha: {
      decisions: {
        create: async (req: unknown, opts: unknown) => {
          calls.push({ req, opts });
          return decision;
        },
      },
    },
  } as unknown as SdkLike;
  return { sdk, calls };
}

const Q = {
  a: { type: "noul" as const, instructions: "a?", criteria: { true: "yes", false: "no" } },
  b: { type: "noul" as const, instructions: "b?", criteria: { true: "yes", false: "no" } },
};

describe("chat", () => {
  it("concatenates deltas, reports each delta, and takes cost from the final chunk", async () => {
    const { sdk } = fakeSdk([
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" }, finishReason: "stop" }] },
      { choices: [], usage: { cost: 0.0123 } },
    ]);
    const deltas: string[] = [];
    const r = await createOpenRouterClient(sdk).chat("m/x", [{ role: "user", content: "hi" }], {
      maxTokens: 100,
      onDelta: (t) => deltas.push(t),
    });
    expect(r).toEqual({ text: "Hello", truncated: false, cost: 0.0123 });
    expect(deltas).toEqual(["Hel", "lo"]);
  });

  it("marks the answer truncated when the model stops on the length limit", async () => {
    const { sdk } = fakeSdk([{ choices: [{ delta: { content: "abc" }, finishReason: "length" }] }]);
    const r = await createOpenRouterClient(sdk).chat("m/x", [], { maxTokens: 3 });
    expect(r.truncated).toBe(true);
  });

  it("sends model, messages, maxTokens and stream:true, and passes the abort signal", async () => {
    const { sdk, calls } = fakeSdk([{ choices: [{ delta: { content: "ok" } }] }]);
    const ctrl = new AbortController();
    const messages = [{ role: "user" as const, content: "hi" }];
    await createOpenRouterClient(sdk).chat("m/x", messages, { maxTokens: 42, signal: ctrl.signal });
    expect(calls[0].req).toEqual({ chatRequest: { model: "m/x", messages, maxTokens: 42, stream: true } });
    expect(calls[0].opts.fetchOptions.signal).toBe(ctrl.signal);
  });

  it("throws EmptyResponseError when the model returns no text", async () => {
    const { sdk } = fakeSdk([{ choices: [{ delta: { content: "  " }, finishReason: "stop" }] }]);
    await expect(createOpenRouterClient(sdk).chat("m/x", [], { maxTokens: 10 })).rejects.toBeInstanceOf(
      EmptyResponseError,
    );
  });
});

describe("decide", () => {
  it("maps noul answers to probabilities and returns cost", async () => {
    const { sdk, calls } = fakeSdk([], {
      model: "typesafe/jev-1.13",
      answers: { a: { type: "noul", noul: 0.2 }, b: { type: "noul", noul: 0.9 } },
      usage: { cost: 0.0004 },
    });
    const r = await createOpenRouterClient(sdk).decide("typesafe/jev-1.13", { x: 1 }, Q);
    expect(r).toEqual({ model: "typesafe/jev-1.13", probabilities: { a: 0.2, b: 0.9 }, cost: 0.0004 });
    expect(calls[0].req).toEqual({ decisionsRequest: { model: "typesafe/jev-1.13", state: { x: 1 }, questions: Q } });
  });

  it("throws when an answer is missing", async () => {
    const { sdk } = fakeSdk([], { model: "d", answers: { a: { type: "noul", noul: 0.2 } }, usage: {} });
    await expect(createOpenRouterClient(sdk).decide("d", {}, Q)).rejects.toThrow(/"b"/);
  });

  it("throws when an answer is not a noul", async () => {
    const { sdk } = fakeSdk([], {
      model: "d",
      answers: { a: { type: "noul", noul: 0.2 }, b: { type: "choice", choice: "x" } },
      usage: {},
    });
    await expect(createOpenRouterClient(sdk).decide("d", {}, Q)).rejects.toThrow(/"b"/);
  });
});
