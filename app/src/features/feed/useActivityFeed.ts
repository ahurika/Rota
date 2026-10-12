import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { feedKeys } from '../../query/keys.js';

export interface ActivityEvent {
  id: string;
  team_id: string;
  type: string;
  actor_id: string;
  entity_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export interface ActivityFeedPage {
  items: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Activity feed infinite scroll query hook.
 * Uses keyset cursor pagination with 15s staleTime.
 */
export function useActivityFeed(teamId: string, limit = 20) {
  return useInfiniteQuery<ActivityFeedPage>({
    queryKey: feedKeys.all(teamId),
    queryFn: async ({ pageParam }) => {
      let endpoint = `/v1/teams/${teamId}/activity?limit=${limit}`;
      if (pageParam && typeof pageParam === 'string') {
        endpoint += `&cursor=${encodeURIComponent(pageParam)}`;
      }
      return api.get<ActivityFeedPage>(endpoint);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined),
    enabled: !!teamId,
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
