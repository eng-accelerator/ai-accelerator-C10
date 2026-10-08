import type { RunState } from "@/lib/runState";
import { formatCost, shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";
import { Prompt } from "./Prompt";

export function SynthesisSection({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  if (state.skipped) {
    return (
      <p className="comment" data-testid="skip-note">
        # [x] models agreed · synthesizer skipped
      </p>
    );
  }
  if (!state.decision?.synthesize) return null;

  const { synthesis } = state;
  const status =
    synthesis.status === "done"
      ? `✓ done · ${formatCost(synthesis.cost)}`
      : synthesis.status === "error"
        ? "✗ error"
        : "● streaming…";

  return (
    <section>
      <Prompt cmd={`synthesize --model ${shortModel(synthesis.model)}`} />
      <div className="panel" data-testid="synthesis">
        <div className="panel-title">
          <span className="glow-soft">combined answer</span>
          <span className="status-line">{status}</span>
        </div>
        <div className="panel-body">
          {synthesis.status === "error" ? (
            <>
              <p className="err">✗ error: {synthesis.error}</p>
              <button className="btn-ghost" data-testid="synthesis-retry" onClick={onRetry}>
                $ synthesize --retry
              </button>
            </>
          ) : (
            <Markdown text={synthesis.text} />
          )}
        </div>
      </div>
    </section>
  );
}
