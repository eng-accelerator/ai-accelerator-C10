import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight } from "lucide-react";
import { chapters } from "@/lib/registry";

const lessonGroups = [
  {
    lesson: "Lesson 1" as const,
    title: "Hands: tools and the agent loop",
    description: "Set up your LLM, define tools, build the agent graph, and generate code with streaming and multi-turn conversations.",
    chapters: chapters.filter((ch) => ch.lesson === "Lesson 1"),
  },
  {
    lesson: "Lesson 2" as const,
    title: "Self-awareness: run, review, retry",
    description: "Add structured output, self-correction loops, reflection, dynamic rules, and inline editing capabilities.",
    chapters: chapters.filter((ch) => ch.lesson === "Lesson 2"),
  },
  {
    lesson: "Lesson 3" as const,
    title: "Brain: plan, gate, parallelise",
    description: "Build a multi-agent system with codebase RAG, human-in-the-loop gates, parallel generation, and time-travel debugging.",
    chapters: chapters.filter((ch) => ch.lesson === "Lesson 3"),
  },
];

export default function CurriculumPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <span className="font-code text-primary-light text-label-caps uppercase tracking-widest">
          Curriculum
        </span>
        <h1 className="font-headline text-headline-lg text-ink mt-2">
          18 Chapters to Production
        </h1>
        <p className="font-body text-body-lg text-gray2 mt-3">
          Each chapter introduces one idea and lets you compare a baseline against the enhanced agent in an interactive demo.
        </p>
      </div>

      <div className="space-y-12">
        {lessonGroups.map((group) => (
          <Fragment key={group.lesson}>
            <section>
              <div className="mb-5">
                <span className="font-code text-primary-light text-label-caps uppercase tracking-widest">
                  {group.lesson}
                </span>
                <h2 className="font-headline text-headline-md text-ink mt-2">
                  {group.title}
                </h2>
                <p className="font-body text-sm text-gray2 mt-2">
                  {group.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.chapters.map((ch) => (
                  <Link
                    key={ch.slug}
                    href={`/curriculum/${ch.slug}`}
                    className="group bg-surface border border-hairline rounded-lg p-6 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-code text-primary-light text-xs font-bold">
                        {String(ch.number).padStart(2, "0")}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray3 group-hover:text-primary-light transition-colors" />
                    </div>
                    <h3 className="font-headline text-headline-sm text-ink mb-2">
                      {ch.title}
                    </h3>
                    <p className="font-body text-sm text-gray2 line-clamp-3">
                      {ch.subtitle}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
            {group.lesson === "Lesson 2" && (
              <section className="bg-surface border border-hairline rounded-lg p-6">
                <span className="font-code text-primary-light text-label-caps uppercase tracking-widest">Between the lessons</span>
                <h2 className="font-headline text-headline-sm text-ink mt-2">Rules, skills, and MCP</h2>
                <p className="font-body text-sm text-gray2 mt-2 max-w-3xl">
                  Three files shape the agent without touching its code. Rules in .cursor/rules apply by path. Skills in .cursor/skills load on demand. An MCP server in .cursor/mcp.json adds tools the agent did not ship with. Cursor reads the same three.
                </p>
                <div className="flex gap-3 mt-4">
                  <Link href="/curriculum/dynamic-rules" className="font-code text-sm text-primary-light hover:text-ink">Rules & skills →</Link>
                  <Link href="/curriculum/orchestrator-state" className="font-code text-sm text-primary-light hover:text-ink">Toolkit & MCP →</Link>
                </div>
              </section>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
