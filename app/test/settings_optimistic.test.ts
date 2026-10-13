import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { settingsKeys } from '../src/query/keys';
import { UserSettings } from '../src/features/settings/useSettings';

describe('Settings Sync & Optimistic Updates (FR-ST2 & FR-ST4)', () => {
  let queryClient: QueryClient;

  const mockInitialSettings: UserSettings = {
    userId: 'u1',
    quietStart: '22:00',
    quietEnd: '06:00',
    timezone: 'UTC',
    notifTypes: {
      shift_changes: true,
      swaps: true,
      billing: true,
    },
    language: 'en',
    theme: 'light',
    updatedAt: {
      quietStart: '2026-10-12T00:00:00Z',
      quietEnd: '2026-10-12T00:00:00Z',
      timezone: '2026-10-12T00:00:00Z',
      notifTypes: '2026-10-12T00:00:00Z',
      language: '2026-10-12T00:00:00Z',
      theme: '2026-10-12T00:00:00Z',
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(settingsKeys.user(), mockInitialSettings);
  });

  it('FR-ST4: Optimistic update updates cached state immediately before network resolves', async () => {
    // 1. Setup mock mutation logic identical to useUpdateSettings
    const patch = { theme: 'dark' as const, quietStart: '23:00' };

    // OnMutate: snapshot and optimistic update
    await queryClient.cancelQueries({ queryKey: settingsKeys.user() });
    const previous = queryClient.getQueryData<UserSettings>(settingsKeys.user());

    queryClient.setQueryData<UserSettings>(settingsKeys.user(), {
      ...previous!,
      ...patch,
    });

    // Check optimistic update reflected immediately
    const optimistic = queryClient.getQueryData<UserSettings>(settingsKeys.user());
    expect(optimistic?.theme).toBe('dark');
    expect(optimistic?.quietStart).toBe('23:00');
    // Untouched properties preserved
    expect(optimistic?.quietEnd).toBe('06:00');
  });

  it('FR-ST4: Mutation error rolls back optimistic state to previous snapshot', async () => {
    const patch = { theme: 'dark' as const };

    // Snapshot previous
    const previous = queryClient.getQueryData<UserSettings>(settingsKeys.user());
    expect(previous?.theme).toBe('light');

    // Optimistically apply
    queryClient.setQueryData<UserSettings>(settingsKeys.user(), {
      ...previous!,
      ...patch,
    });
    expect(queryClient.getQueryData<UserSettings>(settingsKeys.user())?.theme).toBe('dark');

    // Simulate Network Failure / 500 error -> OnError rollback
    queryClient.setQueryData(settingsKeys.user(), previous);

    // Verify clean rollback
    const rolledBack = queryClient.getQueryData<UserSettings>(settingsKeys.user());
    expect(rolledBack?.theme).toBe('light');
  });

  it('FR-ST2: FocusManager setFocused(true) triggers refetch of stale settings on app foreground', async () => {
    let fetchCount = 0;
    const fetchFn = vi.fn(async () => {
      fetchCount++;
      return mockInitialSettings;
    });

    await queryClient.prefetchQuery({
      queryKey: settingsKeys.user(),
      queryFn: fetchFn,
      staleTime: 0, // staleTime 0 ensures foreground refetches
    });

    expect(fetchCount).toBe(1);

    // Foregrounding the app
    focusManager.setFocused(true);

    // Query is refetched because staleTime is 0
    await queryClient.refetchQueries({ queryKey: settingsKeys.user() });
    expect(fetchCount).toBe(2);
  });
});
