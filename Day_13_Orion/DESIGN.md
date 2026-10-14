---
name: "Dark AI Developer Tool"
description: "A Cursor-inspired design system for an AI-native developer product: dark, precise, code-centric, quietly premium."
theme: "dark"
colors:
  canvas: "#0B0B0D"
  surface: "#121214"
  surfaceRaised: "#19191D"
  surfaceHover: "#222228"
  border: "#2B2B32"
  borderSubtle: "#1F1F24"
  textPrimary: "#F4F4F5"
  textSecondary: "#A1A1AA"
  textMuted: "#71717A"
  accent: "#8B5CF6"
  accentHover: "#A78BFA"
  accentSoft: "#211B38"
  blue: "#60A5FA"
  green: "#4ADE80"
  yellow: "#FACC15"
  orange: "#FB923C"
  red: "#FB7185"
typography:
  display:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 650
  body:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, Geist Mono, SFMono-Regular, Consolas, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
---

# Design system: Dark AI developer tool

## Overview

Create a polished, dark, AI-native developer-tool interface.

The visual language should feel:

- Technical, focused, and trustworthy
- Dark-first, with high contrast and limited visual noise
- Premium through restraint rather than excessive visual effects
- Optimized for people who spend long periods reading code, data, prompts, logs, and documentation
- Modern and AI-forward, but never gimmicky
- Dense enough for professional work, while retaining generous whitespace in marketing sections

Use gradient accents sparingly. The core interface should remain grounded in neutral dark surfaces, legible typography, and clear hierarchy.

## Visual principles

1. Prefer utility over decoration.
2. Make the primary user task immediately obvious.
3. Use light, depth, and color deliberately—not everywhere.
4. Treat purple as a signal for AI, active states, and primary actions.
5. Use monospace typography only for code, metrics, shortcuts, commands, model names, and technical metadata.
6. Keep interaction states visible and predictable.
7. Design for both marketing pages and product interfaces without making product screens look like landing pages.

## Color system

### Base surfaces

| Token | Value | Intended use |
|---|---|---|
| `--canvas` | `#0B0B0D` | Page background and outer application shell |
| `--surface` | `#121214` | Panels, cards, navigation, code containers |
| `--surface-raised` | `#19191D` | Elevated cards, popovers, menus, active panels |
| `--surface-hover` | `#222228` | Hovered rows, list items, secondary controls |
| `--border` | `#2B2B32` | Default borders and input outlines |
| `--border-subtle` | `#1F1F24` | Low-emphasis dividers |

### Text

| Token | Value | Intended use |
|---|---|---|
| `--text-primary` | `#F4F4F5` | Headings, key values, primary content |
| `--text-secondary` | `#A1A1AA` | Body copy, labels, secondary details |
| `--text-muted` | `#71717A` | Metadata, placeholders, low-priority helper text |

### Accent and status

| Token | Value | Intended use |
|---|---|---|
| `--accent` | `#8B5CF6` | Primary CTA, active state, AI actions, focus ring |
| `--accent-hover` | `#A78BFA` | Hovered primary controls |
| `--accent-soft` | `#211B38` | Selected backgrounds and subtle AI highlighting |
| `--blue` | `#60A5FA` | Informational state and links |
| `--green` | `#4ADE80` | Success, completed, connected, healthy |
| `--yellow` | `#FACC15` | Warning, beta, attention needed |
| `--orange` | `#FB923C` | Caution, queued, in progress |
| `--red` | `#FB7185` | Errors and destructive actions |

### Color rules

- Use `--accent` only for the main action, selected state, AI-related affordance, focus treatment, or one important visual anchor.
- Use no more than one dominant accent color per screen.
- Do not use pure white backgrounds in the product UI.
- Do not use bright gradients for common cards, forms, data tables, or settings pages.
- Never convey success, warning, or error through color alone; pair it with an icon, text label, or both.
- Avoid arbitrary hex values. Use the defined tokens.

## Typography

### Font stack

```css
:root {
  --font-sans: Inter, Geist, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --font-mono: "JetBrains Mono", "Geist Mono", SFMono-Regular, Consolas,
    "Liberation Mono", monospace;
}
```

### Type scale

| Role | Size | Weight | Line height | Usage |
|---|---:|---:|---:|---|
| Hero display | 56px | 650 | 1.05 | Main marketing headline |
| Page title | 36px | 650 | 1.15 | Product-page or major-section title |
| Section title | 24px | 600 | 1.25 | Feature and dashboard section headings |
| Card title | 16px | 600 | 1.35 | Cards, dialogs, compact panels |
| Body | 15px | 400 | 1.55 | Standard interface and marketing copy |
| Small body | 14px | 400 | 1.5 | Supporting copy and labels |
| Caption | 12px | 450 | 1.4 | Metadata, timestamps, helper text |
| Code | 13px | 400 | 1.55 | Code snippets, commands, logs |

