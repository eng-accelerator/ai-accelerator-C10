import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import useStore from '../store/useStore';
import { fetchHistory } from '../api/client';

const statusColors: Record<string, string> = {
  planned: 'bg-orion-accent-amber',
  coded: 'bg-orion-accent-blue',
  approved: 'bg-green-400',
  rejected: 'bg-orion-accent-red',
  applied: 'bg-orion-accent-teal',
  tested: 'bg-purple-400',
  error: 'bg-orion-accent-red',
};

interface Step {
  step: number;
  status: string;
  next_nodes?: string[];
  timestamp?: string;
  state?: Record<string, unknown>;
}

export default function TimeTravel() {
  const { threadId } = useStore();
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!threadId) return;
    setLoading(true);
    const data = await fetchHistory(threadId);
    setSteps(data.steps || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [threadId]);

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">
          Time Travel
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Timeline */}
      {steps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-orion-text-muted text-center px-4">
            No checkpoints yet. Run the agent to see time travel history.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const isExpanded = expandedStep === step.step;
            const dotColor = statusColors[step.status] || 'bg-orion-text-muted';

            return (
              <div key={step.step} className="flex gap-3">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      isLast
                        ? `${dotColor} border-orion-accent-blue`
                        : `${dotColor} border-transparent`
                    }`}
                  />
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-orion-border min-h-[24px]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-orion-text-muted" />
                    ) : (
                      <ChevronRight size={12} className="text-orion-text-muted" />
                    )}
                    <span className="text-xs font-mono text-orion-text-secondary">
                      Step {step.step}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        statusColors[step.status]
                          ? `${statusColors[step.status]} text-black`
                          : 'bg-orion-bg-input text-orion-text-secondary'
                      }`}
                    >
                      {step.status}
                    </span>
                  </button>

                  {step.next_nodes && step.next_nodes.length > 0 && (
                    <div className="flex gap-1 mt-1 ml-5">
                      {step.next_nodes.map((node, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-muted"
                        >
                          {node}
                        </span>
                      ))}
                    </div>
                  )}

                  {step.timestamp && (
                    <p className="text-[10px] text-orion-text-muted mt-1 ml-5">{step.timestamp}</p>
                  )}

                  {isExpanded && step.state && (
                    <pre className="mt-2 ml-5 p-2 bg-orion-bg-input border border-orion-border rounded text-[11px] font-mono text-orion-text-secondary overflow-x-auto max-h-48">
                      {JSON.stringify(step.state, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
