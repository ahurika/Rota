import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export type PlanId = 'starter' | 'team' | 'business';

export interface SubscriptionInfo {
  team_id: string;
  plan: PlanId;
  seats: number;
  period_start: string;
  period_days: number;
  status: 'trialing' | 'active' | 'past_due' | 'restricted';
  grace_ends_at: string | null;
  pending_plan: PlanId | null;
  pending_seats: number | null;
  updated_at: string;
}

export interface ProrationBreakdown {
  currentPlan: PlanId;
  currentSeats: number;
  newPlan: PlanId;
  newSeats: number;
  proration: {
    kind: 'immediate' | 'scheduled';
    chargeCents: number;
    creditCents?: number;
    costCents?: number;
    remainingDays?: number;
    effectiveAt?: string;
  };
}

export function useBilling(teamId: string) {
  return useQuery({
    queryKey: ['billing', teamId],
    queryFn: async () => {
      const res = await apiClient.get<{ subscription: SubscriptionInfo }>(`/v1/teams/${teamId}/billing`);
      return res.subscription;
    },
    enabled: Boolean(teamId),
    staleTime: 30 * 1000,
  });
}

export function useProrationPreview(teamId: string) {
  return useMutation({
    mutationFn: async (vars: { plan: PlanId; seats: number }) => {
      return apiClient.post<ProrationBreakdown>(`/v1/teams/${teamId}/billing/preview`, vars);
    },
  });
}

export function useChangeSubscription(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { plan: PlanId; seats: number; simulatePayment?: boolean }) => {
      const idempotencyKey = `sub_change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return apiClient.post<any>(
        `/v1/teams/${teamId}/billing/change`,
        { ...vars, simulatePayment: vars.simulatePayment ?? true },
        { 'Idempotency-Key': idempotencyKey }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', teamId] });
      queryClient.invalidateQueries({ queryKey: ['user-teams'] });
    },
  });
}
