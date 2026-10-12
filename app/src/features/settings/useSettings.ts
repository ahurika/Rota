import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { settingsKeys } from '../../query/keys.js';

export interface UserSettings {
  userId: string;
  quietStart: string;
  quietEnd: string;
  timezone: string;
  notifTypes: {
    shift_changes: boolean;
    swaps: boolean;
    billing: boolean;
  };
  language: string;
  theme: 'system' | 'light' | 'dark';
  updatedAt: {
    quietStart: string;
    quietEnd: string;
    timezone: string;
    notifTypes: string;
    language: string;
    theme: string;
  };
}

export interface PatchSettingsPayload {
  quietStart?: string;
  quietEnd?: string;
  timezone?: string;
  notifTypes?: {
    shift_changes?: boolean;
    swaps?: boolean;
    billing?: boolean;
  };
  language?: string;
  theme?: 'system' | 'light' | 'dark';
}

/**
 * Loads user settings with staleTime: 0 for immediate freshness on launch and foreground.
 */
export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: settingsKeys.user(),
    queryFn: async () => {
      const res = await apiClient.get<{ settings: UserSettings }>('/v1/settings');
      return res.settings;
    },
    staleTime: 0,
  });
}

/**
 * Optimistic update with automatic rollback on server error (FR-ST4).
 */
export function useUpdateSettings(options?: {
  onError?: (err: any, patch: PatchSettingsPayload, previous?: UserSettings) => void;
  onSuccess?: (data: UserSettings) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: PatchSettingsPayload) => {
      const res = await apiClient.patch<{ settings: UserSettings }>('/v1/settings', patch);
      return res.settings;
    },
    onMutate: async (patch: PatchSettingsPayload) => {
      // 1. Cancel outgoing queries to avoid overwriting optimistic state
      await queryClient.cancelQueries({ queryKey: settingsKeys.user() });

      // 2. Snapshot current settings
      const previous = queryClient.getQueryData<UserSettings>(settingsKeys.user());

      // 3. Optimistically merge new values into cache
      if (previous) {
        queryClient.setQueryData<UserSettings>(settingsKeys.user(), {
          ...previous,
          ...patch,
          notifTypes: {
            ...previous.notifTypes,
            ...(patch.notifTypes ?? {}),
          },
        });
      }

      return { previous };
    },
    onError: (err, patch, context) => {
      // Rollback to previous state on failure
      if (context?.previous) {
        queryClient.setQueryData(settingsKeys.user(), context.previous);
      }
      options?.onError?.(err, patch, context?.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.user(), data);
      options?.onSuccess?.(data);
    },
    onSettled: () => {
      // Refetch to ensure absolute sync with server timestamps
      queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
    },
  });
}
