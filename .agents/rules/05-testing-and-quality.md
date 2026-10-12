---
trigger: always_on
---

# Rule 05: Testing and quality

**Activation:** Always On.

## Principle

"It works" is not success. Success means the correct record exists in the database, or the correct response was returned, and you can show it. A claim without evidence is not done.

## Rules for the agent

1. Write the test first or with the code. A feature without a test is unfinished.
2. Run the tests. Paste the real command and the real output. If a test fails, say so and fix it. Never weaken or delete a test to make it pass.
3. Never invent numbers (query times, load test results, coverage). If you could not run something, say that plainly.
4. Use a real Postgres and a real Redis for integration tests (docker compose). Do not mock the database for the proof tests.
5. Each test creates its own data. Tests must pass in any order and in parallel.
6. After a bug fix, add a test that fails without the fix.

## Required proof tests (PRD section 11)

| ID | What it proves |
|---|---|
| T1 | Staff calling delete shift gets 403 |
| T2 | Cross-team read returns 404 |
| T3 | 14 proration cases pass |
| T4 | Refresh token reuse revokes the family |
| T5 | Same webhook three times creates one ledger row |
| T6 | Bad signature gets 401 and writes nothing |
| T7 | Same Idempotency-Key returns the stored response |
| T8 | Starter team cannot invite a sixth member |
| T9 | Cursor pagination is stable with inserts and equal timestamps |
| T10 | Quiet hours delay a 2am notification to 6am local |
| T11 | Ledger UPDATE and DELETE fail |
| T12 | Subscription state rebuilds from the ledger |
| T13 | Rate limit returns 429 then resets |
| T14 | Invalid push token receipt deletes the device |

Keep `docs/test-results/README.md` with a table: test id, file, last run date, result, link to saved output.

## Test layout

```
server/test/unit/          pure functions (proration, quiet hours, shard hash, cursor encode)
server/test/integration/   routes against real Postgres and Redis
server/test/helpers/       factories: createUser, createTeam, loginAs, signWebhook
app/__tests__/             small tests for api client refresh queue and notification route allow list
```

## What good tests look like

- Name says the rule: `staff cannot delete a shift`, not `test 1`.
- Assert status code **and** database state (for example the shift still exists).
- Cover the forbidden and failure paths as much as the happy path.
- Table-driven tests for proration and quiet hours.

## Code quality

1. TypeScript strict. No `any` without a comment explaining why.
2. Lint and type-check must pass before commit.
3. Functions do one thing. Business rules are in services, not routes.
4. Comments explain why, not what. Add a short comment above any non-obvious line (atomic SQL, lock, rotation logic), because the human must explain it later.
5. No dead code, no commented-out blocks, no `console.log` in committed code (use the logger).

## Evidence folders

- `docs/test-results/`: test output files
- `docs/performance/`: `feed-explain-before.txt`, `feed-explain-after.txt`, k6 reports
- `load-tests/`: scripts and `REPORT.md`
