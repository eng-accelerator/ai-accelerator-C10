---
name: web-research
description: How to find a current fact on the web. Use when the task needs information newer than your training data or outside the codebase (API details, library versions, exchange rates, docs).
---
# Web research

1. Call `web_search` with one objective and two or three short queries.
2. Read the excerpts. If they answer the question, stop; do not fetch.
3. Fetch at most two URLs with `web_fetch`, the ones with the most specific excerpt.
4. In your answer, name the source URL next to each fact you took from it.
5. If sources disagree, say so and prefer the official documentation.
