"use client";

import { Bot, Paperclip, Image, Play } from "lucide-react";
import type { AIExchange } from "@/lib/schema";

export function AIAssistantPanel({
  exchange,
  onExecute,
}: {
  exchange?: AIExchange;
  onExecute?: () => void;
}) {
  return (
    <aside className="w-80 bg-surface-container-low border-l border-outline-variant flex flex-col shrink-0">
      <div className="p-3 flex items-center gap-2 border-b border-outline-variant/20">
        <Bot className="w-5 h-5 text-ink" />
        <span className="font-headline text-[18px] font-semibold tracking-tight text-ink">
          AI ASSISTANT
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {exchange && (
          <>
            <div className="flex flex-col gap-1 items-end">
              <div className="bg-surface-high p-2 px-3 rounded border border-outline-variant/30 max-w-[90%]">
                <p className="font-body text-[12px] text-ink">{exchange.userMessage}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                  <Bot className="w-3 h-3 text-night" />
                </div>
                <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink">
                  {exchange.aiLabel}
                </span>
              </div>
              <div className="bg-surface-low p-3 rounded border border-outline-variant space-y-4">
                <p className="font-body text-[12px] text-ink-variant">
                  {exchange.aiDescription}
                </p>
                {exchange.aiCodeSnippet && (
                  <div className="p-2 bg-surface rounded font-code text-[11px] leading-tight border border-outline-variant/30 text-ink">
                    {exchange.aiCodeSnippet.split("\n").map((line, i) => (
                      <div key={i}>{line || " "}</div>
                    ))}
                    <span className="animate-pulse inline-block w-1.5 h-3 bg-primary" />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-hover border border-outline-variant rounded p-3">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[20px] font-bold text-ink leading-none">98.2%</div>
                  <div className="text-[9px] text-ink-variant font-bold uppercase mt-1">Reliability</div>
                </div>
                <div className="text-right">
                  <div className="text-[20px] font-bold text-ink leading-none">1.2s</div>
                  <div className="text-[9px] text-ink-variant font-bold uppercase mt-1">Latency</div>
                </div>
              </div>
            </div>
          </>
        )}

        {!exchange && (
          <div className="flex items-center justify-center h-full text-ink-variant text-[12px]">
            No active session
          </div>
        )}
      </div>

      <div className="p-3 border-t border-outline-variant bg-surface-container-low">
        <div className="bg-surface-low rounded border border-outline-variant focus-within:border-ink transition-all overflow-hidden">
          <textarea
            className="w-full bg-transparent border-none focus:outline-none text-[12px] p-2 resize-none h-20 text-ink placeholder-ink-variant/30 font-body"
            placeholder="Type instructions..."
            rows={2}
            readOnly
          />
          <div className="flex items-center justify-between p-2 bg-surface-low">
            <div className="flex gap-1">
              <button className="text-ink-variant hover:text-ink">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="text-ink-variant hover:text-ink">
                <Image className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onExecute}
              className="bg-ink text-night h-7 px-3 rounded text-[10px] font-bold uppercase hover:bg-white transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              EXECUTE
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
