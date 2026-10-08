import { Prompt } from "./Prompt";

export function Hero() {
  return (
    <section data-testid="hero">
      <Prompt cmd="whoami --full" />
      <h1 className="hero-banner">
        model-council<span className="cursor" aria-hidden />
      </h1>
      <p className="hero-role">&gt; three models answer, review each other, and synthesize only when it adds something</p>
      <p className="hero-meta">[x] answer ×3 &nbsp; [x] review ×3 &nbsp; [x] decide &nbsp; [x] synthesize if needed</p>
    </section>
  );
}
