/**
 * Plans and pricing configuration for Rota.
 * All monetary amounts are strictly in integer cents (USD minor units).
 * Source of truth: PRD.md Section 6.1, Rule 02, and skill proration-engine.
 */

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceCents: 2000,
    basePriceCents: 2000,
    includedSeats: 5,
    extraSeatCents: null as number | null,
    extraSeatPriceCents: 0,
    maxSeats: 5,
    seatCap: 5,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceCents: 5000,
    basePriceCents: 5000,
    includedSeats: 15,
    extraSeatCents: 300 as number | null,
    extraSeatPriceCents: 300,
    maxSeats: 30,
    seatCap: 30,
  },
  business: {
    id: 'business',
    name: 'Business',
    priceCents: 12000,
    basePriceCents: 12000,
    includedSeats: 40,
    extraSeatCents: 200 as number | null,
    extraSeatPriceCents: 200,
    maxSeats: 100,
    seatCap: 100,
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type PlanConfig = typeof PLANS[PlanId];
