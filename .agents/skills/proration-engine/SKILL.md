---
name: proration-engine
description: Use when implementing, changing, or testing Rota subscription pricing, seat changes, upgrades, downgrades, or proration math. Contains the exact plan table in cents, the pure function, the rounding rule, and 14 verified test cases with expected results.
---

# Proration engine

Proration means charging fairly for part of a billing period when a customer changes plan or seats in the middle of it. Rota does this itself on the server. Never use a provider feature to calculate it.

## Plan config (`server/src/config/plans.ts`, the only place prices live)

```ts
export const PLANS = {
  starter:  { priceCents: 2000,  includedSeats: 5,  extraSeatCents: null, maxSeats: 5 },
  team:     { priceCents: 5000,  includedSeats: 15, extraSeatCents: 300,  maxSeats: 30 },
  business: { priceCents: 12000, includedSeats: 40, extraSeatCents: 200,  maxSeats: 100 },
} as const;
export type PlanId = keyof typeof PLANS;
```

Seat caps are assumption A2 in `PRD.md`. Change them here only.

## Formulas

```
monthly(plan, seats) = basePrice + max(0, seats - includedSeats) * extraSeatPrice
elapsedDays   = floor((changeTime - periodStart) / 86,400,000 ms)
remainingDays = clamp(periodDays - elapsedDays, 1, periodDays)
oldPart = floor(oldMonthly * remainingDays / periodDays)   // credit for unused time
newPart = floor(newMonthly * remainingDays / periodDays)   // cost for the rest of the period
charge  = newPart - oldPart
```

**Rounding rule:** floor each part separately, then subtract. All values are integers. State this in `docs/ARCHITECTURE.md`.

**Direction rule:**
- `newMonthly > oldMonthly`: apply now, charge `charge`.
- `newMonthly == oldMonthly`: apply now, charge 0.
- `newMonthly < oldMonthly`: schedule for the next renewal, charge 0, no refund, no credit.

## Reference implementation (pure, no I/O)

```ts
const DAY_MS = 86_400_000;

export class DomainError extends Error {
  constructor(public code: string) { super(code); }
}

export function monthlyCents(plan: PlanId, seats: number): number {
  const p = PLANS[plan];
  if (!Number.isInteger(seats) || seats < 1 || seats > p.maxSeats) {
    throw new DomainError('SEATS_OUT_OF_RANGE');
  }
  if (p.extraSeatCents === null) return p.priceCents;
  return p.priceCents + Math.max(0, seats - p.includedSeats) * p.extraSeatCents;
}

export function remainingDays(periodStart: Date, now: Date, periodDays: number): number {
  const elapsed = Math.floor((now.getTime() - periodStart.getTime()) / DAY_MS);
  return Math.min(periodDays, Math.max(1, periodDays - elapsed));
}

export type ProrationResult =
  | { kind: 'immediate'; chargeCents: number; creditCents: number; costCents: number; remainingDays: number }
  | { kind: 'scheduled'; chargeCents: 0; effectiveAt: Date };

export function prorateChange(input: {
  oldPlan: PlanId; oldSeats: number;
  newPlan: PlanId; newSeats: number;
  periodStart: Date; periodDays: number; now: Date;
}): ProrationResult {
  const oldM = monthlyCents(input.oldPlan, input.oldSeats);
  const newM = monthlyCents(input.newPlan, input.newSeats);
  if (newM < oldM) {
    return { kind: 'scheduled', chargeCents: 0,
      effectiveAt: new Date(input.periodStart.getTime() + input.periodDays * DAY_MS) };
  }
  const r = remainingDays(input.periodStart, input.now, input.periodDays);
  const creditCents = Math.floor((oldM * r) / input.periodDays);
  const costCents = Math.floor((newM * r) / input.periodDays);
  return { kind: 'immediate', chargeCents: costCents - creditCents, creditCents, costCents, remainingDays: r };
}
```

Integers below 2^53 multiply safely here (largest product is about 12,000 times 31 plus extras, far below the limit).

## The 14 test cases (all values below were computed and checked)

Use period start 2026-10-01 UTC. "Elapsed" is whole days since start. Table-driven Vitest test.

