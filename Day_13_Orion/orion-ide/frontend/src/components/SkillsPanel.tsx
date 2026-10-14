import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Plus, Save } from 'lucide-react';
import { createSkill, fetchSkill, fetchSkills, saveSkill } from '../api/client';
import type { SkillSummary } from '../types';

export default function SkillsPanel() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data: SkillSummary[] = await fetchSkills();
    setSkills(data);
    return data;
  };

  useEffect(() => {
    load().then((data) => {
      if (data.length) select(data[0].name);
    });
  }, []);

  const select = async (name: string) => {
    setSelected(name);
    const data = await fetchSkill(name);
    setContent(data.content ?? '');
  };

  const handleSave = async () => {
    if (!selected) return;
    await saveSkill(selected, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await createSkill(newName.trim(), newDescription.trim());
      setCreating(false);
      setNewName('');
      setNewDescription('');
      await load();
      await select(newName.trim());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">Skills</span>
        <button
          onClick={() => setCreating((v) => !v)}
          aria-label="New skill"
          className="flex items-center gap-1 text-xs text-orion-text-secondary hover:text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple rounded px-1"
        >
          <Plus size={14} /> New skill
        </button>
      </div>

      {creating && (
        <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-3 space-y-2">
          <label className="block text-[11px] text-orion-text-secondary">
            Name (lowercase, hyphens)
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full h-10 bg-orion-bg-input border border-orion-border rounded-md px-3 text-sm font-mono text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
            />
          </label>
          <label className="block text-[11px] text-orion-text-secondary">
            Description (when to use it)
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-full h-10 bg-orion-bg-input border border-orion-border rounded-md px-3 text-sm text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
            />
          </label>
          {error && <p className="text-[11px] text-orion-accent-red">Error: {error}</p>}
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newDescription.trim()}
            className="w-full h-10 rounded-md text-sm font-medium bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
          >
            Create skill
          </button>
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-xs text-orion-text-muted">No skills yet. Create one, or add a folder with SKILL.md under .cursor/skills.</p>
      ) : (
        <ul className="space-y-1">
          {skills.map((skill) => {
            const active = skill.name === selected;
            return (
              <li key={skill.name}>
                <button
                  onClick={() => select(skill.name)}
                  className={`w-full text-left px-2 py-1.5 rounded-md border text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-orion-accent-purple ${
                    active
                      ? 'bg-orion-accent-soft border-orion-border text-orion-text-primary'
                      : 'bg-transparent border-transparent text-orion-text-secondary hover:bg-orion-bg-tertiary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{skill.name}</span>
                    {!skill.model_invocable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-muted">manual</span>
                    )}
                  </div>
                  <p className="text-[11px] text-orion-text-muted mt-0.5 line-clamp-2">{skill.description}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={content}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        aria-label={`Contents of ${selected ?? 'skill'}`}
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
        {saved ? 'Saved' : 'Save skill'}
      </button>

      <p className="text-[11px] text-orion-text-muted leading-relaxed">
        The agent sees one line per skill. It loads the full body with read_skill when the description matches the task.
      </p>
    </div>
  );
}
