# AGENTS.md: Rota

Rota is a shift scheduling app for small teams (restaurants, clinics, retail). Owners create teams, invite staff, and publish shifts. Managers approve swaps. Staff see shifts, request swaps, and get push notifications. Businesses pay a monthly subscription priced per seat.

This is a graduation project (Dev and Design HQ final task, Part 2, Task A). Deadline: Monday, 19 October 2026.

**Read `PRD.md` before every task.** If this file and `PRD.md` disagree, `PRD.md` wins. If `PRD.md` is silent, ask the human or record a new assumption as an ADR.

## Who you are working with

The human is a product designer and design engineer who is learning backend system design through this project. They must be able to explain every line you write in a job interview. So:

1. Work in small steps. One feature or one fix per task. Say what you will do before you do it.
2. After each task, give a short plain-English summary: what changed, why, and what could break it.
3. Never write the human's `LEARNING-LOG.md` entries. Give them 3 questions to answer in their own words instead.
4. Never say a test passes unless you ran it and saw it pass. Paste real output. Never invent numbers, query plans, or load test results.
5. If you are unsure about a library API, payment provider behaviour, or a store policy, read the current official docs first. Do not guess from memory. These tools change fast.

## Repo map

```
rota/
  app/            Expo (React Native) mobile app. See app/AGENTS.md
  server/         Hono API, workers, migrations. See server/AGENTS.md
  load-tests/     k6 scripts and written reports
  docs/           ARCHITECTURE, STATE, SECURITY, SHARDING, decisions/, performance/, test-results/
  .agents/        Rules, skills, workflows for Antigravity
  PRD.md          Source of truth for requirements
  LEARNING-LOG.md Human-written explain-back paragraphs
```

## Stack (decided, see PRD section 8)

TypeScript everywhere. App: Expo, Expo Router, TanStack Query, Zustand, FlashList, expo-secure-store, expo-notifications. Server: Node, Hono, Zod, Prisma plus raw SQL, PostgreSQL (two databases), Redis, BullMQ. Payments: Paystack or Flutterwave in test mode. Tests: Vitest. Load tests: k6.

## Non-negotiable rules (full text in `.agents/rules/`)

1. **Never trust the frontend.** Every permission, price, and payment decision happens on the server.
2. **Money is integer cents.** No floats, no decimals, ever. Currency is stored with every amount.
3. **No secrets in the repo or the app.** Secrets live in server environment variables. Only `.env.example` (names, no values) is committed. Never put a secret in an `EXPO_PUBLIC_` variable.
4. **Validate every request with Zod** on the server (body, query, params).
5. **Every query on team data filters by `team_id`.** Tenant isolation is tested.
6. **Ledger rows are never updated or deleted.** Corrections are new rows.
7. **Slow or unreliable work runs in a background job** (push, email, webhooks, renewals) with exponential backoff and a failed list.
8. **Redis for rate limits, caches, and locks.** Never in-memory objects.
9. **"It works" is not success.** Success is the correct record in the database, shown with a query or a test.
10. **Conventional Commits** and small pull requests.

## Commands

Fill these in during milestone M0 and keep them current.

```
npm run dev:server     start API and workers locally
npm run dev:app        start Expo dev client
npm run db:migrate     run migrations on both shards
npm run db:seed        seed users, teams, shifts, 10,000 activity events
npm run test           run server tests (Vitest)
npm run test:proration run proration unit tests only
npm run lint           lint and type-check
npm run loadtest       run k6 feed test (see load-tests/README.md)
```

## Definition of done (every task)

- Code compiles and lints.
- Tests for the change exist and pass (output pasted).
- Server validates input and enforces permissions for any new endpoint.
- No secret, key, or token added anywhere.
- Docs updated if behaviour changed (`docs/`, `README.md`, ADR if a decision was made).
- Conventional commit message written.
- Human got the plain-English summary and the 3 explain-back questions.

## Where to find more

- Rules (always loaded or by path): `.agents/rules/`
- Skills (load when the task matches): `.agents/skills/`
- Workflows (slash commands): `.agents/workflows/`

Skills available: `auth-and-token-rotation`, `rbac-and-tenant-isolation`, `cursor-pagination-feed`, `proration-engine`, `payments-webhooks-ledger`, `push-notifications-pipeline`, `settings-sync-and-quiet-hours`, `shard-router-and-db-routing`, `redis-cache-and-rate-limit`, `mobile-state-offline-optimistic`, `eas-build-and-deep-links`, `load-testing-and-observability`, `docs-and-adr-writer`.

## Never do

- Never commit `.env`, keys, tokens, or database URLs with passwords.
- Never add a dependency without saying why, and check it is maintained.
- Never skip a failing test by deleting or loosening it.
- Never call a payment provider from the app.
- Never cache subscription status, payment status, balances, role checks, or webhook idempotency records.
- Never fake commit history or test output.
