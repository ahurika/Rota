import { PLANS, PlanId } from '../../config/plans.js';

const DAY_MS = 86_400_000;

export class DomainError extends Error {
  public readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function monthlyCents(plan: PlanId, seats: number): number {
  const p = PLANS[plan];
  if (!p) {
    throw new DomainError('INVALID_PLAN');
  }
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
  | {
      kind: 'immediate';
      chargeCents: number;
      creditCents: number;
      costCents: number;
      remainingDays: number;
    }
  | {
      kind: 'scheduled';
      chargeCents: 0;
      effectiveAt: Date;
    };

export function prorateChange(input: {
  oldPlan: PlanId;
  oldSeats: number;
  newPlan: PlanId;
  newSeats: number;
  periodStart: Date;
  periodDays: number;
  now: Date;
}): ProrationResult {
  const oldM = monthlyCents(input.oldPlan, input.oldSeats);
  const newM = monthlyCents(input.newPlan, input.newSeats);

  if (newM < oldM) {
    return {
      kind: 'scheduled',
      chargeCents: 0,
      effectiveAt: new Date(input.periodStart.getTime() + input.periodDays * DAY_MS),
    };
  }

  const r = remainingDays(input.periodStart, input.now, input.periodDays);
  const creditCents = Math.floor((oldM * r) / input.periodDays);
  const costCents = Math.floor((newM * r) / input.periodDays);

  return {
    kind: 'immediate',
    chargeCents: costCents - creditCents,
    creditCents,
    costCents,
    remainingDays: r,
  };
}
