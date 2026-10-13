import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { shiftKeys } from '../../query/keys';

export interface Shift {
  id: string;
  team_id: string;
  assignee_id: string | null;
  starts_at: string;
  ends_at: string;
  label: string;
  note: string | null;
  swapStatus?: 'pending' | 'approved' | 'rejected' | null;
}

/**
 * Fetches shifts for a team.
 * Cache: 60s staleTime, 24h gcTime (persisted to AsyncStorage for offline view).
 */
export function useShifts(teamId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: from && to ? shiftKeys.range(teamId, from, to) : shiftKeys.all(teamId),
    queryFn: async () => {
      let endpoint = `/v1/teams/${teamId}/shifts`;
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const queryStr = params.toString();
      if (queryStr) endpoint += `?${queryStr}`;

      const res = await api.get<{ shifts: Shift[] }>(endpoint);
      return res.shifts;
    },
    enabled: !!teamId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Optimistic shift swap request mutation.
 * Instantly marks shift swapStatus as 'pending' with rollback on error (PRD FR-S6 & Rule 04).
 */
export function useRequestSwap(teamId: string, onErrorCallback?: (msg: string) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { shiftId: string; targetId?: string | null }) => {
      return api.post(`/v1/teams/${teamId}/swaps`, {
        shiftId: vars.shiftId,
        targetId: vars.targetId,
      });
    },

    // 1. Optimistic Update in onMutate
    onMutate: async ({ shiftId }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: shiftKeys.all(teamId) });

      // Snapshot current cache state across all shift queries for rollback
      const snapshot = qc.getQueriesData<Shift[]>({ queryKey: shiftKeys.all(teamId) });

      // Optimistically update all matching shift lists in query cache
      qc.setQueriesData<Shift[]>({ queryKey: shiftKeys.all(teamId) }, (old) => {
        if (!old) return old;
        return old.map((s) => (s.id === shiftId ? { ...s, swapStatus: 'pending' } : s));
      });

      return { snapshot };
    },

    // 2. Rollback upon error
    onError: (err: any, _vars, context) => {
      if (context?.snapshot) {
        context.snapshot.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
      if (onErrorCallback) {
        onErrorCallback(err.message || 'Swap request failed. Reverted.');
      }
    },

    // 3. Always refetch fresh server state after mutation resolves
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all(teamId) });
    },
  });
}
