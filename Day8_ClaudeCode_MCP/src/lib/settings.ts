import { promises as fs } from "node:fs";
import path from "node:path";
import defaults from "../../settings.default.json";
import type { Settings } from "./events";

export const DEFAULT_SETTINGS = defaults as Settings;

/** Overridable so tests and e2e runs never touch the user's real settings.json. */
export function settingsPath(): string {
  return process.env.COUNCIL_SETTINGS_PATH ?? path.join(process.cwd(), "settings.json");
}

type Validation = { ok: true; settings: Settings } | { ok: false; errors: string[] };

const isModelId = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateSettings(input: unknown): Validation {
  const s = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const answers = s.answerModels;
  if (!Array.isArray(answers) || answers.length !== 3 || !answers.every(isModelId)) {
    errors.push("answerModels must be exactly three non-empty model IDs");
  }
  if (!isModelId(s.synthesizer)) errors.push("synthesizer must be a non-empty model ID");
  const deciders = s.deciders;
  if (!Array.isArray(deciders) || deciders.length === 0 || !deciders.every(isModelId)) {
    errors.push("deciders must list at least one non-empty model ID");
  }
  const t = s.threshold;
  if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > 1) {
    errors.push("threshold must be a number between 0 and 1");
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    settings: {
      answerModels: (answers as string[]).map((m) => m.trim()) as Settings["answerModels"],
      synthesizer: (s.synthesizer as string).trim(),
      deciders: (deciders as string[]).map((m) => m.trim()),
      threshold: t as number,
    },
  };
}

export async function loadSettings(
  file: string = settingsPath(),
): Promise<{ settings: Settings; warning?: string }> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { settings: DEFAULT_SETTINGS };
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { settings: DEFAULT_SETTINGS, warning: "settings.json is not valid JSON; using defaults" };
  }
  const v = validateSettings(parsed);
  if (!v.ok) {
    return {
      settings: DEFAULT_SETTINGS,
      warning: `settings.json is invalid (${v.errors.join("; ")}); using defaults`,
    };
  }
  return { settings: v.settings };
}

export async function saveSettings(settings: Settings, file: string = settingsPath()): Promise<void> {
  await fs.writeFile(file, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
