"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { GraphEdgeDef, GraphNodeDef, GraphRunStep } from "@/lib/schema";

type Props = {
  nodes?: GraphNodeDef[];
  edges?: GraphEdgeDef[];
  activeNode?: string | null;
  steps?: GraphRunStep[];
};

const DEFAULT_NODES: GraphNodeDef[] = [
  { id: "__start__", label: "__start__" },
  { id: "agent", label: "agent" },
  { id: "tools", label: "tools" },
  { id: "__end__", label: "__end__" },
];

const DEFAULT_EDGES: GraphEdgeDef[] = [
  { from: "__start__", to: "agent" },
  { from: "agent", to: "tools" },
  { from: "tools", to: "agent" },
  { from: "agent", to: "__end__", style: "dashed" },
];

function getNodePosition(nodeId: string, nodes: GraphNodeDef[]): { x: number; y: number } {
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (nodeIds.has("review")) {
    const reflectionLayout: Record<string, { x: number; y: number }> = {
      __start__: { x: 50, y: 10 },
      generate: { x: 36, y: 34 },
      execute: { x: 36, y: 60 },
      review: { x: 66, y: 60 },
      __end__: { x: 50, y: 88 },
    };

    return reflectionLayout[nodeId] ?? { x: 50, y: 50 };
  }

  if (nodeIds.has("generate") && nodeIds.has("execute")) {
    const correctionLayout: Record<string, { x: number; y: number }> = {
      __start__: { x: 50, y: 10 },
      generate: { x: 50, y: 34 },
      execute: { x: 50, y: 60 },
      __end__: { x: 50, y: 88 },
    };

    return correctionLayout[nodeId] ?? { x: 50, y: 50 };
  }

  const agentLayout: Record<string, { x: number; y: number }> = {
    __start__: { x: 50, y: 10 },
    agent: { x: 50, y: 34 },
    tools: { x: 76, y: 60 },
    __end__: { x: 24, y: 60 },
  };

  return agentLayout[nodeId] ?? { x: 50, y: 50 };
}

function getEdgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  if (to.y <= from.y) {
    const curveOffset = Math.max(16, Math.abs(to.x - from.x) + 12);
    return `M ${from.x} ${from.y} C ${from.x + curveOffset} ${from.y - 6}, ${to.x + curveOffset} ${to.y + 6}, ${to.x} ${to.y}`;
  }

  if (Math.abs(from.x - to.x) > 14) {
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }

  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function statusClass(status?: GraphRunStep["status"]) {
  if (status === "success") return "border-green-400/50 text-green-400";
  if (status === "error") return "border-red-400/50 text-red-400";
  if (status === "warning") return "border-yellow-500/50 text-yellow-300";
  return "border-outline-variant/50 text-ink-variant";
}

export function AgentGraphVisualizer({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  activeNode,
  steps = [],
}: Props) {
  const [visible, setVisible] = useState(false);
  const positions = Object.fromEntries(
    nodes.map((node) => [node.id, getNodePosition(node.id, nodes)])
  );
  const activeStep = steps[steps.length - 1];

  return (
    <section className="border-b border-outline-variant bg-surface-container-low">
      <button
        onClick={() => setVisible((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-headline text-[10px] font-bold uppercase tracking-wider text-ink-variant hover:text-ink"
      >
        <span>Agent Graph Visualizer</span>
        {activeStep && (
          <span className="ml-auto mr-3 max-w-[50%] truncate font-body normal-case tracking-normal text-ink-variant">
            {activeStep.title}
          </span>
        )}
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {visible && (
        <div className="mx-3 mb-3 grid h-64 grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] overflow-hidden rounded border border-outline-variant bg-night">
          <div className="relative min-w-0">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <marker id="graph-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
                  <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return null;

                return (
                  <g key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}>
                    <path
                      d={getEdgePath(from, to)}
                      stroke="currentColor"
                      strokeWidth="0.7"
                      className="text-outline-variant"
                      fill="none"
                      markerEnd="url(#graph-arrow)"
                      strokeDasharray={edge.style === "dashed" ? "2 2" : undefined}
                    />
                    {edge.label && (
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 2}
                        textAnchor="middle"
                        className="fill-current font-code text-[4px] text-ink-variant"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>
            {nodes.map((node) => {
              const position = positions[node.id];
              const isActive = activeNode === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-4 py-2 font-code text-[12px] transition-all duration-300 ${
                    isActive
                      ? "border-primary bg-primary/20 text-white shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                      : "border-primary/60 bg-surface-low text-ink"
                  }`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  {node.label}
                </div>
              );
            })}
          </div>
          <div className="border-l border-outline-variant/50 bg-surface-low/50 p-3">
            <div className="mb-2 font-headline text-[10px] font-bold uppercase tracking-wider text-ink-variant">
              Graph Events
            </div>
            <div className="h-[calc(100%-1.5rem)] space-y-2 overflow-y-auto pr-1">
              {steps.length === 0 ? (
                <p className="font-body text-[11px] text-ink-variant/60">
                  Run the agent to see node events here.
                </p>
              ) : (
                steps.map((step, index) => (
                  <div
                    key={`${step.node}-${index}`}
                    className={`rounded border bg-night/70 p-2 ${statusClass(step.status)}`}
                  >
                    <div className="font-headline text-[10px] font-bold uppercase tracking-wider">
                      {step.node} - {step.title}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap font-code text-[10px] leading-4 text-ink">
                      {step.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
