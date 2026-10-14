---
name: frontend-design
description: Checklist for UI work in this repo. Use whenever creating or editing .tsx or .css files.
paths:
  - "**/*.tsx"
  - "**/*.css"
---
# Frontend design checklist

1. Read `DESIGN.md` before writing a line. It defines the tokens, type scale, spacing, components, and what to avoid.
2. Reuse an existing component before writing a new one.
3. For every interactive element, implement default, hover, focus, disabled, loading, empty, and error states where they apply.
4. Use `--accent` for one thing per screen: the primary action, the active state, or the AI affordance.
5. AI output that needs review shows its controls next to it: accept, apply, edit, retry, view diff.
6. Check the layout at 1200px and at 375px before you finish.
7. Never add a hex value, spacing, radius, or shadow that is not in `DESIGN.md`.
