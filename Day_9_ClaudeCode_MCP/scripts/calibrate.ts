import { createOpenRouterClient } from "../src/lib/openrouter";
import { loadSettings } from "../src/lib/settings";
import { runCouncil } from "../src/lib/pipeline";
import { QUESTION_KEYS } from "../src/lib/prompts";
import type { DecisionEvent, RunEvent } from "../src/lib/events";

const CASES: { expect: "skip" | "synthesize"; question: string }[] = [
  { expect: "skip", question: "What is the boiling point of water at sea level, in Celsius?" },
  { expect: "skip", question: "What is the capital of Japan?" },
  { expect: "skip", question: "How many bytes are in a kibibyte?" },
  { expect: "synthesize", question: "Should a three-person startup build its first product as microservices or a monolith? Recommend one." },
  { expect: "synthesize", question: "What is the best way for an experienced developer to learn a new programming language?" },
  { expect: "synthesize", question: "Is it better to rent or buy a home in a large city? Give your recommendation." },
];

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }
  const { settings } = await loadSettings();
  const client = createOpenRouterClient();
  console.log(`threshold ${settings.threshold}\n`);
  console.log(["expect", "actual", "decider", ...QUESTION_KEYS.map((k) => k.slice(0, 12)), "cost", "question"].join("\t"));

  let mismatches = 0;
  for (const c of CASES) {
    const seen: { decision?: DecisionEvent; cost: number; failed?: string } = { cost: 0 };
    await runCouncil({
      question: c.question,
      settings,
      client,
      emit: (e: RunEvent) => {
        if (e.type === "decision") seen.decision = e;
        if (e.type === "run_done") seen.cost = e.totalCost;
        if (e.type === "run_failed") seen.failed = e.reason;
      },
    });
    const d = seen.decision;
    const actual = seen.failed ? "failed" : d?.synthesize ? "synthesize" : "skip";
    if (actual !== c.expect) mismatches++;
    const probs = QUESTION_KEYS.map((k) => (d?.probabilities ? d.probabilities[k].toFixed(2) : "--"));
    console.log(
      [c.expect, actual, d?.deciderUsed ?? "none", ...probs, `$${seen.cost.toFixed(3)}`, c.question.slice(0, 50)].join("\t"),
    );
  }
  console.log(`\n${CASES.length - mismatches}/${CASES.length} matched expectations`);
}

main();
