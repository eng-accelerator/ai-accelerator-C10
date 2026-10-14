"use client";

import { useEffect, useRef } from "react";
import type { LogLine as LogLineType } from "@/lib/schema";
import { LogLine } from "./LogLine";

export type StageState = "idle" | "running" | "done";

export function ExecutionStage({
  state,
  logs,
  output,
  accent = "#8B5CF6",
  emptyText = "[IDLE] Awaiting input. Press RUN DEMO to initialize.",
}: {
  state: StageState;
  logs: LogLineType[];
  output: string;
  accent?: string;
  emptyText?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: state === "running" ? "auto" : "smooth",
    });
  }, [logs.length, output, state]);

  return (
    <div
      ref={ref}
      className="relative stage-bg bg-night/60 rounded border border-hairline p-5 min-h-[420px] max-h-[640px] overflow-auto"
    >
      <div className="absolute top-3 right-4 flex items-center gap-2 z-10">
        <span
          className={`w-2 h-2 rounded-full ${state === "running" ? "animate-pulse" : ""}`}
          style={{
            backgroundColor:
              state === "running" ? accent : state === "done" ? "#4ADE80" : "#71717A",
          }}
        />
        <span
          className="font-code text-[10px] tracking-widest uppercase"
          style={{
            color:
              state === "running" ? accent : state === "done" ? "#4ADE80" : "#71717A",
          }}
        >
          {state === "running" ? "EXECUTING" : state === "done" ? "COMPLETE" : "IDLE"}
        </span>
      </div>

      <div className="font-headline text-[10px] tracking-widest uppercase font-bold text-gray3 mb-4">
        OUTPUT_LOG:
      </div>

      {state === "idle" && logs.length === 0 && !output ? (
        <p className="font-code text-sm text-gray3">{emptyText}</p>
      ) : null}

      {logs.length > 0 ? (
        <div className="space-y-1.5 mb-4">
          {logs.map((line, i) => (
            <LogLine key={i} line={line} index={i} />
          ))}
        </div>
      ) : null}

      {output ? (
        <pre className="font-code text-sm text-ink whitespace-pre-wrap leading-relaxed border-t border-hairline pt-4 mt-2">
          {output}
          {state === "running" ? <span className="terminal-cursor" /> : null}
        </pre>
      ) : state === "running" ? (
        <div className="space-y-2 mt-2">
          <div className="h-3 w-3/4 bg-surface rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-surface rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-surface rounded animate-pulse" />
        </div>
      ) : null}
    </div>
  );
}
