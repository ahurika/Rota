import { describe, it, expect } from 'vitest';
import {
  prorateChange,
  monthlyCents,
  DomainError,
  remainingDays,
} from '../../src/services/billing/proration.js';

describe('Proof Test T3: Proration Engine 14 Test Cases', () => {
  const DAY_MS = 86_400_000;
  const periodStart = new Date('2026-10-01T00:00:00.000Z');

  // Helper to create date after elapsed whole days
  const dateAfterDays = (start: Date, days: number) => new Date(start.getTime() + days * DAY_MS);

  // Case 1: Starter(5) to Team(5) at day 10
  it('Case 1: Starter(5) to Team(5) with 20 days left produces charge 2000 cents', () => {
    const res = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 5,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(20);
      expect(res.creditCents).toBe(1333);
      expect(res.costCents).toBe(3333);
      expect(res.chargeCents).toBe(2000);
    }
  });

  // Case 2: Team at 15 seats adds 3 seats (18 seats) at day 18
  it('Case 2: Team(15) adds 3 seats with 12 days left produces charge 360 cents ($3.60)', () => {
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 15,
      newPlan: 'team',
      newSeats: 18,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 18),
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(12);
      expect(res.creditCents).toBe(2000);
      expect(res.costCents).toBe(2360);
      expect(res.chargeCents).toBe(360);
    }
  });

  // Case 3: Team(5) to Starter(5) downgrade
  it('Case 3: Team(5) to Starter(5) downgrade is scheduled for end of period with charge 0', () => {
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 5,
      newPlan: 'starter',
      newSeats: 5,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });

    expect(res.kind).toBe('scheduled');
    expect(res.chargeCents).toBe(0);
    if (res.kind === 'scheduled') {
      expect(res.effectiveAt).toEqual(dateAfterDays(periodStart, 30));
    }
  });

  // Case 4: Team 10 to 14 seats (within 15 included seats)
  it('Case 4: Team 10 to 14 seats inside included seats produces immediate charge 0', () => {
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 10,
      newPlan: 'team',
      newSeats: 14,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.creditCents).toBe(3333);
      expect(res.costCents).toBe(3333);
      expect(res.chargeCents).toBe(0);
    }
  });

  // Case 5: Team 20 to 17 seats (removing extra seats)
  it('Case 5: Team 20 to 17 seats is scheduled with charge 0', () => {
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 20,
      newPlan: 'team',
      newSeats: 17,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });

    expect(res.kind).toBe('scheduled');
    expect(res.chargeCents).toBe(0);
  });

  // Case 6: Change on the first day (elapsed 0)
  it('Case 6: Starter to Team on the first day charges full difference of 3000 cents', () => {
    const res = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 30,
      now: periodStart,
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(30);
      expect(res.creditCents).toBe(2000);
      expect(res.costCents).toBe(5000);
      expect(res.chargeCents).toBe(3000);
    }
  });

  // Case 7: Change on the last day (elapsed 29)
  it('Case 7: Starter to Team on the last day charges 1 day difference of 100 cents', () => {
    const res = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 29),
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(1);
      expect(res.creditCents).toBe(66);
      expect(res.costCents).toBe(166);
      expect(res.chargeCents).toBe(100);
    }
  });

  // Case 8: Two changes in one period (8a then 8b)
  it('Case 8: Two sequential upgrades in one period (8a charge 2000, 8b charge 500)', () => {
    // 8a: Starter(5) to Team(15) at day 10
    const resA = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });
    expect(resA.kind).toBe('immediate');
    expect((resA as any).chargeCents).toBe(2000);

    // 8b: Team(15) to Team(20) at day 20
    const resB = prorateChange({
      oldPlan: 'team',
      oldSeats: 15,
      newPlan: 'team',
      newSeats: 20,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 20),
    });
    expect(resB.kind).toBe('immediate');
    if (resB.kind === 'immediate') {
      expect(resB.remainingDays).toBe(10);
      expect(resB.creditCents).toBe(1666);
      expect(resB.costCents).toBe(2166);
      expect(resB.chargeCents).toBe(500);
    }
  });

  // Case 9: Upgrade then downgrade in the same period
  it('Case 9: Upgrade at day 10 charges 4667, then downgrade at day 20 schedules charge 0', () => {
    // 9a: Team(15) to Business(40) at day 10
    const resA = prorateChange({
      oldPlan: 'team',
      oldSeats: 15,
      newPlan: 'business',
      newSeats: 40,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 10),
    });
    expect(resA.kind).toBe('immediate');
    if (resA.kind === 'immediate') {
      expect(resA.remainingDays).toBe(20);
      expect(resA.creditCents).toBe(3333);
      expect(resA.costCents).toBe(8000);
      expect(resA.chargeCents).toBe(4667);
    }

    // 9b: Business(40) back to Team(15) at day 20
    const resB = prorateChange({
      oldPlan: 'business',
      oldSeats: 40,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 20),
    });
    expect(resB.kind).toBe('scheduled');
    expect(resB.chargeCents).toBe(0);
  });

  // Case 10: Pure calculation for immediate change that overrides previous tier
  it('Case 10: Upgrade calculation is deterministic when moving from team to extra seats', () => {
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 15,
      newPlan: 'team',
      newSeats: 20,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 15),
    });
    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(15);
      expect(res.chargeCents).toBe(750); // (6500*15/30) - (5000*15/30) = 3250 - 2500 = 750
    }
  });

  // Case 11: Business to Team downgrade
  it('Case 11: Business(40) to Team(15) downgrade at day 5 is scheduled with charge 0', () => {
    const res = prorateChange({
      oldPlan: 'business',
      oldSeats: 40,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 5),
    });
    expect(res.kind).toBe('scheduled');
    expect(res.chargeCents).toBe(0);
  });

  // Case 12: Rounding rule verification (floor each part, then subtract)
  it('Case 12: Floor each part separately pins exact rounding rule to 1634 cents (not 1633)', () => {
    // Team(15) [5000] to Business(40) [12000] at day 23 with 7 days left:
    // oldPart = floor(5000 * 7 / 30) = floor(1166.666) = 1166
    // newPart = floor(12000 * 7 / 30) = floor(2800.0) = 2800
    // charge = 2800 - 1166 = 1634 (Notice: floor of difference 7000 * 7 / 30 = 1633.33 => 1633)
    const res = prorateChange({
      oldPlan: 'team',
      oldSeats: 15,
      newPlan: 'business',
      newSeats: 40,
      periodStart,
      periodDays: 30,
      now: dateAfterDays(periodStart, 23),
    });

    expect(res.kind).toBe('immediate');
    if (res.kind === 'immediate') {
      expect(res.remainingDays).toBe(7);
      expect(res.creditCents).toBe(1166);
      expect(res.costCents).toBe(2800);
      expect(res.chargeCents).toBe(1634); // Exactly 1634!
    }
  });

  // Case 13: Non-standard billing period lengths (28 days and 31 days)
  it('Case 13: Accurately prorates across non-30-day periods (28 days -> 1500, 31 days -> 1548)', () => {
    // 28-day period: 14 days elapsed, 14 days remaining
    const res28 = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 28,
      now: dateAfterDays(periodStart, 14),
    });
    expect(res28.kind).toBe('immediate');
    if (res28.kind === 'immediate') {
      expect(res28.remainingDays).toBe(14);
      expect(res28.creditCents).toBe(1000);
      expect(res28.costCents).toBe(2500);
      expect(res28.chargeCents).toBe(1500);
    }

    // 31-day period: 15 days elapsed, 16 days remaining
    const res31 = prorateChange({
      oldPlan: 'starter',
      oldSeats: 5,
      newPlan: 'team',
      newSeats: 15,
      periodStart,
      periodDays: 31,
      now: dateAfterDays(periodStart, 15),
    });
    expect(res31.kind).toBe('immediate');
    if (res31.kind === 'immediate') {
      expect(res31.remainingDays).toBe(16);
      expect(res31.creditCents).toBe(1032);
      expect(res31.costCents).toBe(2580);
      expect(res31.chargeCents).toBe(1548);
    }
  });

  // Case 14: Invalid seat counts throw SEATS_OUT_OF_RANGE
  it('Case 14: Rejects seats exceeding plan caps or below 1 with SEATS_OUT_OF_RANGE', () => {
    expect(() => monthlyCents('starter', 6)).toThrowError(DomainError);
    expect(() => monthlyCents('starter', 6)).toThrowError('SEATS_OUT_OF_RANGE');

    expect(() => monthlyCents('team', 31)).toThrowError('SEATS_OUT_OF_RANGE');
    expect(() => monthlyCents('business', 101)).toThrowError('SEATS_OUT_OF_RANGE');
    expect(() => monthlyCents('team', 0)).toThrowError('SEATS_OUT_OF_RANGE');
    expect(() => monthlyCents('starter', -1)).toThrowError('SEATS_OUT_OF_RANGE');
    expect(() => monthlyCents('team', 2.5)).toThrowError('SEATS_OUT_OF_RANGE');
  });
});
