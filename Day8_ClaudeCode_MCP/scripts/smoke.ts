import { createOpenRouterClient } from "../src/lib/openrouter";
import { loadSettings } from "../src/lib/settings";

const PING = {
  ping: {
    type: "noul" as const,
    instructions: "Does the text contain a greeting?",
    criteria: { true: "The text greets someone", false: "The text contains no greeting" },
  },
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is missing. Copy .env.example to .env.local and add your key.");
    process.exit(1);
  }
  const { settings } = await loadSettings();
  const client = createOpenRouterClient();
  let failures = 0;

  for (const model of settings.deciders) {
    try {
      const r = await client.decide(model, { text: "Hello there, friend." }, PING);
      console.log(`OK   decide ${model}  p(yes)=${r.probabilities.ping.toFixed(2)}  $${r.cost.toFixed(5)}`);
    } catch (e) {
      failures++;
      console.log(`FAIL decide ${model}  ${message(e)}`);
    }
  }

  for (const model of [...settings.answerModels, settings.synthesizer]) {
    try {
      const r = await client.chat(model, [{ role: "user", content: "Reply with the single word: ok" }], {
        maxTokens: 256,
      });
      console.log(`OK   chat   ${model}  "${r.text.trim().slice(0, 24)}"  $${r.cost.toFixed(5)}`);
    } catch (e) {
      failures++;
      console.log(`FAIL chat   ${model}  ${message(e)}`);
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
