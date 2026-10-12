/**
 * Query Key Factories
 * Enforces uniform, type-safe query keys per feature (Rule 04).
 */

export const shiftKeys = {
  all: (teamId: string) => ['shifts', teamId] as const,
  upcoming: (teamId: string) => ['shifts', teamId, 'upcoming'] as const,
  range: (teamId: string, from: string, to: string) => ['shifts', teamId, 'range', from, to] as const,
  detail: (teamId: string, shiftId: string) => ['shifts', teamId, 'detail', shiftId] as const,
};

export const feedKeys = {
  all: (teamId: string) => ['feed', teamId] as const,
};

export const teamKeys = {
  all: () => ['teams'] as const,
  detail: (teamId: string) => ['teams', teamId] as const,
  roster: (teamId: string) => ['roster', teamId] as const,
};

export const settingsKeys = {
  user: () => ['settings'] as const,
};

export const billingKeys = {
  status: (teamId: string) => ['billing', teamId] as const,
};
