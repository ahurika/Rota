---
trigger: always_on
---

# Rule 06: Git, documentation, and learning

**Activation:** Always On.

## Git

1. Work on feature branches named `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
2. Use Conventional Commits: `feat: add cursor pagination to activity feed`, `fix: reject reused refresh token`, `docs: add sharding plan`, `test: cover seat limit on invite`, `chore: add docker compose`.
3. One logical change per commit. Small pull requests.
4. Open a pull request for each feature with: what changed, why, how it was tested (paste output), and screenshots for UI. The human merges it.
5. Never force-push to `main`. Never commit secrets (see Rule 01).
6. Do not create empty or filler commits. History must be honest.
7. Use GitHub Issues as the task list. Reference issues in PRs (`Closes #12`).

## Documentation files

| File | Contents | Updated when |
|---|---|---|
| `README.md` | Top: one-line description, GIF, download link, demo link. Then problem, stack, run locally, architecture summary, key decisions, next steps, app store billing note, `EXPO_PUBLIC_` list | Every milestone |
| `docs/ARCHITECTURE.md` | Diagram, components, data flow, caching table (cached and never cached), pooling numbers, read routing | Any structural change |
| `docs/STATE.md` | Every important piece of data: where it lives and why | New data added in the app |
| `docs/SECURITY.md` | 8 or more threats with handling | Any security change |
| `docs/SHARDING.md` | Shard key, hot team plan, harder queries | Schema or routing change |
| `docs/decisions/ADR-NNN-title.md` | One decision each | Every non-trivial choice |
| `LEARNING-LOG.md` | Human-written explain-back paragraphs | After each task |

Write docs as you build, not at the end.

## ADRs

Write an ADR for every important choice: problem, options considered, decision, why, consequences. Start with: ADR-001 monorepo, ADR-002 Hono, ADR-003 Prisma plus raw SQL, ADR-004 magic link, ADR-005 payment provider and currency, ADR-006 hosting, ADR-007 pool sizes, ADR-008 cache TTLs, ADR-009 settings conflict rule, ADR-010 restricted mode. Use skill `docs-and-adr-writer`.

## The explain-back rule

The human must understand and be able to explain everything submitted. After finishing a task:

1. Give a plain-English summary in 5 sentences or fewer.
2. Point to the 2 or 3 lines that matter most and say why they exist.
3. Name one way it could break.
4. Ask the human 3 questions to answer in their own words in `LEARNING-LOG.md`. Examples: "Why does the refresh endpoint mark the old token used before issuing a new one?" or "What would happen if two requests sent the same refresh token at the same time?"
5. Do not write the log entry for them. Do not accept "I understand" as the answer.

## Teaching mode

When the human asks "why", answer from first principles with a small example, then connect it back to the code. Prefer a simple analogy plus the exact failure it prevents. Offer an interview-style question afterward.

## LinkedIn post support

When a milestone ends, suggest 3 specific decisions that would make a good post (problem, fix, what was learned). Do not draft generic "excited to announce" posts. The human writes the final post.
