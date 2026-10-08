import type { RunEvent } from "./events";
import { errorMessage } from "./signals";

export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Content-Type-Options": "nosniff",
};

export const isFake = () => process.env.COUNCIL_FAKE === "1";

export function missingKeyResponse(): Response | null {
  if (isFake() || process.env.OPENROUTER_API_KEY) return null;
  return Response.json(
    { error: "OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example) and restart the server." },
    { status: 500 },
  );
}

/** Streams events produced by `work` as NDJSON; closes when work settles. */
export function ndjsonStream(signal: AbortSignal, work: (emit: (e: RunEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // client went away; the abort signal stops the work
        }
      };
      try {
        await work(emit);
      } catch (err) {
        if (!signal.aborted) emit({ type: "run_failed", reason: errorMessage(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}
