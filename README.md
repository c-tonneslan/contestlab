# contestlab

LeetCode-style coding contests, in your browser. Each contest gives you four problems (easy, easy-medium, medium, hard), a 90-minute timer, and a score that decays with elapsed time and wrong submissions. Built to drill technical interview pacing.

## What's in a contest

- 4 problems pulled from two sources:
  - **Codeforces** (default): ~9000 real competitive programming problems with difficulty ratings, fetched live from their public API.
  - **AI-generated**: Claude writes novel problems in your chosen pattern. Defaults to 1 generated problem per contest so every round has at least one thing you can't have seen before.
- Pattern bias: pick a tag (DP, graphs, two pointers, etc.) and the contest skews toward that topic.
- Code runs in your browser via **Pyodide** (Python compiled to WebAssembly). No backend judge, no API key needed for execution.
- Scoring follows LeetCode weekly contest rules:
  - Full credit for solving within 10 minutes.
  - Linear decay to 30% credit at contest end.
  - 5-minute penalty per wrong submission before the AC.

## Setup

```sh
cp .env.example .env
# Add ANTHROPIC_API_KEY if you want AI-generated problems. Without it,
# create contests with generatedCount=0 (Codeforces-only).
npm install
npm run dev
```

Open `http://localhost:3000`.

First problem load takes 5-10 seconds while Pyodide downloads (~10MB, cached after).

## Why these tech choices

- **Codeforces over LeetCode** for the problem bank: LeetCode has no public API and scraping their problems is ToS-iffy. Codeforces has a clean public API with ~9000 rated problems and tags.
- **Pyodide over Piston/Judge0** for code execution: the public Piston API went whitelist-only in Feb 2026, Judge0's free tier rate-limits you to 50/day. Pyodide runs in the user's browser — no rate limits, no API keys, no signup. Tradeoff: ~10MB initial download, Python-only.
- **Claude over GPT** for problem generation: I have an Anthropic key. Both work; the prompt is in `lib/generate.ts`.
- **localStorage over Postgres**: this is a single-user practice tool. Contests don't need to survive across devices.

## Limitations (today)

- Codeforces problems link out for the full statement — we only show metadata, since their statements aren't in the API. The "Run" panel works but "Submit" with the built-in judge doesn't (no test bank).
- AI-generated problems have a self-judging test bank, so "Submit" works fully on those.
- No hard execution timeout on Pyodide runs — infinite loops will hang the tab until killed. Move to a Web Worker for v2.
- Python only.

## Architecture

```
app/
  api/contest/new/   POST -> assembles a contest (Codeforces + LLM)
  contest/[id]/      contest dashboard (4 problems + score + timer)
  contest/[id]/[problemId]/  Monaco editor + run/submit
components/
  Editor.tsx         Monaco wrapper
  Timer.tsx          countdown clock
lib/
  codeforces.ts      problem bank client (cached)
  generate.ts        Claude problem generator
  contest.ts         scoring math (client-safe)
  contest-server.ts  assembly logic (server-only, pulls in Anthropic SDK)
  pyodide.ts         in-browser Python execution
  storage.ts         localStorage contest persistence
types/
  index.ts           shared types
```
