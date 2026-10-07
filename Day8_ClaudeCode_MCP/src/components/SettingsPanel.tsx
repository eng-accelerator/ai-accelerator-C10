"use client";

import { useEffect, useRef, useState } from "react";
import type { Settings } from "@/lib/events";
import { Prompt } from "./Prompt";

const FIELDS = ["answer_1", "answer_2", "answer_3", "synthesizer", "decider_1", "decider_2", "threshold"] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string>;

function toForm(s: Settings): Form {
  return {
    answer_1: s.answerModels[0],
    answer_2: s.answerModels[1],
    answer_3: s.answerModels[2],
    synthesizer: s.synthesizer,
    decider_1: s.deciders[0] ?? "",
    decider_2: s.deciders[1] ?? "",
    threshold: String(s.threshold),
  };
}

function fromForm(f: Form) {
  return {
    answerModels: [f.answer_1, f.answer_2, f.answer_3],
    synthesizer: f.synthesizer,
    deciders: [f.decider_1, f.decider_2].map((d) => d.trim()).filter(Boolean),
    threshold: f.threshold.trim() === "" ? Number.NaN : Number(f.threshold),
  };
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { settings: Settings; defaults: Settings; warning: string | null }) => {
        setForm(toForm(d.settings));
        setDefaults(d.defaults);
        setWarning(d.warning);
      })
      .catch((e) => setErrors([String(e)]));
  }, []);

  async function save(next: Form) {
    const id = ++requestId.current;
    setSaving(true);
    setErrors([]);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromForm(next)),
      });
      let body: { settings?: Settings; errors?: string[] } = {};
      try {
        body = await res.json();
      } catch {
        if (id !== requestId.current) return;
        setErrors([`HTTP ${res.status}`]);
        return;
      }
      if (id !== requestId.current) return;
      if (!res.ok) {
        setErrors(body.errors ?? [`HTTP ${res.status}`]);
        return;
      }
      if (!body.settings) {
        setErrors([`HTTP ${res.status}`]);
        return;
      }
      setForm(toForm(body.settings));
      setWarning(null);
      setSaved(true);
    } finally {
      if (id === requestId.current) setSaving(false);
    }
  }

  return (
    <section data-testid="settings-panel">
      <Prompt cmd="cat ~/.council/settings.json" />
      <div className="panel">
        <div className="panel-title">
          <span className="glow-soft">council@settings ----------</span>
        </div>
        {warning && (
          <p className="notice" data-testid="settings-warning" style={{ padding: "8px 12px 0" }}>
            ! {warning}
          </p>
        )}
        {form && (
          <div className="kv">
            {FIELDS.map((f) => (
              <div key={f} style={{ display: "contents" }}>
                <label htmlFor={`setting-${f}`}>{f}</label>
                <input
                  id={`setting-${f}`}
                  data-testid={`setting-${f}`}
                  value={form[f]}
                  spellCheck={false}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <p className="notice" data-testid="settings-errors" style={{ padding: "0 12px 8px" }}>
            ✗ {errors.join("; ")}
          </p>
        )}
        {saved && (
          <p className="comment" data-testid="settings-saved" style={{ padding: "0 12px 8px" }}>
            # [x] saved
          </p>
        )}
        <div className="actions">
          <button className="btn" data-testid="settings-save" disabled={!form || saving} onClick={() => form && save(form)}>
            $ save
          </button>
          <button
            className="btn-ghost"
            data-testid="settings-reset"
            disabled={!defaults || saving}
            onClick={() => defaults && save(toForm(defaults))}
          >
            $ reset --defaults
          </button>
          <button className="btn-ghost" data-testid="settings-close" onClick={onClose}>
            :q
          </button>
        </div>
      </div>
    </section>
  );
}
