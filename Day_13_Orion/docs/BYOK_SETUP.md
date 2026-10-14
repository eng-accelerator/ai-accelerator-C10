# Bring your own key

Orion does not ship with a model key. You create one at OpenRouter, keep it on your machine, and everything in the repository uses it: the lessons, the command line, and the IDE. This page is the whole setup, start to finish.

## 1. Get an OpenRouter key

1. Sign in at [openrouter.ai](https://openrouter.ai).
2. Open **Settings, Credits** and add a small amount. Five dollars is more than enough for the entire course; one full run of all eighteen chapters costs well under a dollar with the default models.
3. Open **Settings, Keys**, click **Create key**, give it a label such as `orion`, and copy it. It starts with `sk-or-v1-`.

Why OpenRouter and not a provider key: one key gives you GPT, Claude, Gemini, DeepSeek, and the rest, chosen by id. The lessons use two ids, a fast cheap one for the many small calls in Lessons 1 and 2, and a strong one for planning and review in Lesson 3. You can change either in one place, `src/orion_agent/llm.py`.

## 2. Put the key where Orion looks

There are two places. Use the first for the lessons, either for the IDE.

**`.env` in the repository root** (lessons, CLI, and IDE)

```bash
cp .env.example .env
```

Open `.env` and replace `your_openrouter_key` with your key. `.env` is in `.gitignore`; it never leaves your machine.

**The IDE's key screen** (IDE only)

Start the IDE and it asks for a key on first load if `.env` has none. Paste it, click **Check** to have OpenRouter confirm it, and tick **Remember this key in this browser** if you want it kept in `localStorage` across reloads. The key travels only between your browser and the local backend, which forwards it to OpenRouter and never writes it to disk. The key icon at the bottom of the activity bar reopens this screen; its dot is green when a key is in place.

## 3. Check everything at once

```bash
uv sync
uv run orion doctor
```

`doctor` prints one line per check: Python version, key found and valid (with its label and spend so far), both model ids available, workspace ready, and whether Node is installed for the IDE frontend. Each failing line says what to do. Then:

```bash
uv run orion reset      # copies sample_project/ into workspace/
uv run pytest           # 100+ offline tests, no key needed
```

## 4. Run something

Pick one:

- **The lessons.** Open the repository folder in Cursor, open `lessons/01_hands/ch01_llm_setup.py`, put the cursor in the first cell, press Shift+Enter. See `lessons/README.md`.
- **The IDE.** `uv run orion ide`, then open http://localhost:8000. The first time, build the frontend once: `cd orion-ide/frontend && npm install && npm run build`. See `orion-ide/README.md`.

## Costs and models

| Constant | Default | Used for | Rough cost per lesson run |
|---|---|---|---|
| `FAST` | `openai/gpt-4.1-mini` | Lessons 1 and 2, the IDE chat | a few cents |
| `STRONG` | `anthropic/claude-sonnet-4.5` | Lesson 3 planning, coding, review | ten to thirty cents per feature |

`get_llm` also sends OpenRouter a fallback list, so if a provider is down or a model is unavailable in your region the call is routed to the next one instead of failing. `uv run orion check-models` confirms both ids exist.

In the IDE the model menu on the key screen picks one model for chat and agent runs. Claude Sonnet is the safest choice for multi-file agent runs; the cheaper models are fine for chat.

## Keeping the key safe

- Never paste the key into a lesson file, a rule, or a skill. `setup()` loads it from `.env` for you.
- Never commit `.env`. `git status` should not list it; if it does, `.gitignore` was edited.
- If a key leaks, delete it at openrouter.ai and create a new one. Keys are free; credit is tied to the account, not the key.
- The IDE's **Check** button sends the key to OpenRouter's `/auth/key` endpoint and returns only the verdict, label, and spend. The backend never logs it.

## If it does not work

`uv run orion doctor` first. Then [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
