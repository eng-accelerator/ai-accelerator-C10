"use client";

import { RotateCcw, Search, Terminal, Settings } from "lucide-react";

export function IDEHeader({
  onReset,
  onResetAll,
}: {
  onReset?: () => void;
  onResetAll?: () => void;
}) {
  return (
    <header className="bg-surface-container-low flex justify-between items-center w-full px-4 h-12 border-b border-outline-variant z-50 shrink-0">
      <div />
      <div className="flex items-center gap-4">
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded border border-outline-variant bg-surface-high px-2.5 py-1 font-headline text-[10px] font-bold uppercase tracking-wider text-ink-variant transition-colors hover:text-ink"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        {onResetAll && (
          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 rounded border border-outline-variant bg-surface-high px-2.5 py-1 font-headline text-[10px] font-bold uppercase tracking-wider text-ink-variant transition-colors hover:text-ink"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </button>
        )}
        <div className="bg-surface-high flex items-center px-2 py-1 rounded border border-outline-variant w-64">
          <Search className="w-4 h-4 text-ink-variant mr-2" />
          <input
            className="bg-transparent border-none focus:outline-none text-[12px] w-full text-ink placeholder-ink-variant/40 font-body"
            placeholder="Search files..."
            type="text"
            readOnly
          />
        </div>
        <div className="flex items-center gap-1">
          <button className="text-ink-variant hover:text-ink p-1 transition-colors">
            <Terminal className="w-[18px] h-[18px]" />
          </button>
          <button className="text-ink-variant hover:text-ink p-1 transition-colors">
            <Settings className="w-[18px] h-[18px]" />
          </button>
          <div className="h-7 w-7 rounded bg-surface-high border border-outline-variant overflow-hidden ml-1" />
        </div>
      </div>
    </header>
  );
}
