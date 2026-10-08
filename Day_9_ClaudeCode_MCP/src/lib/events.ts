export type Label = "A" | "B" | "C";
export const LABELS: readonly Label[] = ["A", "B", "C"];

export type QuestionKey =
  | "disagreement"
  | "unique_fact"
  | "unique_caveat"
  | "unique_recommendation";

export type Stage = "answers" | "reviews" | "decision" | "synthesis";

export interface Settings {
  answerModels: [string, string, string];
  synthesizer: string;
  deciders: string[];
  threshold: number;
}

export interface DeciderAttempt {
  model: string;
  error?: string;
}

export type RunEvent =
  | { type: "run_started"; runId: string; settings: Settings }
  | { type: "answer_delta"; label: Label; model: string; text: string }
  | { type: "answer_done"; label: Label; model: string; text: string; truncated: boolean; cost: number }
  | { type: "answer_error"; label: Label; model: string; message: string }
  | { type: "review_done"; reviewer: Label; model: string; text: string; cost: number }
  | { type: "review_error"; reviewer: Label; model: string; message: string }
  | {
      type: "decision";
      deciderUsed: string | null;
      attempts: DeciderAttempt[];
      probabilities: Record<QuestionKey, number> | null;
      fired: QuestionKey[];
      threshold: number;
      synthesize: boolean;
      cost: number;
    }
  | { type: "synthesis_delta"; text: string }
  | { type: "synthesis_done"; model: string; text: string; cost: number }
  | { type: "synthesis_error"; model: string; message: string }
  | { type: "skipped" }
  | { type: "run_failed"; reason: string }
  | { type: "run_done"; totalCost: number; costByStage: Record<Stage, number> };

export type DecisionEvent = Extract<RunEvent, { type: "decision" }>;
export type RunDoneEvent = Extract<RunEvent, { type: "run_done" }>;
