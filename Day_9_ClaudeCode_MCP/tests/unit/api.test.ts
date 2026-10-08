import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST as runPOST } from "../../src/app/api/run/route";
import { POST as synthPOST } from "../../src/app/api/synthesize/route";
import { GET as settingsGET, PUT as settingsPUT } from "../../src/app/api/settings/route";
import { readNdjson } from "../../src/lib/ndjson";
import { MAX_QUESTION_CHARS } from "../../src/lib/prompts";
import type { RunEvent } from "../../src/lib/events";

const json = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function events(res: Response): Promise<RunEvent[]> {
  const out: RunEvent[] = [];
  await readNdjson<RunEvent>(res.body!, (e) => out.push(e));
  return out;
}

const saved = { ...process.env };
beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "council-api-"));
  process.env.COUNCIL_SETTINGS_PATH = path.join(dir, "settings.json");
  process.env.COUNCIL_FAKE = "1";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("POST /api/run", () => {
  it("streams a full fake run ending in run_done", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "[skip] hello" }));
    expect(res.headers.get("Content-Type")).toMatch(/ndjson/);
    const types = (await events(res)).map((e) => e.type);
    expect(types[0]).toBe("run_started");
    expect(types).toContain("skipped");
    expect(types.at(-1)).toBe("run_done");
  });

  it("rejects an empty or whitespace question", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/question/);
  });

  it("rejects a question over the size limit", async () => {
    const res = await runPOST(json("/api/run", "POST", { question: "x".repeat(MAX_QUESTION_CHARS + 1) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/20,000/);
  });

  it("reports a missing API key", async () => {
    delete process.env.COUNCIL_FAKE;
    delete process.env.OPENROUTER_API_KEY;
    const res = await runPOST(json("/api/run", "POST", { question: "hi" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/OPENROUTER_API_KEY/);
  });
});

describe("POST /api/synthesize", () => {
  it("streams only the synthesis step", async () => {
    const res = await synthPOST(
      json("/api/synthesize", "POST", { question: "[synthfail] q", answers: { A: "a", B: "b" }, reviews: {}, fired: ["unique_fact"] }),
    );
    const types = (await events(res)).map((e) => e.type).filter((t) => t !== "synthesis_delta");
    expect(types).toEqual(["synthesis_done"]);
  });

  it("rejects a malformed body", async () => {
    const res = await synthPOST(json("/api/synthesize", "POST", { question: "q", answers: "nope", reviews: {}, fired: [] }));
    expect(res.status).toBe(400);
  });
});

describe("/api/settings", () => {
  it("GET returns defaults, no warning, and hasKey in fake mode", async () => {
    const body = await (await settingsGET()).json();
    expect(body.settings).toEqual(body.defaults);
    expect(body.warning).toBeNull();
    expect(body.hasKey).toBe(true);
  });

  it("GET reports hasKey false without a key outside fake mode", async () => {
    delete process.env.COUNCIL_FAKE;
    delete process.env.OPENROUTER_API_KEY;
    expect((await (await settingsGET()).json()).hasKey).toBe(false);
  });

  it("PUT saves valid settings and rejects invalid ones", async () => {
    const { defaults } = await (await settingsGET()).json();
    const ok = await settingsPUT(json("/api/settings", "PUT", { ...defaults, threshold: 0.8 }));
    expect(ok.status).toBe(200);
    expect((await (await settingsGET()).json()).settings.threshold).toBe(0.8);

    const bad = await settingsPUT(json("/api/settings", "PUT", { ...defaults, threshold: 3 }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors.join()).toMatch(/threshold/);
  });
});
