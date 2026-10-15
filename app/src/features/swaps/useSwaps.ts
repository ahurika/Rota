import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export interface SwapItem {
  id: string;
  team_id: string;
  shift_id: string;
  requester_id: string;
  requester_email: string;
  target_id: string | null;
  target_email: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  shift_label: string;
  shift_starts_at: string;
  shift_ends_at: string;
  shift_assignee_id: string | null;
}

export function useSwaps(teamId: string, status?: 'pending' | 'approved' | 'rejected' | 'all') {
  return useQuery({
    queryKey: ['swaps', teamId, status || 'all'],
    queryFn: async () => {
      const q = status && status !== 'all' ? `?status=${status}` : '';
      const res = await apiClient.get<{ swaps: SwapItem[] }>(`/v1/teams/${teamId}/swaps${q}`);
      return res.swaps;
    },
    enabled: Boolean(teamId),
  });
}

export function useDecideSwap(teamId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ swapId, status }: { swapId: string; status: 'approved' | 'rejected' }) => {
      const res = await apiClient.post<{ swap: SwapItem }>(`/v1/teams/${teamId}/swaps/${swapId}/decision`, {
        status,
      });
      return res.swap;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swaps', teamId] });
      qc.invalidateQueries({ queryKey: ['shifts', teamId] });
      qc.invalidateQueries({ queryKey: ['feed', teamId] });
    },
  });
}
