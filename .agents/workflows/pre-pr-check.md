# /pre-pr-check

Run before every commit or pull request. Report real results. Never claim a check passed unless you ran it.

1. Run lint and type-check. Paste the result.
2. Run the server tests. Paste the summary line and any failures. Fix failures, do not delete tests.
3. Security scan of the diff:
   - Any key, token, password, or database URL with a password? (search for `sk_`, `secret`, `password`, `API_KEY`, `postgres://`)
   - Any new `EXPO_PUBLIC_` variable not listed in `PRD.md` Appendix A?
   - Any token stored with AsyncStorage?
4. Endpoint check for every new or changed route:
   - Zod schema strict? Role check present? `team_id` in every query?
   - Forbidden-path test present?
   - Rate limit if it is auth, invite, or billing?
5. Money check: any float, decimal, or price literal outside `config/plans.ts`? Any ledger UPDATE or DELETE?
6. Docs check: did behaviour change? Update the right file in `docs/` or write an ADR.
7. Commit message follows Conventional Commits.
8. Write the plain-English summary (5 sentences or fewer), name one way it could break, and give the human 3 explain-back questions for `LEARNING-LOG.md`.