### Typography rules

- Use sentence case for navigation, buttons, labels, tabs, and headings.
- Use short, direct labels: “Create project,” “Run agent,” “View changes,” “Connect GitHub.”
- Avoid all caps except for small technical categories or intentionally compact status labels.
- Use monospaced text for code, shell commands, file paths, keyboard shortcuts, tokens, and technical identifiers.
- Do not use more than three font sizes in one compact UI component.
- Keep body text readable. Do not use muted text for information a user must act upon.

## Layout and spacing

### Grid

- Use a 12-column grid on desktop.
- Use a maximum marketing-content width of 1200px.
- Use a maximum reading width of 720px for long-form documentation or explanatory copy.
- Use a two-column layout for feature sections when one side is a visual code/product demonstration.
- Collapse non-essential columns below 768px.
- Prioritize task completion over preserving a desktop layout on mobile.

### Spacing scale

| Token | Value |
|---|---:|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-20` | 80px |

### Layout rules

- Use 16px gaps for related controls.
- Use 24px internal padding for standard cards.
- Use 32px to 48px between major product sections.
- Use 64px to 96px vertical spacing between landing-page sections.
- Keep navigation compact, structured, and visibly separated from the content area.
- Prefer a stable left sidebar for persistent app navigation when the product has multiple workspaces or tools.

## Surface and elevation

### Radius

| Token | Value | Usage |
|---|---:|---|
| `--radius-sm` | 6px | Inputs, small controls, code blocks |
| `--radius-md` | 8px | Buttons, cards, menus, tabs |
| `--radius-lg` | 12px | Dialogs, larger feature panels |
| `--radius-xl` | 16px | Hero panels and large product previews |

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.24);
--shadow-md: 0 12px 32px rgba(0, 0, 0, 0.32);
--shadow-glow: 0 0 28px rgba(139, 92, 246, 0.18);
```

### Elevation rules

- Prefer a subtle border before adding a shadow.
- Use shadows for overlays, dialogs, floating command palettes, and prominent hero previews.
- Use `--shadow-glow` only for an AI action, active agent state, or an important promotional visual.
- Do not use glassmorphism, strong blur, or large diffuse shadows in ordinary product UI.

## Components

### Buttons

Primary button:

- Background: `--accent`
- Text: `--text-primary`
- Height: 40px by default
- Padding: 10px 16px
- Radius: `--radius-md`
- Hover: background shifts to `--accent-hover`
- Focus: visible 2px purple ring with offset
- Disabled: reduced opacity and no hover effect

Secondary button:

- Background: transparent or `--surface-raised`
- Border: 1px solid `--border`
- Text: `--text-primary`
- Hover: `--surface-hover`

Ghost button:

- Background: transparent
- Text: `--text-secondary`
- Hover: `--surface-hover`
- Use for low-priority utility actions

Destructive button:

- Background: transparent by default
- Text: `--red`
- Use a filled red treatment only in confirmation dialogs for irreversible actions

### Inputs and search

- Height: 40px for standard fields.
- Use `--surface` or `--surface-raised` as the background.
- Use a 1px `--border` outline.
- Use `--radius-sm`.
- Add a label above the field for forms.
- Use a visible purple focus ring.
- Put keyboard shortcuts such as `⌘ K` in muted, monospaced keycaps.
- Use search icons only when the field is clearly a search input.

### Cards

- Background: `--surface`.
- Border: 1px solid `--border-subtle`.
- Radius: `--radius-lg`.
- Standard padding: 24px.
- Use modest elevation only when a card sits against an identical surface.
- Keep card content focused around one topic, metric, workflow, or action.
- Avoid stacking too many bordered cards inside other bordered cards.

### Navigation

- Use a compact top bar or a persistent left sidebar.
- Active navigation items use `--accent-soft` background and `--text-primary` text.
- Inactive items use `--text-secondary`; hover adds `--surface-hover`.
- Navigation icons should be simple, outline-based, and secondary to labels.
- Do not use colorful icons unless color communicates product state.

### Tabs

- Keep tabs compact and text-first.
- Use a subtle underline or an active surface treatment.
- Use `--accent` only for the active indicator.
- Do not use large pill tabs for dense product interfaces.

### Tables and lists

