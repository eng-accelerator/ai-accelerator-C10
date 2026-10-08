import type { AnswerView } from "@/lib/runState";
import { formatCost, shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";

const STATUS: Record<AnswerView["status"], (a: AnswerView) => string> = {
  pending: () => "○ waiting",
  streaming: () => "● streaming…",
  done: (a) => `✓ done · ${formatCost(a.cost)}`,
  error: () => "✗ error",
};

export function AnswerPanel({ answer }: { answer: AnswerView }) {
  return (
    <div className="panel" data-testid={`answer-${answer.label}`} data-status={answer.status}>
      <div className="panel-title">
        <span className="glow-soft">
          {answer.label.toLowerCase()}/ {shortModel(answer.model)}
        </span>
        <span className="status-line">
          {STATUS[answer.status](answer)}
          {answer.truncated && <span className="tag">[truncated]</span>}
        </span>
      </div>
      <div className="panel-body">
        {answer.status === "error" ? <p className="err">✗ error: {answer.error}</p> : <Markdown text={answer.text} />}
      </div>
    </div>
  );
}
