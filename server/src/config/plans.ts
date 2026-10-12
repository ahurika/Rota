/**
 * Plans and pricing configuration for Rota.
 * All monetary amounts are strictly in integer cents (USD minor units).
 * Source of truth: PRD.md Section 6.1 and Rule 02.
 */

export interface PlanConfig {
  id: 'starter' | 'team' | 'business';
  name: string;
  basePriceCents: number;
  includedSeats: number;
  extraSeatPriceCents: number;
  seatCap: number;
}

export const PLANS: Record<'starter' | 'team' | 'business', PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    basePriceCents: 2000,
    includedSeats: 5,
    extraSeatPriceCents: 0,
    seatCap: 5,
  },
  team: {
    id: 'team',
    name: 'Team',
    basePriceCents: 5000,
    includedSeats: 15,
    extraSeatPriceCents: 300,
    seatCap: 30,
  },
  business: {
    id: 'business',
    name: 'Business',
    basePriceCents: 12000,
    includedSeats: 40,
    extraSeatPriceCents: 200,
    seatCap: 100,
  },
} as const;

export type PlanId = keyof typeof PLANS;
