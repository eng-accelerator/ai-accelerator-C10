---
name: commit-deploy
description: Run the tests, commit everything with a one-line message, and deploy the site.
disable-model-invocation: true
---
# Commit and deploy

1. `uv run pytest`. Stop if anything fails.
2. `cd web && npm run lint && npm run build`. Stop if anything fails.
3. `git add -A && git commit -m "<one line describing the change>"`.
4. `git push`. Vercel deploys `main` to production and every other branch to a preview URL.
5. Report the commit hash and the deploy URL.
