"use client";

import { useState } from "react";
import { MAX_QUESTION_CHARS } from "@/lib/prompts";

export function PromptLine({
  running,
  onAsk,
  onStop,
}: {
  running: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_QUESTION_CHARS;
  const canAsk = trimmed.length > 0 && !tooLong && !running;
  const submit = () => {
    if (canAsk) onAsk(trimmed);
  };

  return (
    <div>
      <div className="ask prompt">
        <span>
          <span className="host">council~/ask</span> <span className="dollar">$</span> <span className="cmd">ask &quot;</span>
        </span>
        <textarea
          aria-label="question"
          data-testid="question"
          rows={Math.min(8, text.split("\n").length)}
          value={text}
          disabled={running}
          placeholder="type a question…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <button className="btn-ghost" data-testid="stop" onClick={onStop}>
            ^C stop
          </button>
        ) : (
          <button className="btn" data-testid="ask" disabled={!canAsk} onClick={submit}>
            ask
          </button>
        )}
      </div>
      {tooLong && (
        <p className="notice" data-testid="question-too-long">
          question is {trimmed.length.toLocaleString("en-US")} characters; the limit is 20,000
        </p>
      )}
    </div>
  );
}
