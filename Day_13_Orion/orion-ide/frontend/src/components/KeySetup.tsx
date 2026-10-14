import { useEffect, useState, type ChangeEvent } from 'react'
import { KeyRound, CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react'
import useStore from '../store/useStore'
import { checkKey } from '../api/client'
import type { KeyCheck } from '../types'

/**
 * Bring your own key. Shown on first load when neither the browser nor the
 * backend has an OpenRouter key, and again from the key button in the activity bar.
 * The key is sent to the local backend with each request and, if "remember" is
 * on, kept in this browser's localStorage. It is never written to disk by the server.
 */
export default function KeySetup() {
  const {
    apiKey, setApiKey, rememberKey, serverHasKey, keySetupOpen, setKeySetupOpen,
    setKeyLabel, selectedModel, setSelectedModel, availableModels,
  } = useStore()
  const [draft, setDraft] = useState(apiKey)
  const [remember, setRemember] = useState(rememberKey || !apiKey)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<KeyCheck | null>(null)

  useEffect(() => {
    if (keySetupOpen) {
      setDraft(apiKey)
      setResult(null)
    }
  }, [keySetupOpen, apiKey])

  if (!keySetupOpen) return null

  const canClose = Boolean(apiKey) || serverHasKey

  const handleCheck = async () => {
    setChecking(true)
    setResult(null)
    try {
      const info: KeyCheck = await checkKey(draft.trim())
      setResult(info)
      if (info.ok) setKeyLabel(info.label || 'your key')
    } catch (err) {
      setResult({ ok: false, message: `Could not reach the backend: ${String(err)}`, label: '', usage: null, limit: null })
    } finally {
      setChecking(false)
    }
  }

  const handleSave = () => {
    setApiKey(draft.trim(), remember)
    setKeySetupOpen(false)
  }

  const handleUseServerKey = () => {
    setApiKey('', false)
    setKeySetupOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-orion-bg-secondary rounded-xl border border-orion-border w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-orion-border">
          <div className="flex items-center gap-2 text-orion-text-primary">
            <KeyRound size={18} className="text-orion-accent-purple" />
            <h2 className="text-base font-semibold">Your OpenRouter key</h2>
          </div>
          {canClose && (
            <button onClick={() => setKeySetupOpen(false)} className="p-1 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-orion-text-secondary leading-relaxed">
            Orion calls models through OpenRouter, so one key works for GPT, Claude, and Gemini.
            Create a key at{' '}
            <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer" className="text-orion-accent-blue hover:underline inline-flex items-center gap-1">
              openrouter.ai/settings/keys <ExternalLink size={12} />
            </a>
            , add a few dollars of credit, and paste it here. A full lesson run costs cents.
          </p>

          <label className="block space-y-1">
            <span className="text-xs text-orion-text-secondary">API key</span>
            <div className="flex gap-2">
              <input
                type="password"
                autoFocus
                value={draft}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setDraft(e.target.value); setResult(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheck() }}
                placeholder="sk-or-v1-..."
                className="flex-1 bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm font-mono text-orion-text-primary placeholder:text-orion-text-muted focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
              />
              <button
                onClick={handleCheck}
                disabled={checking || !draft.trim()}
                className="h-9 px-3 rounded-md text-sm font-medium border border-orion-border text-orion-text-primary hover:bg-orion-bg-tertiary disabled:opacity-40 flex items-center gap-2"
              >
                {checking ? <Loader2 size={14} className="animate-spin" /> : null}
                Check
              </button>
            </div>
          </label>

          {result && (
            <div className={`flex items-start gap-2 text-sm rounded-md border px-3 py-2 ${result.ok ? 'border-orion-accent-teal/40 text-orion-accent-teal' : 'border-orion-accent-red/40 text-orion-accent-red'}`}>
              {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
              <div>
                <p>{result.message}{result.ok && result.label ? ` Label: ${result.label}.` : ''}</p>
                {result.ok && result.usage !== null && (
                  <p className="text-xs text-orion-text-secondary mt-0.5">
                    Spent so far: ${result.usage.toFixed(2)}{result.limit ? ` of a $${result.limit.toFixed(2)} limit` : ''}.
                  </p>
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-orion-text-secondary cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#8B5CF6]" />
            Remember this key in this browser
          </label>

          {availableModels.length > 0 && (
            <label className="block space-y-1">
              <span className="text-xs text-orion-text-secondary">Model for chat and agent runs</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                ))}
              </select>
            </label>
          )}

          {serverHasKey && (
            <p className="text-xs text-orion-text-muted">
              The backend already found a key in the repo's <span className="font-mono">.env</span>. You can{' '}
              <button onClick={handleUseServerKey} className="text-orion-accent-blue hover:underline">use that one</button>{' '}
              instead of pasting your own.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-orion-border flex items-center justify-between">
          <p className="text-[11px] text-orion-text-muted">Stored in this browser only. Never sent anywhere but OpenRouter.</p>
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="h-9 px-4 rounded-md text-sm font-semibold bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
          >
            Use this key
          </button>
        </div>
      </div>
    </div>
  )
}
