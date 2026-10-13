# AGENTS.md: Rota

Rota is a shift scheduling app for small teams (restaurants, clinics, retail). Owners create teams, invite staff, and publish shifts. Managers approve swaps. Staff see shifts, request swaps, and get push notifications. Businesses pay a monthly subscription priced per seat.

This is a graduation project (Dev and Design HQ final task, Part 2, Task A). Deadline: Monday, 19 October 2026.

**Read `PRD.md` before every task.** If this file and `PRD.md` disagree, `PRD.md` wins. If `PRD.md` is silent, ask the human or record a new assumption as an ADR.

---

## Who you are working with

The human is a product designer and design engineer who is learning backend system design through this project. They must be able to explain every line you write in a job interview. So:

1. Work in small steps. One feature or one fix per task. Say what you will do before you do it.
2. After each task, give a short plain-English summary: what changed, why, and what could break it.
3. Never write the human's `LEARNING-LOG.md` entries. Give them 3 questions to answer in their own words instead.
4. Never say a test passes unless you ran it and saw it pass. Paste real output. Never invent numbers, query plans, or load test results.
5. If you are unsure about a library API, payment provider behaviour, or a store policy, read the current official docs first. Do not guess from memory. These tools change fast.

---

## Repo map

```
rota/
  app/            Expo (React Native) mobile app (see App Architecture below)
  server/         Hono API, workers, migrations (see Server Architecture below)
  load-tests/     k6 scripts and written reports
  docs/           ARCHITECTURE, STATE, SECURITY, SHARDING, DESIGN, decisions/, performance/, test-results/
  .agents/        Rules, skills, workflows for Antigravity
  PRD.md          Source of truth for requirements
  LEARNING-LOG.md Human-written explain-back paragraphs
```

---

## Stack (decided, see PRD section 8)

TypeScript everywhere.
- **Mobile Client**: React Native, Expo SDK 52, Expo Router, TanStack Query, Zustand, FlashList, expo-secure-store, expo-notifications, React Native Paper (Material Design 3).
- **Backend API**: Node.js, Hono, Zod, PostgreSQL (two databases for sharding), Redis, BullMQ.
- **Payments**: Paystack or Flutterwave in test mode.
- **Testing**: Vitest, k6.

---

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

---

## Server Architecture & Rules

### Layout
```
server/
  src/
    app.ts                 Hono app, middleware order
    index.ts               HTTP entry point
    worker.ts              Queue workers entry point (separate process)
    config/                env parsing (Zod), plans.ts (prices, caps)
    routes/                HTTP handlers only: parse, call service, respond
    services/              Business rules (billing, swaps, invites, feed)
    repositories/          All SQL and Prisma calls, one module per aggregate
    db/                    shard router, pools, read routing, migrations
    jobs/                  Queue definitions and processors
    lib/                   logger, errors, crypto, redis, idempotency, rate-limit
    middleware/            requestId, auth, requireRole, rateLimit, idempotency
  prisma/ or migrations/   Schema and SQL migrations
  test/                    Vitest tests (unit, integration)
```

### Layer Rules
1. Routes never touch the database. Routes call services.
2. Services never read `process.env`. They use `config/`.
3. Repositories always take `teamId` for team-scoped data and always include it in the query.
4. Billing math lives in `services/billing/proration.ts` as pure functions with no I/O.
5. Every route declares its Zod schema and its required role in one place at the top of the file.
6. One error class (`AppError`) with a stable `code`. Handlers return `{ error: { code, message, requestId } }`.

### Middleware Order
`requestId` $\to$ `logger` $\to$ `sentry` $\to$ `rateLimit (IP)` $\to$ `auth` $\to$ `rateLimit (user)` $\to$ `requireRole` $\to$ `idempotency (where needed)` $\to$ handler.

### Migrations & Ledger
- Every migration is a new file. Never edit an applied migration.
- The ledger trigger that blocks UPDATE and DELETE is part of the ledger migration.

---

## Mobile App Architecture & Rules

### Layout
```
app/
  app/                      Expo Router routes (screens)
    (auth)/                 login, register, magic link, reset
    (tabs)/                 shifts, swaps, feed, team, settings
    invite/[token].tsx      deep link target for invites
  src/
    api/                    typed fetch client, error mapping, token refresh
    features/               shifts/, swaps/, feed/, billing/, settings/, auth/
    state/                  zustand stores (UI state only)
    query/                  QueryClient, persister, query keys
    notifications/          registration, tap handling, deep link routing
    ui/                     tokens.ts, theme.ts, components/, and utilities
    lib/                    secure storage, date helpers, constants
```

### App Rules
1. Server data goes through TanStack Query. Zustand holds UI-only state (selected tab, draft form, filters).
2. Tokens live only in `expo-secure-store`. Never AsyncStorage.
3. The app never decides a payment result. After checkout it polls the server billing status.
4. Every list has loading, empty, error, and end states. A blank screen is a bug.
5. Every touchable has an `accessibilityLabel` and a touch target of at least 48dp for Material 3.
6. Colours, spacing, and type sizes come from `src/ui/tokens.ts` and `src/ui/theme.ts`. No random numbers in styles.
7. The only `EXPO_PUBLIC_` variables allowed are: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN_APP`, `EXPO_PUBLIC_EAS_PROJECT_ID`.
8. Optimistic updates always have an `onError` rollback and an `onSettled` refetch.
9. Notification taps must validate the route against an allow list before navigating.
10. UI and UX follow Material Design 3 (see `docs/DESIGN.md`). Use React Native Paper components. No drop shadows, no gradients. Destructive actions always use `ConfirmDialog`.

---

## Commands

```
npm run dev:server     start API and workers locally
npm run dev:app        start Expo dev client
npm run db:migrate     run migrations on both shards
npm run db:seed        seed users, teams, shifts, 10,000 activity events
npm run test           run server tests (Vitest)
npm run test:app       run mobile app tests (Vitest)
npm run test:proration run proration unit tests only
npm run lint           lint and type-check server
npm run lint:app       lint and type-check app
npm run build:server   compile server TypeScript to dist/
npm run loadtest       run k6 feed test (see load-tests/README.md)
```

---

## Definition of Done (every task)

- Code compiles and lints (`npm run lint`, `npm run lint:app`).
- Tests for the change exist and pass (output pasted).
- Server validates input and enforces permissions for any new endpoint.
- No secret, key, or token added anywhere.
- Docs updated if behaviour changed (`docs/`, `README.md`, ADR if a decision was made).
- Conventional commit message written.
- Human got the plain-English summary and the 3 explain-back questions.

---

## Never do

- Never commit `.env`, keys, tokens, or database URLs with passwords.
- Never add a dependency without saying why, and check it is maintained.
- Never skip a failing test by deleting or loosening it.
- Never call a payment provider from the app.
- Never cache subscription status, payment status, balances, role checks, or webhook idempotency records.
- Never fake commit history or test output.
