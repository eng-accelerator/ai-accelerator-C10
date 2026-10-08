import { loadSettings } from "@/lib/settings";
import { createOpenRouterClient } from "@/lib/openrouter";
import { createScenarioClient } from "@/lib/fakeScenarios";
import { runSynthesis } from "@/lib/pipeline";
import { QUESTION_KEYS } from "@/lib/prompts";
import { LABELS, type Label, type QuestionKey } from "@/lib/events";
import { isFake, missingKeyResponse, ndjsonStream } from "@/lib/http";

export const runtime = "nodejs";

type ByLabel = Partial<Record<Label, string>>;

function asByLabel(v: unknown): ByLabel | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: ByLabel = {};
  for (const [k, text] of Object.entries(v)) {
    if (!(LABELS as readonly string[]).includes(k) || typeof text !== "string") return null;
    out[k as Label] = text;
  }
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const answers = asByLabel(body?.answers);
  const reviews = asByLabel(body?.reviews);
  const fired = body?.fired;
  const firedOk = Array.isArray(fired) && fired.every((k) => (QUESTION_KEYS as string[]).includes(k as string));
  if (!question || !answers || Object.keys(answers).length < 2 || !reviews || !firedOk) {
    return Response.json({ error: "expected { question, answers (2+), reviews, fired }" }, { status: 400 });
  }
  const missing = missingKeyResponse();
  if (missing) return missing;

  const { settings } = await loadSettings();
  const client = isFake() ? createScenarioClient(question, settings, { isRetry: true }) : createOpenRouterClient();
  return ndjsonStream(req.signal, async (emit) => {
    await runSynthesis({
      question,
      answers,
      reviews,
      fired: fired as QuestionKey[],
      model: settings.synthesizer,
      client,
      emit,
      signal: req.signal,
    });
  });
}
