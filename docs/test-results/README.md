# Proof Tests Status

This document tracks all 14 mandatory proof tests required by PRD Section 11.

| ID | Test | What it proves | Status | Last Run | Evidence Link |
|---|---|---|---|---|---|
| T1 | Staff calls delete shift directly and gets 403 | Server-side permissions | **PASSED** | 2026-10-12 | [T1.txt](T1.txt) |
| T2 | User from team A reads team B shifts and gets 404 | Team isolation | **PASSED** | 2026-10-12 | [T2.txt](T2.txt) |
| T3 | Proration unit tests, 14 cases | Money math | Pending (M5) | - | - |
| T4 | Refresh token reuse revokes the family | Token theft detection | **PASSED** | 2026-10-12 | [T4.txt](T4.txt) |
| T5 | Same webhook event sent 3 times creates one ledger row | Idempotent webhooks | Pending (M5) | - | - |
| T6 | Bad webhook signature gets 401 and creates nothing | Signature verification | Pending (M5) | - | - |
| T7 | Same Idempotency-Key twice returns the same stored response | Idempotent payments | Pending (M5) | - | - |
| T8 | Starter team cannot invite a sixth member | Seat limits | **PASSED** | 2026-10-12 | [T8.txt](T8.txt) |
| T9 | Cursor pagination with inserts between pages | Feed correctness | **PASSED** | 2026-10-12 | [T9.txt](T9.txt) |
| T10 | Quiet hours worker test delays notification | Settings obeyed | Pending (M6) | - | - |
| T11 | Ledger UPDATE and DELETE fail | Append-only ledger | Pending (M5) | - | - |
| T12 | Rebuilding subscription state from ledger matches | Ledger integrity | Pending (M5) | - | - |
| T13 | Rate limit returns 429 then resets | Redis rate limiting | Pending (M7) | - | - |
| T14 | Invalid push token receipt deletes the device | Token cleanup | Pending (M6) | - | - |
