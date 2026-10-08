import { DEFAULT_SETTINGS, loadSettings, saveSettings, validateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { settings, warning } = await loadSettings();
  return Response.json({
    settings,
    warning: warning ?? null,
    defaults: DEFAULT_SETTINGS,
    hasKey: process.env.COUNCIL_FAKE === "1" || Boolean(process.env.OPENROUTER_API_KEY),
  });
}

export async function PUT(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const v = validateSettings(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  await saveSettings(v.settings);
  return Response.json({ settings: v.settings });
}
