---
name: docs-and-adr-writer
description: Use when writing or updating Rota documentation: README top section, ARCHITECTURE.md, STATE.md, SECURITY.md with 8 threats, SHARDING.md, ADRs in docs/decisions, the app store billing section, and LEARNING-LOG.md templates. Keeps docs accurate and in the builder's own voice.
---

# Documentation and ADR writer

Docs are part of the grade and part of the interview. Write them as you build. Keep sentences short, plain, and active. Do not invent facts: if you have not measured or built something, say so. The human owns the words, so propose drafts and let them rewrite.

## README (first screen matters)

Top of file, in this order:

```
# Rota
One line: Shift scheduling and per-seat billing for small teams, built with React Native, Hono, and PostgreSQL.

![demo](docs/demo.gif)

**Android build:** <link>   **Demo video (3 min):** <link>   **API:** <link>
```

Then: problem, what it does (bullets), stack, run locally (exact commands), architecture summary with diagram, key decisions (3 to 5 with links to ADRs), proof (links to tests, query plans, load test report), the `EXPO_PUBLIC_` list, the app store billing section, and "what I would do next".

### `EXPO_PUBLIC_` section (required)

List every variable and why it is safe:

| Variable | Why safe |
|---|---|
| EXPO_PUBLIC_API_URL | Public address of the API |
| EXPO_PUBLIC_SENTRY_DSN_APP | A DSN can only send events |
| EXPO_PUBLIC_EAS_PROJECT_ID | An identifier, not a credential |

### App store billing section (required, short)

Cover: (1) Apple and Google have rules requiring their own in-app purchase systems for many digital subscriptions sold inside apps; (2) Rota is a business subscription for managing teams, which may qualify for different treatment than consumer subscriptions, but this must be checked against the **current** Apple App Review Guidelines (look at the section on enterprise services under 3.1.3) and the **current** Google Play payments policy; (3) what you would do in production: either keep checkout on the web and link out where allowed, or use store billing and adjust pricing for the fees; (4) your conclusion and what you are unsure about. Search the live policy pages before writing and link them. Do not copy policy text from memory.

## ARCHITECTURE.md

Sections: overview, diagram (Mermaid), components, request lifecycle, data placement (sharded vs global), pooling numbers and reasoning, read routing and the 5-second rule, caching table (cached: key, TTL, invalidation; never cached: list and reasons), queues and retry policy, observability, proration formula and rounding rule, settings conflict rule and weakness, known limits.

## STATE.md

Use the table from `mobile-state-offline-optimistic`. Add a short paragraph on cache time choices.

## SECURITY.md (8 threats minimum)

| # | Threat | Attack | Defence in Rota | Evidence |
|---|---|---|---|---|
| 1 | Stolen access token | Attacker copies a token | 15 min life, token version check, logout-all | Auth tests |
| 2 | Stolen refresh token | Attacker refreshes in parallel | Rotation, reuse detection revokes family | T4 |
| 3 | Privilege escalation | Staff calls manager endpoint with Postman | Server permission middleware | T1 |
| 4 | Cross-team data access | User guesses another team's ids | Team filter on every query, 404 | T2 |
| 5 | Secret in app bundle | Unzip the APK and search | Secrets only on server, EXPO_PUBLIC list | README list, repo scan |
| 6 | Forged or replayed webhook | Fake payment success | Signature check on raw body, event id unique | T5, T6 |
| 7 | Double charge from retry | Network drops after payment | Idempotency keys, unique ledger keys | T7 |
| 8 | Brute force and enumeration | Guess passwords, probe emails | Redis rate limits, generic errors | T13 |

Add more if you found them: SQL injection (parameterised queries, Zod), invite token guessing (random, hashed, single use), mass assignment (strict Zod schemas), abuse of seats (server seat limit with row lock).

## SHARDING.md

See `shard-router-and-db-routing` for required sections.

## ADRs (`docs/decisions/ADR-NNN-title.md`)

Template:

```
# ADR-NNN: Title
Date: 2026-10-DD   Status: accepted

## Problem
What needed deciding, and the constraints (deadline, free tiers, task rules).

## Options considered
1. Option A: pros, cons
2. Option B: pros, cons

## Decision
What we chose.

## Why
Reasons, with evidence if any.

## Consequences
What gets easier, what gets harder, what we would revisit.
```

Starter ADRs: monorepo, Hono, Prisma plus raw SQL, magic link over Google, payment provider and currency, hosting, pool sizes, cache TTLs, settings conflict rule, restricted mode behaviour, cursor format.

## LEARNING-LOG.md (human writes, agent only gives the template and questions)

```
## 2026-10-DD: <task name>
What I built (2 or 3 sentences, my words):
Why it works (the core idea):
How it could break:
One thing I got wrong or learned:
Interview question I can now answer:
```

The agent must not fill these in. Provide the 3 explain-back questions from the skill used and stop.

## LinkedIn post helper (the human writes the post)

Good topics from this project: why the feed uses cursors and what broke with offset, how refresh token reuse detection catches a stolen token, the 1634 versus 1633 rounding decision in proration, why push is sent from a job, the quiet-hours offline conflict and its weakness, the hot shard problem with `team_id`. A strong post has: the problem, the one decision, what was learned, one screenshot or clip.

## Review checklist before saying docs are done

- [ ] Every claim has a link to code, a test, or a saved output
- [ ] No invented numbers
- [ ] Commands in "run locally" were actually run
- [ ] No em dashes or filler, short sentences, active voice
- [ ] No secrets in screenshots or logs
