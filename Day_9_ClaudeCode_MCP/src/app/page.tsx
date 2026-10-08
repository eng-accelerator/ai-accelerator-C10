"use client";

import { useEffect, useState } from "react";
import { Hero } from "@/components/Hero";
import { PromptLine } from "@/components/PromptLine";
import { RunView } from "@/components/RunView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TerminalWindow } from "@/components/TerminalWindow";
import { useRun } from "@/lib/useRun";

export default function Home() {
  const { state, ask, stop, retrySynthesis } = useRun();
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const running = state.phase === "running";

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { hasKey: boolean }) => setHasKey(d.hasKey))
      .catch(() => setHasKey(true));
  }, []);

  return (
    <TerminalWindow status={running ? "running" : "idle"} onSettings={() => setShowSettings((v) => !v)}>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {state.phase === "idle" && <Hero />}
      {hasKey === false ? (
        <p className="notice" data-testid="missing-key">
          ✗ OPENROUTER_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart `npm run dev`.
        </p>
      ) : (
        <PromptLine running={running} onAsk={ask} onStop={stop} />
      )}
      {state.phase !== "idle" && <RunView state={state} onRetrySynthesis={retrySynthesis} />}
    </TerminalWindow>
  );
}
