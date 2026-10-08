import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  validateSettings,
} from "../../src/lib/settings";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "council-settings-"));
  file = path.join(dir, "settings.json");
});

describe("validateSettings", () => {
  it("accepts the defaults", () => {
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it("rejects anything other than exactly three answer models", () => {
    const r = validateSettings({ ...DEFAULT_SETTINGS, answerModels: ["a/b", "c/d"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/answerModels/);
  });

  it("rejects blank model IDs", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, synthesizer: "  " }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, answerModels: ["a/b", "", "c/d"] }).ok).toBe(false);
  });

  it("requires at least one decider", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, deciders: [] }).ok).toBe(false);
  });

  it("requires a threshold in [0, 1]", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: -0.1 }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1.1 }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: Number.NaN }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 0 }).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1 }).ok).toBe(true);
  });

  it("trims model IDs", () => {
    const r = validateSettings({ ...DEFAULT_SETTINGS, synthesizer: "  x/y  " });
    expect(r.ok && r.settings.synthesizer).toBe("x/y");
  });
});

describe("loadSettings / saveSettings", () => {
  it("returns defaults with no warning when the file is missing", async () => {
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toBeUndefined();
  });

  it("round-trips saved settings", async () => {
    const custom = { ...DEFAULT_SETTINGS, threshold: 0.75 };
    await saveSettings(custom, file);
    expect((await loadSettings(file)).settings).toEqual(custom);
  });

  it("falls back to defaults with a warning when the file is corrupt JSON", async () => {
    await fs.writeFile(file, "{ not json", "utf8");
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toMatch(/settings\.json/);
  });

  it("falls back to defaults with a warning when the file is invalid", async () => {
    await fs.writeFile(file, JSON.stringify({ ...DEFAULT_SETTINGS, threshold: 2 }), "utf8");
    const r = await loadSettings(file);
    expect(r.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.warning).toMatch(/threshold/);
  });
});
