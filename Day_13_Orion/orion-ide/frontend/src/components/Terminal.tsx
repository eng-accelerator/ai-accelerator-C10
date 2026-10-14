import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import useStore from '../store/useStore';
import { executeCommand } from '../api/client';

export default function Terminal() {
  const { terminalHistory, addTerminalOutput, clearTerminal } = useStore();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [terminalHistory]);

  const handleSubmit = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim() || running) return;

    const cmd = input.trim();
    setInput('');
    addTerminalOutput(`$ ${cmd}`);
    setRunning(true);

    const result = await executeCommand(cmd);
    if (result.stdout) addTerminalOutput(result.stdout);
    if (result.stderr) addTerminalOutput(result.stderr);
    if (result.returncode !== 0) {
      addTerminalOutput(`Process exited with code ${result.returncode}`);
    }

    setRunning(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e0e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-9 bg-orion-bg-tertiary border-b border-orion-border flex-shrink-0">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">
          Terminal
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={clearTerminal}
            className="p-1 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button className="p-1 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-sm space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {terminalHistory.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all ${
              line.startsWith('$') ? 'text-green-400' : 'text-orion-text-primary'
            }`}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center px-2 py-1 border-t border-orion-border flex-shrink-0">
        <span className="text-green-400 font-mono text-sm mr-1">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={handleSubmit}
          disabled={running}
          className="flex-1 bg-transparent text-green-400 font-mono text-sm focus:outline-none placeholder:text-orion-text-muted disabled:opacity-50"
          placeholder="Enter command..."
        />
      </div>
    </div>
  );
}
