import { LABELS, type DecisionEvent, type Label, type RunDoneEvent, type RunEvent, type Settings } from "./events";

export interface AnswerView {
  label: Label;
  model: string;
  status: "pending" | "streaming" | "done" | "error";
  text: string;
  truncated: boolean;
  cost: number;
  error?: string;
}

export interface ReviewView {
  reviewer: Label;
  model: string;
  status: "done" | "error";
  text: string;
  error?: string;
}

export interface SynthesisView {
  status: "idle" | "streaming" | "done" | "error";
  model: string;
  text: string;
  cost: number;
  error?: string;
}

export interface RunState {
  phase: "idle" | "running" | "done";
  question: string;
  settings: Settings | null;
  answers: AnswerView[];
  reviews: ReviewView[];
  decision: DecisionEvent | null;
  synthesis: SynthesisView;
  skipped: boolean;
  failedReason: string | null;
  stopped: boolean;
  totals: RunDoneEvent | null;
}

const emptySynthesis: SynthesisView = { status: "idle", model: "", text: "", cost: 0 };

export const initialRunState: RunState = {
  phase: "idle",
  question: "",
  settings: null,
  answers: [],
  reviews: [],
  decision: null,
  synthesis: emptySynthesis,
  skipped: false,
  failedReason: null,
  stopped: false,
  totals: null,
};

export function startRun(question: string): RunState {
  return { ...initialRunState, phase: "running", question };
}

export function retryingSynthesis(s: RunState): RunState {
  return { ...s, phase: "running", synthesis: { ...s.synthesis, status: "streaming", text: "", error: undefined } };
}

export function stopRun(s: RunState): RunState {
  return s.phase === "running" ? { ...s, phase: "done", stopped: true } : s;
}

function updateAnswer(s: RunState, label: Label, patch: (a: AnswerView) => AnswerView): RunState {
  return { ...s, answers: s.answers.map((a) => (a.label === label ? patch(a) : a)) };
}

export function reduceRun(s: RunState, e: RunEvent): RunState {
  switch (e.type) {
    case "run_started":
      return {
        ...s,
        settings: e.settings,
        answers: e.settings.answerModels.map((model, i) => ({
          label: LABELS[i],
          model,
          status: "pending",
          text: "",
          truncated: false,
          cost: 0,
        })),
        synthesis: { ...emptySynthesis, model: e.settings.synthesizer },
      };
    case "answer_delta":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "streaming", text: a.text + e.text }));
    case "answer_done":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "done", text: e.text, truncated: e.truncated, cost: e.cost }));
    case "answer_error":
      return updateAnswer(s, e.label, (a) => ({ ...a, status: "error", error: e.message }));
    case "review_done":
      return { ...s, reviews: [...s.reviews, { reviewer: e.reviewer, model: e.model, status: "done", text: e.text }] };
    case "review_error":
      return {
        ...s,
        reviews: [...s.reviews, { reviewer: e.reviewer, model: e.model, status: "error", text: "", error: e.message }],
      };
    case "decision":
      return { ...s, decision: e };
    case "synthesis_delta":
      return { ...s, synthesis: { ...s.synthesis, status: "streaming", text: s.synthesis.text + e.text } };
    case "synthesis_done": {
      // During a normal run totals is still null (run_done comes later and carries the cost).
      // After a retry, totals exists and the new cost is added to it.
      const totals = s.totals
        ? {
            ...s.totals,
            totalCost: s.totals.totalCost + e.cost,
            costByStage: { ...s.totals.costByStage, synthesis: s.totals.costByStage.synthesis + e.cost },
          }
        : null;
      return { ...s, totals, synthesis: { status: "done", model: e.model, text: e.text, cost: e.cost } };
    }
    case "synthesis_error":
      return { ...s, synthesis: { ...s.synthesis, status: "error", model: e.model, error: e.message } };
    case "skipped":
      return { ...s, skipped: true };
    case "run_failed":
      return { ...s, failedReason: e.reason };
    case "run_done":
      return { ...s, phase: "done", totals: e };
  }
}
