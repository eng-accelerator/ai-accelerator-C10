"use client";

import { useState } from "react";
import type { ReviewView } from "@/lib/runState";
import { shortModel } from "@/lib/format";
import { Markdown } from "./Markdown";
import { Prompt } from "./Prompt";

export function ReviewsSection({ reviews }: { reviews: ReviewView[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...reviews].sort((a, b) => a.reviewer.localeCompare(b.reviewer));
  return (
    <section>
      <Prompt cmd="council review">
        <button className="navlink" data-testid="reviews-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "[-] collapse" : `[+] expand ${reviews.length} reviews`}
        </button>
      </Prompt>
      {open && (
        <div className="reviews">
          {sorted.map((r) => (
            <div className="panel" key={r.reviewer} data-testid={`review-${r.reviewer}`}>
              <div className="panel-title">
                <span>
                  review by {r.reviewer.toLowerCase()}/ {shortModel(r.model)}
                </span>
              </div>
              <div className="panel-body">
                {r.status === "error" ? <p className="err">✗ error: {r.error}</p> : <Markdown text={r.text} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
