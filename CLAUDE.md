# Nounce — Claude Code project guide

Web-based English pronunciation assessment for Turkish-native learners. Browser records audio → TanStack Start server → RunPod worker (POWSM phone-recognition + CTC alignment) → per-phone feedback. Senior project at Boğaziçi University; defense **2026-06-13**. Currently mid-V2.

## Source of truth

- **`doc/V2_CONTEXT.md`** — full reference: POWSM internals, CTC alignment API, GOP, MFA deprecation, RunPod, Turkish-L1 → English-L2 phonetics, conventions, file map, glossary, citations. Mirrored at GitHub issue **#42** (pinned). Read this before any non-trivial V2 task.
- **`NOUNCE_V2_PLAN.md`** (root, untracked) — original V2 plan brief.
- **GitHub issues**, organized as epics E1–E9 (labels `epic:E1-cleanup`, …, `epic:E9-learn-audio`). Browse: `gh issue list -l v2 --limit 50`. Each child issue has `Parent: #N` and `Blocked by:` cross-refs.

## Repo layout

- `app/` — TanStack Start + React 19. DB via Drizzle/Neon (`app/src/db/`). R2 via `app/src/lib/r2.ts`. Clerk auth. Deployed on Fly.io.
- `mod/` — Python RunPod workers. `assessment/` is the live one. (V1's `ipa_generation/` G2P worker was removed in E1 / #12.)
- `mod/dev/runpod_proxy.py` + `docker-compose.dev.yml` — local RunPod simulator. Run with `python scripts/runpod.py`.
- `sig/` — research notebooks (POWSM exploration).
- `scripts/` — one-off Python/TS scripts (deploy, eval, audio download).

## Conventions that apply to every task

- **Phone tokens** in our DB are stored *without* POWSM's `/.../` slashes. Strip on the way in. See `app/src/lib/ipa.ts`.
- **Sample rate**: 16 kHz everywhere in the ML path. WAV uploads can be 16k/48k mono; `librosa.load(..., sr=16000, mono=True)` normalizes.
- **POWSM frame stride is 40 ms** (read `model.preprocessor_conf["speech_resolution"]`, do **not** hardcode; ESPnet's `force_align.py` recipe has 0.02 which is wrong for POWSM). See `doc/V2_CONTEXT.md` §3.
- **`forced_align` is batch-size-1 only**; target sequence must not contain `<blank>`; pad to 20 s. See issue #14.
- **Drizzle migrations** — `app/src/db/schema.ts` is the single source of truth. Every schema change: edit schema.ts → `pnpm db:generate` → **inspect the SQL** (if it changes anything you didn't intend, STOP and reconcile drift) → commit the schema change **and** the generated `app/drizzle/NNNN_*.sql` + `meta/NNNN_snapshot.json` + `meta/_journal.json` in **one commit**. Migrations are append-only (never edit/delete an existing migration or snapshot). **Never `db:push` without first generating + committing the migration** — that's how the `0009_chief_tiger_shark` orphan happened. There's a single Neon DB (the `development` branch) for local **and** prod, so `db:push` hits the live app immediately — review the generated SQL first and keep changes additive. Full rules: `doc/db.md` §Migrations.
- **Generated files — never hand-edit.** `app/src/routeTree.gen.ts` is produced by the TanStack vite plugin; it regenerates on `pnpm dev`/`pnpm build`. When you add/remove a route file, regenerate and commit `routeTree.gen.ts` alongside the change. Same for Drizzle `meta/` snapshots.
- **DB access** goes through `app/src/db/*.ts` helpers; **RunPod calls** through `app/src/lib/assessment-submission.ts`. Never from a route's `loader`.
- **`mod/`**: singleton-load models on container startup, never per request. No MFA / Kaldi / TextGrid references in new code (we just stripped them — see Epic E1).
- **TypeScript**: Biome (`biome.json`). Run `pnpm check` in `app/` before committing TS/TSX and don't introduce new lint/format errors (note: `scripts/` is excluded from Biome, so it won't catch issues there). Imports use `@/db/...`, `@/lib/...` aliases.
- **Python**: standard library + numpy/torch idioms. Tests live in `mod/tests/`.
- **Commits**: lowercase prefix (`app:`, `doc:`, `mod:`, `ci:`, `chore:`) + colon + short description. Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when I authored. Never push without explicit ask.
- **Issues + PRs**: reference issue number (`Fixes #N`). Cross-link parent epic.

## Two Turkish-L1 facts you'll touch often

- Turkish phonology lacks `/θ ð w ŋ ɹ/`; vowel inventory is smaller (8 vs English's 12+). See `doc/V2_CONTEXT.md` §4 for the full error table.
- Validation sentences must be **natural conversational** — not "the thing there is theirs though" wordplay. See issue #24 brief.

## Available project skills

These are surgical, low-context helpers — invoke via `Skill` tool, don't reinvent.

- **`gh-issue-read`** — read parts of a GitHub issue (title, labels, body slice, checklist state, comments) without pulling the full body into context.
- **`gh-issue-update`** — surgically update issues: toggle a subtask checkbox, append a comment, change labels/title, replace one section — without rewriting the whole body in chat.

## Do-not list

- Don't push to remote without explicit user ask.
- Don't run destructive git (`reset --hard`, `push --force`, branch -D) without explicit ask.
- Don't commit `NOUNCE_V2_PLAN.md`, `biome.json`, or untracked siblings unless that's the request.
- Don't reintroduce MFA, the G2P endpoint, or heuristic timestamps.
- Don't dump full issue bodies into chat to make a tiny edit — use the `gh-issue-update` skill.
- Don't paraphrase POWSM internals from memory; check `doc/V2_CONTEXT.md` §3 or the actual ESPnet source.
