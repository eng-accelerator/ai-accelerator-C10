import { TerminalWindow } from "@/components/Terminal/Window";

const PREVIEW_LINES = [
  "$ python orion.py --mode agent",
  "",
  "Initializing AI Coding Agent...",
  "",
  "  Lesson 1: Code Generator with Tools",
  "    tools: [@tool, bind_tools, ToolNode]",
  "    state: MessagesState",
  "",
  "  Lesson 2: Self-Correcting Agent",
  "    pattern: Generate → Execute → Retry",
  "    reflection: Reviewer node",
  "",
  "  Lesson 3: Production Agent",
  "    agents: [Planner, Coder, Reviewer]",
  "    features: [RAG, interrupt, Send API]",
  "",
  "  Pipeline: plan → code → review → approve",
  "  Checkpoint: MemorySaver (time-travel enabled)",
  "",
  "Ready. Run agent.invoke() to start.",
];

export function TerminalPreview() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <TerminalWindow title="agent_preview" rightLabel="what you'll build">
          <pre className="text-code-md text-gray2 whitespace-pre leading-relaxed">
            {PREVIEW_LINES.map((line, i) => (
              <span key={i} className="block">
                {line.startsWith("$") ? (
                  <>
                    <span className="text-primary-light">$</span>
                    <span className="text-ink">{line.slice(1)}</span>
                  </>
                ) : line.startsWith("  Lesson") || line.startsWith("  Pipeline") || line.startsWith("  Checkpoint") ? (
                  <span className="text-primary-light">{line}</span>
                ) : line.includes("tools:") || line.includes("state:") || line.includes("pattern:") || line.includes("reflection:") || line.includes("agents:") || line.includes("features:") ? (
                  <span className="text-gray3">{line}</span>
                ) : line.startsWith("Ready") ? (
                  <span className="text-volt">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </pre>
        </TerminalWindow>
      </div>
    </section>
  );
}
