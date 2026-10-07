import type { RunState } from "@/lib/runState";
import { formatCost } from "@/lib/format";

export function RunFooter({ state }: { state: RunState }) {
  const t = state.totals;
  const label = state.phase === "running" ? "running…" : state.stopped ? "stopped" : "run complete";
  return (
    <div className="run-footer" data-testid="run-footer">
      <span>
        $ echo &quot;{label}&quot;
        <span className="cursor" aria-hidden />
      </span>
      {t && (
        <span>
          cost {formatCost(t.totalCost)} · ans {formatCost(t.costByStage.answers)} · rev {formatCost(t.costByStage.reviews)} ·
          decide {formatCost(t.costByStage.decision, 4)} · synth {formatCost(t.costByStage.synthesis)}
        </span>
      )}
    </div>
  );
}
