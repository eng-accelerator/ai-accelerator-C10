import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Save } from 'lucide-react';
import { fetchRule, fetchRules, saveRule } from '../api/client';
import type { RuleSummary } from '../types';

export default function RulesEditor() {
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules().then((data: RuleSummary[]) => {
      setRules(data);
      setLoading(false);
      if (data.length && !selected) select(data[0].name);
    });
  }, []);

  const select = async (name: string) => {
    setSelected(name);
    const data = await fetchRule(name);
    setContent(data.content ?? '');
  };

  const handleSave = async () => {
    if (!selected) return;
    await saveRule(selected, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">Rules</span>
        <span className="text-[10px] font-mono text-orion-text-muted">AGENTS.md · .cursor/rules</span>
      </div>

      {loading ? (
        <p className="text-xs text-orion-text-muted">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-orion-text-muted">No rules found. Add AGENTS.md or a .mdc file under .cursor/rules.</p>
      ) : (
        <ul className="space-y-1">
          {rules.map((rule) => {
            const active = rule.name === selected;
            return (
              <li key={rule.name}>
                <button
                  onClick={() => select(rule.name)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple ${
                    active
                      ? 'bg-orion-accent-soft border-orion-border text-orion-text-primary'
                      : 'bg-transparent border-transparent text-orion-text-secondary hover:bg-orion-bg-tertiary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono truncate">{rule.source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-muted shrink-0">
                      {rule.always_apply ? 'always' : rule.globs.join(', ') || 'manual'}
                    </span>
                  </div>
                  {rule.description && <p className="text-[11px] text-orion-text-muted mt-0.5 truncate">{rule.description}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={content}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        aria-label={`Contents of ${selected ?? 'rule'}`}
        disabled={!selected}
        className="flex-1 w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orion-accent-purple disabled:opacity-50"
      />

      <button
        onClick={handleSave}
        disabled={!selected}
        className={`w-full flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary disabled:opacity-40 ${
          saved ? 'bg-orion-bg-tertiary text-orion-accent-teal border border-orion-border' : 'bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover'
        }`}
      >
        {saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? 'Saved' : 'Save rule'}
      </button>

      <p className="text-[11px] text-orion-text-muted leading-relaxed">
        AGENTS.md is always on. A .mdc rule applies to files that match its globs. The agent loads the same files Cursor does.
      </p>
    </div>
  );
}
