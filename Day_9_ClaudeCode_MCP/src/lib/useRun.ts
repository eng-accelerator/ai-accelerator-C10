"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent } from "./events";
import { readNdjson } from "./ndjson";
import { initialRunState, reduceRun, retryingSynthesis, startRun, stopRun, type RunState } from "./runState";

const finishIfRunning = (s: RunState): RunState => (s.phase === "running" ? { ...s, phase: "done" } : s);

async function errorFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `HTTP ${res.status}`;
}

export function useRun() {
  const [state, setState] = useState<RunState>(initialRunState);
  const stateRef = useRef(state);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const apply = useCallback((e: RunEvent) => setState((s) => reduceRun(s, e)), []);

  const stream = useCallback(
    async (url: string, body: unknown, onHttpError: (message: string) => void) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: c.signal,
        });
        if (!res.ok || !res.body) {
          onHttpError(await errorFrom(res));
          return;
        }
        await readNdjson<RunEvent>(res.body, apply);
      } catch (err) {
        if (!c.signal.aborted) onHttpError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!c.signal.aborted) setState(finishIfRunning);
      }
    },
    [apply],
  );

  const ask = useCallback(
    async (question: string) => {
      setState(startRun(question));
      await stream("/api/run", { question }, (reason) => apply({ type: "run_failed", reason }));
    },
    [apply, stream],
  );

  const retrySynthesis = useCallback(async () => {
    const s = stateRef.current;
    if (!s.decision) return;
    const answers = Object.fromEntries(s.answers.filter((a) => a.status === "done").map((a) => [a.label, a.text]));
    const reviews = Object.fromEntries(s.reviews.filter((r) => r.status === "done").map((r) => [r.reviewer, r.text]));
    setState(retryingSynthesis);
    await stream(
      "/api/synthesize",
      { question: s.question, answers, reviews, fired: s.decision.fired },
      (message) => apply({ type: "synthesis_error", model: s.synthesis.model, message }),
    );
  }, [apply, stream]);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setState(stopRun);
  }, []);

  return { state, ask, stop, retrySynthesis };
}
