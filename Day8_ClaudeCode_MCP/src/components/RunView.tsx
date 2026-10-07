import type { RunState } from "@/lib/runState";
import { AnswerPanel } from "./AnswerPanel";
import { DecisionPanel } from "./DecisionPanel";
import { Prompt } from "./Prompt";
import { ReviewsSection } from "./ReviewsSection";
import { RunFooter } from "./RunFooter";
import { SynthesisSection } from "./SynthesisSection";

export function RunView({ state, onRetrySynthesis }: { state: RunState; onRetrySynthesis: () => void }) {
  return (
    <>
      <hr className="rule" />
      <Prompt cmd={`council answer --models ${state.answers.length || 3}`} />
      <div className="answers">
        {state.answers.map((a) => (
          <AnswerPanel key={a.label} answer={a} />
        ))}
      </div>
      {state.reviews.length > 0 && <ReviewsSection reviews={state.reviews} />}
      {state.decision && <DecisionPanel decision={state.decision} />}
      <SynthesisSection state={state} onRetry={onRetrySynthesis} />
      {state.failedReason && (
        <p className="notice" data-testid="run-failed">
          ✗ {state.failedReason}
        </p>
      )}
      {state.stopped && (
        <p className="comment" data-testid="run-stopped">
          # ^C: run stopped
        </p>
      )}
      <RunFooter state={state} />
    </>
  );
}