| # | Scenario | Period days | Elapsed | Old to new | Expected |
|---|---|---|---|---|---|
| 1 | Starter(5) to Team(5), the brief's example (the 11th) | 30 | 10 | 2000 to 5000 | immediate, remaining 20, credit 1333, cost 3333, **charge 2000** |
| 2 | Team at 15 seats adds 3 (18 seats) | 30 | 18 | 5000 to 5900 | immediate, remaining 12, credit 2000, cost 2360, **charge 360** |
| 3 | Team(5) to Starter(5) downgrade | 30 | 10 | 5000 to 2000 | **scheduled**, charge 0 |
| 4 | Team 10 to 14 seats (still inside included seats) | 30 | 10 | 5000 to 5000 | immediate, **charge 0** |
| 5 | Team 20 to 17 seats (remove seats) | 30 | 10 | 6500 to 5600 | **scheduled**, charge 0 |
| 6 | Change on the first day | 30 | 0 | Starter to Team | remaining 30, **charge 3000** |
| 7 | Change on the last day | 30 | 29 | Starter to Team | remaining 1, credit 66, cost 166, **charge 100** |
| 8 | Two changes in one period (8a then 8b) | 30 | 10 then 20 | 8a Starter to Team. 8b Team 15 to 20 seats (5000 to 6500) | 8a **2000**. 8b remaining 10, credit 1666, cost 2166, **charge 500** |
| 9 | Upgrade, then downgrade in the same period (9a then 9b) | 30 | 10 then 20 | 9a Team to Business (5000 to 12000). 9b Business back to Team | 9a remaining 20, credit 3333, cost 8000, **charge 4667**. 9b **scheduled**, charge 0 |
| 10 | Immediate change cancels a pending downgrade (service-level test) | 30 | any | pending Team to Starter, then add 5 seats | pending change cleared, new change applied now |
| 11 | Business to Team | 30 | 5 | 12000 to 5000 | **scheduled**, charge 0 |
| 12 | Rounding: floor each part, then subtract | 30 | 23 | Team to Business, 5000 to 12000 | remaining 7, credit 1166, cost 2800, **charge 1634** (note: floor of the exact difference would be 1633, so this case pins the rule) |
| 13 | Different period lengths | 28 and 31 | 14 and 15 | Starter to Team | 28 days: remaining 14, credit 1000, cost 2500, **charge 1500**. 31 days: remaining 16, credit 1032, cost 2580, **charge 1548** |
| 14 | Invalid seats | 30 | any | Starter 6, Team 31, Business 101, any plan 0 seats | throws `SEATS_OUT_OF_RANGE` |

Case 2 answers the interview question: "Team customer adds 3 seats with 12 days left in a 30-day period" = **360 cents ($3.60)** when the team is already at 15 seats. (If the team had room inside the 15 included seats, the charge is 0.)

## Service layer around the pure function

`POST /teams/:teamId/billing/preview` calls `prorateChange` and returns the numbers. No side effects. No idempotency key needed.

`POST /teams/:teamId/billing/change` (needs `Idempotency-Key`):
1. Load the subscription `FOR UPDATE` in a transaction.
2. Check seats cannot drop below active members plus pending invites. Check plan cap.
3. Call `prorateChange`.
4. If `scheduled`: store `pending_plan` and `pending_seats`, write nothing to the ledger, return.
5. If `immediate` with `chargeCents > 0`: create a `payment_attempts` row (amount, currency, idempotency key), ask the provider for a hosted checkout, return the checkout URL. **The plan and seats change only after the verified webhook** writes the ledger charge and updates the subscription in one transaction.
6. If `immediate` with charge 0: write a zero-charge `adjustment` ledger row (reason `seat_change_no_charge`) and update the subscription now.
7. Always clear any older pending change when an immediate change is applied.

Renewal job (daily): for each subscription whose period ended, apply the pending change if present, then charge `monthly(plan, seats)` in full, write a ledger charge on success, start a new period (`period_start = old end`, `period_days` default 30).

## Never

- No floats. No `Math.round`. No decimals. No provider proration.
- No `new Date()` or `Date.now()` inside the function. Pass `now` in.
- No price numbers outside `plans.ts`.

## Explain-back questions for the human

1. Why do we floor the credit and the cost separately?
2. Why is a downgrade scheduled for the end of the period instead of refunded?
3. Walk through case 1 with a pencil and get 2000.
