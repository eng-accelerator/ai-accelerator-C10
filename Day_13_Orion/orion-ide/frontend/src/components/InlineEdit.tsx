import { useState, useEffect, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Sparkles, X } from 'lucide-react';
import { sendChatMessage } from '../api/client';
import useStore from '../store/useStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedCode: string;
  onApply: (newCode: string) => void;
}

export default function InlineEdit({ visible, onClose, selectedCode, onApply }: Props) {
  const { selectedModel } = useStore();
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setInstruction('');
      setResult('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  const handleApply = () => {
    if (!instruction.trim()) return;

    setLoading(true);
    setResult('');

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a code editor. Return ONLY the modified code, no explanations or markdown fences.',
      },
      {
        role: 'user' as const,
        content: `Modify this code:\n\`\`\`\n${selectedCode}\n\`\`\`\n\nInstruction: ${instruction}`,
      },
    ];

    let accumulated = '';
    sendChatMessage(
      messages,
      selectedModel,
      (token) => {
        accumulated += token;
        setResult(accumulated);
      },
      undefined,
      undefined,
      () => {
        setLoading(false);
        onApply(accumulated.trim());
        onClose();
      },
      () => setLoading(false)
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  if (!visible) return null;

  const previewLines = selectedCode.split('\n');
  const truncated = previewLines.length > 10;
  const displayCode = truncated
    ? previewLines.slice(0, 10).join('\n') + '\n...'
    : selectedCode;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-orion-bg-secondary border border-orion-accent-blue rounded-lg shadow-xl p-4 w-96 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orion-accent-blue">
            <Sparkles size={16} />
            <span className="text-sm font-medium">Inline Edit</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Code Preview */}
        {selectedCode && (
          <div className="bg-orion-bg-input border border-orion-border rounded p-2 max-h-40 overflow-y-auto">
            <pre className="text-[11px] font-mono text-orion-text-secondary whitespace-pre-wrap">
              {displayCode}
            </pre>
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          value={instruction}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the changes..."
          disabled={loading}
          className="w-full bg-orion-bg-input border border-orion-border rounded px-3 py-2 text-sm text-white placeholder:text-orion-text-muted focus:outline-none focus:ring-1 focus:ring-orion-accent-blue disabled:opacity-50"
        />

        {/* Streaming result preview */}
        {result && (
          <div className="bg-orion-bg-input border border-orion-border rounded p-2 max-h-32 overflow-y-auto">
            <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap">{result}</pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-orion-bg-input text-orion-text-secondary rounded text-sm hover:bg-orion-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={loading || !instruction.trim()}
            className="px-3 py-1.5 bg-orion-accent-blue text-white rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
