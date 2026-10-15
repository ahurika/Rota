import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useUiStore } from '../../state/uiStore';

export interface TeamSummary {
  id: string;
  name: string;
  owner_id?: string;
  created_at?: string;
}

export function useActiveTeam() {
  const currentTeamId = useUiStore((s) => s.currentTeamId);
  const setCurrentTeamId = useUiStore((s) => s.setCurrentTeamId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-teams'],
    queryFn: async () => {
      const res = await apiClient.get<{ teams: TeamSummary[] }>('/v1/teams');
      return res.teams ?? [];
    },
    staleTime: 60 * 1000,
  });

  const teams = data ?? [];

  useEffect(() => {
    if (teams.length > 0) {
      const exists = teams.some((t) => t.id === currentTeamId);
      if (!currentTeamId || !exists) {
        setCurrentTeamId(teams[0].id);
      }
    }
  }, [teams, currentTeamId, setCurrentTeamId]);

  const activeTeam = teams.find((t) => t.id === currentTeamId) ?? (teams.length > 0 ? teams[0] : null);

  return {
    currentTeamId: activeTeam?.id ?? currentTeamId ?? '859a9351-a67e-4a0b-9ab4-c25ac5ef9d95',
    activeTeam,
    teams,
    isLoading,
    refetchTeams: refetch,
  };
}
