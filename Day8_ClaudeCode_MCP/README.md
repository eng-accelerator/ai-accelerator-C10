# Model Council

Three models answer your question and review each other's answers. A decision model (Jev, with Perplexity's decider as fallback, both via OpenRouter) checks whether the answers actually differ. The synthesizer only runs when they do, which saves tokens on questions every model answers the same way.

## Setup

1. Node 20.6 or newer.
2. `npm install`
3. `cp .env.example .env.local`, then add your OpenRouter key.
4. `npm run smoke` checks that every configured model and the decisions endpoint respond.
5. `npm run dev`, then open http://localhost:3000.

## Settings

Click `~/settings` in the title bar. Defaults are in `settings.default.json`; your changes are saved to `settings.json`, which is not committed.

| key | default |
|---|---|
| answer_1–3 | `openai/gpt-6.1-sol`, `anthropic/claude-opus-5.5`, `google/gemini-3.8-flash` |
| synthesizer | `anthropic/claude-sonnet-5.5` |
| decider_1, decider_2 | `typesafe/jev-1.13`, `perplexity/pplx-decider-v1-27b` |
| threshold | `0.6`. The synthesizer runs if any of the four decision probabilities is at or above this. |

## Tuning the threshold

`npm run calibrate` runs six fixed questions (three that should skip, three that should synthesize) and prints the four probabilities for each. Raise the threshold if the synthesizer runs on questions where the models clearly agree; lower it if it skips questions where they don't.

## Tests

- `npm test`: unit tests. No network, no cost.
- `npm run e2e`: Playwright against a fake pipeline (`COUNCIL_FAKE=1`). No network, no cost.
- `npm run smoke` and `npm run calibrate`: live, and billed to your OpenRouter account.

## Fake mode

`COUNCIL_FAKE=1 npm run dev` runs the UI with no API calls. Start a question with `[synth]`, `[skip]`, `[error]`, `[fail]`, `[nodecider]`, `[slow]` or `[synthfail]` to pick a scenario.
