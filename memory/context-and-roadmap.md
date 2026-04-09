# Founder Stress Tester — project memory

This file is a **running summary** for anyone (including future AI sessions) picking up the thread. Update it when scope or status changes.

_Last updated: 2026-04-09 (repo state: branch `feature/stress-test-mode`, commit `a1e1a59`)._

---

## What we are building

**Founder Stress Tester** is a **small local web app** for NMSU GenAI / learning:

- **Frontend:** single page at [`public/index.html`](../public/index.html) — retro **8-bit jungle** theme with **SVG pixel jaguars**; user enters a **startup idea**, chooses a **stress test mode**, and runs the test.
- **Backend:** [`server.js`](../server.js) — **Node.js + Express** serves static files and **`POST /stress-test`**.
- **AI:** **OpenAI GPT-5.4 mini** (default) via the **Responses API** (`client.responses.create`), **not** Chat Completions, with **`reasoning.effort: low`** for lower latency. Structured output uses **`text.format` → `json_schema`** so the model returns:
  - `coreAssumptions` (array of strings)
  - `majorRisks` (array of strings)
  - `fastestValidationTest` (string)
- **Config:** **`OPENAI_API_KEY`** in `.env` (gitignored); optional **`OPENAI_MODEL`** (default `gpt-5.4-mini`); optional **`OPENAI_REASONING_EFFORT`** (`low` \| `medium` \| `high`, default `low`). Optional **`PORT`**; dev logging via **`STRESS_TEST_LOG`** / **`NODE_ENV`**.

**Stress test modes** (dropdown + API field `mode`): **`brutal`**, **`balanced`** (default), **`supportive`** — same JSON shape; only the **system-style instructions** in the prompt change.

---

## What we have done (in order)

1. **Scaffold** — `package.json`, `server.js`, `public/index.html`; stub JSON from `/stress-test` (no LLM yet).
2. **Real OpenAI integration** — wired `POST /stress-test` to **Responses API** + **structured JSON**; documented why stubs appeared before (intentional placeholder phase).
3. **Port conflict** — **`EADDRINUSE`** on 3000 when a previous server was still running; **fixed** by retrying the next ports when `PORT` is not explicitly set, plus clearer errors when `PORT` is locked.
4. **Dev visibility** — timestamped **terminal logs** and a **heartbeat every ~4s** while waiting on OpenAI (disable with `STRESS_TEST_LOG=0` or `NODE_ENV=production`).
5. **UI theme** — full-page **SVG jungle** background + **pixel jaguar** sprites; **Press Start 2P** / **VT323** fonts.
6. **Git** — initial app pushed to **`main`** (`0698793`).
7. **Feature branch** — **`feature/stress-test-mode`**: mode dropdown + backend validation + **`buildStressTestPrompt`**, pushed to origin (`a1e1a59`).

---

## What did not work or caused friction (and how we handled it)

| Issue | What happened | Resolution |
|--------|----------------|------------|
| **Stub responses** | User saw hard-coded `(stub)` JSON | **Expected** during scaffold; fixed by implementing the real **Responses API** call. |
| **`EADDRINUSE` on port 3000** | Second `npm start` failed | **Retry** next free port if `PORT` env not set; clear message + `lsof`/`kill` hints if `PORT` is fixed. |
| **Long waits felt “silent”** | No feedback until the request finished | **Dev logging** + **heartbeat** in the terminal. |
| **SVG `<use>` + mirror** | Flipping a shared sprite via SVG `transform` was fiddly | **CSS `scaleX(-1)`** on the left hero jaguar; **`<symbol>` + `<use>`** for one source sprite. |

Nothing here indicates a **broken** core design — mostly **environment** (port, API key) or **deliberate** staging (stub first).

---

## Current file map (minimal)

| Path | Role |
|------|------|
| [`server.js`](../server.js) | Express app, `/stress-test`, OpenAI, port logic, dev logs |
| [`public/index.html`](../public/index.html) | UI + `fetch` to `/stress-test` |
| [`package.json`](../package.json) | `express`, `dotenv`, `openai`; `npm start` → `node server.js` |
| [`.env`](../.env) (local) | `OPENAI_API_KEY` — never commit |

---

## What to do next (suggested)

1. **Merge the feature branch** — Open a PR from **`feature/stress-test-mode`** → **`main`** on GitHub and merge when you are happy with modes + prompts.
2. **Align local default branch** — After merge, `git checkout main && git pull` so day-to-day work matches production branch.
3. **README** — Optionally add: how to run (`npm install`, `.env`, `npm start`), link to Responses API / GPT-5, and mention **stress test modes**.
4. **Polish (optional)** — Loading state in the UI (spinner text), copy tweaks per mode, or saving last-used mode in `localStorage`.
5. **Keep this file fresh** — After merges or big behavior changes, update **“Last updated”** and the **“What we have done”** section.

---

## Plans on disk (reference only)

Detailed feature specs may also live under Cursor plans (e.g. scaffold, stress-test-mode). This **`memory/`** doc is the **narrative thread**; plans are the **step-by-step specs**.
