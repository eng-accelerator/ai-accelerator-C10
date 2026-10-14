import Link from "next/link";
import { ArrowRight, Play, Terminal } from "lucide-react";
import { SITE_MODE } from "@/lib/siteMode";

export function HeroBand() {
  return (
    <section className="relative overflow-hidden py-24 px-6">
      <div className="absolute inset-0 stage-bg opacity-40" />
      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-hairline mb-8">
          <Terminal className="w-4 h-4 text-primary-light" />
          <span className="font-code text-xs text-gray2 uppercase tracking-widest">
            Interactive Tutorial Series
          </span>
        </div>

        <h1 className="font-headline text-display-lg text-ink">
          Build an AI
          <br />
          <span className="text-primary-light">Coding Agent</span>
        </h1>

        <p className="font-body text-body-lg text-gray2 mt-6 max-w-2xl mx-auto">
          18 chapters across 3 lessons. From your first LLM call to an agent that plans, tests, reviews, and waits for your approval before it writes to disk.
        </p>

        <div className="mt-10 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/curriculum/setting-up-llm"
              className="inline-flex items-center gap-2 px-6 py-3 rounded font-headline text-label-caps uppercase tracking-widest bg-primary text-white hover:bg-primary-dim transition-colors"
            >
              Start Chapter 01
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/curriculum"
              className="inline-flex items-center gap-2 px-6 py-3 rounded font-code text-sm text-gray2 border border-hairline hover:text-ink hover:bg-surface transition-colors"
            >
              View Curriculum
            </Link>
          </div>
          {SITE_MODE !== "reader" && (
<Link
            href="/playground"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-lg font-headline text-label-caps uppercase tracking-widest bg-ink text-night border border-primary-light shadow-[0_0_32px_rgba(139,92,246,0.28)] hover:bg-primary-light hover:text-white transition-colors"
          >
            <Play className="w-4 h-4" />
            Try the Editor
            <ArrowRight className="w-4 h-4" />
          </Link>
)}
        </div>
      </div>
    </section>
  );
}
