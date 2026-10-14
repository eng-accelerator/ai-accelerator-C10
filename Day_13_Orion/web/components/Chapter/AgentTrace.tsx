"use client";

import type { TraceStep } from "@/lib/schema";
import { User, Bot, Wrench } from "lucide-react";

const STEP_CONFIG: Record<
  TraceStep["type"],
  { icon: typeof User; label: string; color: string; bg: string }
> = {
  human: { icon: User, label: "HUMAN", color: "#4ADE80", bg: "rgba(74,222,128,0.08)" },
  ai: { icon: Bot, label: "AGENT", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)" },
  tool: { icon: Wrench, label: "TOOL", color: "#FB923C", bg: "rgba(251,146,60,0.08)" },
};

export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const cfg = STEP_CONFIG[step.type];
        const Icon = cfg.icon;
        return (
          <div
            key={i}
            className="flex items-start gap-3 px-3 py-2.5 rounded border border-hairline"
            style={{ backgroundColor: cfg.bg }}
          >
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
              <span
                className="font-code text-[9px] tracking-widest uppercase font-bold"
                style={{ color: cfg.color }}
              >
                {cfg.label}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {step.toolName && (
                <span className="font-code text-[11px] text-secondary mr-2">
                  {step.toolName}({step.toolArgs?.join(", ") ?? ""})
                </span>
              )}
              <p className="font-code text-[11px] text-ink/80 whitespace-pre-wrap break-words">
                {step.content.length > 200
                  ? step.content.slice(0, 200) + "..."
                  : step.content}
              </p>
            </div>
            <span className="font-code text-[9px] text-gray3 shrink-0">
              {String(i).padStart(2, "0")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
