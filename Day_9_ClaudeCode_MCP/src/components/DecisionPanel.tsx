import type { DecisionEvent, QuestionKey } from "@/lib/events";
import { QUESTION_KEYS } from "@/lib/prompts";
import { shortModel } from "@/lib/format";
import { Prompt } from "./Prompt";

const ROW_LABEL: Record<QuestionKey, string> = {
  disagreement: "disagreement",
  unique_fact: "unique_fact",
  unique_caveat: "unique_caveat",
  unique_recommendation: "unique_recommend",
};

export function DecisionPanel({ decision }: { decision: DecisionEvent }) {
  const { deciderUsed, attempts, probabilities, fired, threshold } = decision;
  const via = deciderUsed ? shortModel(deciderUsed) : "none";
  const unavailable = attempts.filter((a) => a.error).map((a) => shortModel(a.model));

  return (
    <section data-testid="decision">
      <Prompt cmd={`decide --via ${via} --threshold ${threshold.toFixed(2)}`} />
      <div className="panel decision">
        {deciderUsed && unavailable.length > 0 && (
          <p className="comment" data-testid="decider-fallback">
            # via {via} ({unavailable.join(", ")} unavailable)
          </p>
        )}
        {!deciderUsed && (
          <p className="notice" data-testid="no-decider">
            no decider available · synthesizing by default
          </p>
        )}
        {probabilities &&
          QUESTION_KEYS.map((k) => {
            const p = probabilities[k];
            return (
              <div className="meter-row" key={k} data-testid={`meter-${k}`}>
                <span>{ROW_LABEL[k]}</span>
                <div className="meter" role="meter" aria-label={k} aria-valuemin={0} aria-valuemax={1} aria-valuenow={p}>
                  <div className="meter-fill" style={{ width: `${p * 100}%` }} />
                  <div className="meter-threshold" style={{ left: `${threshold * 100}%` }} />
                </div>
                <span className="glow-soft">{p.toFixed(2)}</span>
                <span className="fired">{fired.includes(k) ? "◆ fired" : ""}</span>
              </div>
            );
          })}
      </div>
    </section>
  );
}
