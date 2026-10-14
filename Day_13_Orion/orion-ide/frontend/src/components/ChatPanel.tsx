import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { Settings, Trash2, SendHorizontal, KeyRound } from 'lucide-react';
import useStore from '../store/useStore';
import { sendChatMessage } from '../api/client';
import ChatMessageComponent from './ChatMessage';

export default function ChatPanel() {
  const {
    apiKey, setApiKey, serverHasKey, setKeySetupOpen, selectedModel, setSelectedModel, availableModels,
    chatMessages, addChatMessage, appendToLastMessage, clearChat,
    chatLoading, setChatLoading,
  } = useStore();
  const hasKey = Boolean(apiKey) || serverHasKey;

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || chatLoading) return;
    if (!hasKey) {
      setKeySetupOpen(true);
      return;
    }

    const userMessage = { role: 'user' as const, content: trimmed };
    addChatMessage(userMessage);
    setInput('');

    addChatMessage({ role: 'assistant', content: '', isStreaming: true });
    setChatLoading(true);

    const allMessages = [...chatMessages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    sendChatMessage(
      allMessages,
      selectedModel,
      (token) => appendToLastMessage(token),
      (name) => appendToLastMessage(`\n\n**Tool:** ${name}\n`),
      (_name, result) => appendToLastMessage(`\n${result}\n`),
      () => setChatLoading(false),
      (err) => {
        appendToLastMessage(`\n\n*Error: ${err}*`);
        setChatLoading(false);
      }
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApiKeySave = () => {
    setApiKey(tempApiKey);
    setSettingsOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-orion-bg-secondary">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-orion-border bg-orion-bg-tertiary flex-shrink-0">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">
          Orion Chat
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1.5 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={clearChat}
            className="p-1.5 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Settings Dropdown */}
      {settingsOpen && (
        <div className="bg-orion-bg-tertiary border-b border-orion-border p-3 space-y-3 flex-shrink-0">
          <div className="space-y-1">
            <label className="text-xs text-orion-text-secondary">OpenRouter API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTempApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="flex-1 bg-orion-bg-input border border-orion-border rounded px-2 py-1.5 text-sm text-white placeholder:text-orion-text-muted focus:outline-none focus:ring-1 focus:ring-orion-accent-blue"
              />
              <button
                onClick={handleApiKeySave}
                className="px-3 py-1.5 bg-orion-accent-blue text-white text-sm rounded hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-orion-text-secondary">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-orion-bg-input border border-orion-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orion-accent-blue"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasKey && (
          <button
            onClick={() => setKeySetupOpen(true)}
            className="w-full text-left bg-orion-bg-tertiary border border-orion-accent-purple/60 rounded-lg p-4 space-y-2 hover:border-orion-accent-purple"
          >
            <div className="flex items-center gap-2 text-orion-accent-purple-hover">
              <KeyRound size={18} />
              <span className="text-sm font-medium">Add your OpenRouter key</span>
            </div>
            <p className="text-sm text-orion-text-secondary">
              One key for every model. It stays in this browser and is only sent to your local backend.
            </p>
          </button>
        )}
        {hasKey && chatMessages.length === 0 && (
          <p className="text-xs text-orion-text-muted px-1">
            Ask about the files in workspace/. Orion has read, write, list, grep, glob, run_python, and run_command tools.
          </p>
        )}

        {chatMessages.map((msg, i) => (
          <ChatMessageComponent key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-orion-border p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Orion anything... (Shift+Enter for newline)"
            rows={1}
            disabled={chatLoading}
            className="flex-1 bg-orion-bg-input border border-orion-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-orion-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-orion-accent-blue disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className={`p-2 rounded-lg transition-colors ${
              input.trim() && !chatLoading
                ? 'bg-orion-accent-blue text-white hover:opacity-90'
                : 'bg-orion-bg-input text-orion-text-muted'
            }`}
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