- Use tables for repositories, tasks, usage, model runs, billing, logs, and structured records.
- Default row height: 44px to 52px.
- Use a subtle divider between rows.
- Right-align numeric metrics and dates where scanning benefits.
- Provide a quiet hover state for clickable rows.
- Use monospace for IDs, branch names, commit hashes, commands, and token counts.

### Code blocks and terminal surfaces

- Background: `#0E0E11`.
- Border: 1px solid `--border-subtle`.
- Radius: `--radius-md`.
- Font: `--font-mono`.
- Keep syntax highlighting restrained; reserve bright colors for syntax, not panel chrome.
- Include copy controls only when users plausibly need to copy the content.
- Use file tabs, line numbers, diffs, and status indicators only when they add real developer workflow value.

### AI panels

- Clearly label AI features with concise, action-oriented language.
- Use `--accent-soft` as a subtle background cue for AI output or agent activity.
- Show execution state clearly: thinking, running, needs input, completed, failed.
- Show actions close to the generated result: accept, apply, edit, retry, copy, view diff.
- Never make AI output look final when it requires user review.
- For code changes, offer a diff or clear summary of what will change.

### Modals and command palettes

- Background: `--surface-raised`.
- Border: 1px solid `--border`.
- Radius: `--radius-lg`.
- Desktop max width: 560px for standard dialogs.
- Use 640px to 760px for command palettes, search, and AI prompt dialogs.
- Dim the page using a near-black overlay.
- Place destructive actions away from the default primary action.

## Marketing pages

### Hero

- Use a restrained dark canvas with a strong, concise headline.
- Use one primary CTA and one secondary CTA.
- Pair the copy with a product UI preview, code editor, terminal, agent output, or structured workflow visualization.
- Use a subtle purple-to-indigo light field only behind the hero visual, never across the full page.
- Keep the product visual more important than decorative illustration.

### Feature sections

- Alternate between text-left/product-right and product-left/text-right.
- Use real-looking product states rather than generic floating rectangles.
- Explain benefits with concrete tasks: write code, understand a codebase, review changes, run an agent, resolve errors.
- Use concise proof points, workflow steps, or technical examples.

### Social proof

- Keep logos monochrome or muted.
- Use testimonials sparingly.
- Prefer factual evidence, product metrics, customer outcomes, or recognizable workflow examples over generic praise.

## Responsive behavior

- Below 1024px, simplify side-by-side layouts before shrinking typography too far.
- Below 768px, stack major columns and collapse secondary navigation.
- Keep primary buttons at least 40px high and easy to tap.
- Make tables horizontally scrollable when converting them to cards would remove essential comparison context.
- On mobile, prioritize the current task, the primary action, and essential metadata.
- Avoid hover-only interactions; all essential controls must work with touch and keyboard input.

## Accessibility

- Maintain sufficient contrast between text and dark surfaces.
- Every interactive element must have a visible keyboard focus state.
- Do not communicate status through color alone.
- Use semantic HTML before adding ARIA attributes.
- Provide labels for all form controls.
- Use meaningful button text. Avoid labels such as “Submit,” “Click here,” or icon-only controls without accessible names.
- Respect reduced-motion preferences.
- Do not auto-play distracting animations.

## Avoid

- Avoid light backgrounds inside the core product interface.
- Avoid bright, multi-color gradients as generic decoration.
- Avoid excessive glass, blur, glow, or neon effects.
- Avoid oversized rounded pills for ordinary controls.
- Avoid large blocks of muted text.
- Avoid generic SaaS illustrations that do not show the product.
- Avoid arbitrary spacing, font sizes, colors, shadows, or radius values.
- Avoid multiple competing primary CTAs in the same visual area.
- Avoid hiding important actions in unlabeled icon menus.

## Agent instructions

Before writing or modifying UI:

1. Read this `DESIGN.md`.
2. Reuse existing components, tokens, and patterns from the codebase before creating new ones.
3. Do not add arbitrary visual values; use the defined token system.
4. For every interactive component, include default, hover, focus, disabled, loading, empty, and error states where relevant.
5. For AI-generated results or code changes, make review and control actions explicit.
6. Check desktop and mobile behavior before considering work complete.
7. Prefer simple, deliberate composition over decorative effects.

## Example implementation prompt

"Build a dark AI workspace dashboard using this DESIGN.md. Include a left navigation sidebar, a command/search field with a keyboard shortcut, a primary 'New workspace' action, an agent activity panel, a repository list, and a recent runs table. Use quiet dark surfaces, restrained purple accents, monospace for technical metadata, visible loading and empty states, and responsive behavior."
