import { loadSettings } from "@/lib/settings";
import { createOpenRouterClient } from "@/lib/openrouter";
import { createScenarioClient } from "@/lib/fakeScenarios";
import { isFake, missingKeyResponse, ndjsonStream } from "@/lib/http";
import { runCouncil } from "@/lib/pipeline";
import { MAX_QUESTION_CHARS } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ error: "question is required" }, { status: 400 });
  if (question.length > MAX_QUESTION_CHARS) {
    return Response.json(
      { error: `question is ${question.length.toLocaleString("en-US")} characters; the limit is 20,000` },
      { status: 400 },
    );
  }
  const missing = missingKeyResponse();
  if (missing) return missing;

  const { settings } = await loadSettings();
  const client = isFake() ? createScenarioClient(question, settings) : createOpenRouterClient();
  return ndjsonStream(req.signal, (emit) => runCouncil({ question, settings, client, emit, signal: req.signal }));
}
