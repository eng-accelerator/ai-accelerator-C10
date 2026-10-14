# Curriculum site

The Next.js companion to the lessons: eighteen chapter pages with interactive demos, a curriculum overview, and a playground that shows the shipped orchestrator.

## Run locally

```bash
cd web
npm install
npm run dev
```

## Keep the code panels in sync

Chapter code comes from the lesson files. After editing a lesson, run from the repo root:

```bash
uv run orion sync-web
```

Only cells whose tag line ends with `web` are copied. Prose and demo transcripts in `lib/chapters/*.ts` are written by hand.

## Deploy

The site deploys from this repository on Vercel.

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `web` |
| Build command | `npm run build` |
| Install command | `npm install` |
| Environment variables | none |
| Production branch | `main` |

Two deployments build from this folder. **Share only the reader site with learners.** The ide-mode site's playground is a canned transcript: its human gate shows "pending" with nothing to approve, which reads as broken. The real approve flow is the local IDE in `orion-ide/`.

| Site | Mode | Vercel project |
|---|---|---|
| https://orion-tutorial-brown.vercel.app | `ide` (default): editor-style chapter pages with the canned demos | `orion-tutorial` |
| https://orion-tutorial-reader.vercel.app | `reader`: plain chapter pages (intro, code, takeaway), no editor layout | `orion-tutorial-reader`, env `NEXT_PUBLIC_SITE_MODE=reader` |

Both are static. Neither calls a model or an API; every chat reply on the ide site is a fixture in `lib/chapters`. The mode is read at build time from `NEXT_PUBLIC_SITE_MODE` (see `lib/siteMode.ts`).

To deploy the reader site from this machine, link to its project first, then relink to the main one afterwards:

```bash
npx vercel link --yes --project orion-tutorial-reader && npx vercel deploy --prod --yes
npx vercel link --yes --project orion-tutorial
```

The project has Root Directory `web` and the repo root is linked to it (`.vercel/`, gitignored). To deploy from this machine:

```bash
npx vercel deploy --prod --yes   # run from the repo root
```

To have every push to `main` deploy on its own, connect GitHub once in the Vercel dashboard: Project Settings, Git, Connect Git Repository, pick `kvsdileep/orion-tutorial`. That needs a GitHub login connection on the Vercel account (Account Settings, Login Connections).
