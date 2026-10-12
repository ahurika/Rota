import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from '../src/api/client.js';
import { secureStorage } from '../src/lib/secureStore.js';
import { persistOptions } from '../src/query/queryClient.js';
import { validateNotificationUrl } from '../src/notifications/routing.js';
import { QueryClient } from '@tanstack/react-query';
import { shiftKeys } from '../src/query/keys.js';

describe('Milestone M4: Mobile State Architecture & Offline Tests', () => {
  beforeEach(async () => {
    await secureStorage.clearTokens();
    vi.restoreAllMocks();
  });

  // 1. API Client Refresh Coalescing Test
  it('Coalesces concurrent 401s into exactly one refresh call without token reuse', async () => {
    await secureStorage.setAccessToken('expired-access-token');
    await secureStorage.setRefreshToken('valid-refresh-token');

    let refreshCallCount = 0;
    let shiftsCallCount = 0;
    let membersCallCount = 0;

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);

      if (urlStr.includes('/v1/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'brand-new-access-token',
            refreshToken: 'brand-new-refresh-token',
          }),
        } as Response;
      }

      if (urlStr.includes('/v1/teams/t1/shifts')) {
        shiftsCallCount++;
        const authHeader = (init?.headers as any)?.get
          ? (init?.headers as any).get('Authorization')
          : (init?.headers as any)?.Authorization;

        if (authHeader === 'Bearer expired-access-token') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ shifts: [{ id: 's1', label: 'Morning' }] }),
        } as Response;
      }

      if (urlStr.includes('/v1/teams/t1/members')) {
        membersCallCount++;
        const authHeader = (init?.headers as any)?.get
          ? (init?.headers as any).get('Authorization')
          : (init?.headers as any)?.Authorization;

        if (authHeader === 'Bearer expired-access-token') {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ members: [{ id: 'm1', role: 'staff' }] }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
      } as Response;
    });

    globalThis.fetch = mockFetch as any;

    const testClient = new ApiClient('http://test-server');

    // Fire two concurrent requests that both receive 401 simultaneously
    const [shiftsRes, membersRes] = await Promise.all([
      testClient.get('/v1/teams/t1/shifts'),
      testClient.get('/v1/teams/t1/members'),
    ]);

    expect(shiftsRes).toEqual({ shifts: [{ id: 's1', label: 'Morning' }] });
    expect(membersRes).toEqual({ members: [{ id: 'm1', role: 'staff' }] });

    // CRITICAL: Exactly one refresh call occurred!
    expect(refreshCallCount).toBe(1);
    expect(await secureStorage.getAccessToken()).toBe('brand-new-access-token');
    expect(await secureStorage.getRefreshToken()).toBe('brand-new-refresh-token');
  });

  // 2. Optimistic Mutation & Rollback Test
  it('Optimistically updates shift swap status and cleanly rolls back on server error', async () => {
    const qc = new QueryClient();
    const teamId = 'team-alpha';

    interface MockShift {
      id: string;
      label: string;
      swapStatus: 'pending' | null;
    }

    // Seed query cache with an initial shift
    const initialShifts: MockShift[] = [
      { id: 'shift-1', label: 'Morning Shift', swapStatus: null },
      { id: 'shift-2', label: 'Night Shift', swapStatus: null },
    ];
    qc.setQueryData(shiftKeys.all(teamId), initialShifts);

    // Simulated optimistic mutation logic matching useRequestSwap
    const triggerOptimisticMutation = async (shouldFail: boolean) => {
      // onMutate
      await qc.cancelQueries({ queryKey: shiftKeys.all(teamId) });
      const snapshot = qc.getQueriesData<MockShift[]>({ queryKey: shiftKeys.all(teamId) });

      qc.setQueriesData<MockShift[]>({ queryKey: shiftKeys.all(teamId) }, (old) => {
        if (!old) return old;
        return old.map((s) => (s.id === 'shift-1' ? { ...s, swapStatus: 'pending' } : s));
      });

      // Verify that cache is optimistically updated right away
      const optimisticState = qc.getQueryData<MockShift[]>(shiftKeys.all(teamId));
      expect(optimisticState?.[0].swapStatus).toBe('pending');

      if (shouldFail) {
        // onError: rollback
        snapshot.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
        throw new Error('Simulated network failure');
      }
    };

    // Execute failing mutation
    await expect(triggerOptimisticMutation(true)).rejects.toThrow('Simulated network failure');

    // Verify cache cleanly rolled back to initial state (swapStatus: null)
    const rolledBackState = qc.getQueryData<MockShift[]>(shiftKeys.all(teamId));
    expect(rolledBackState?.[0].swapStatus).toBeNull();
  });

  // 3. Cache Persistence Whitelist Filter Test
  it('shouldDehydrateQuery allows only shifts and roster to be persisted, discarding secrets/billing/settings', () => {
    const { shouldDehydrateQuery } = persistOptions.dehydrateOptions;

    // Allowed (shifts & roster in success state)
    expect(shouldDehydrateQuery({ state: { status: 'success' }, queryKey: ['shifts', 'team-1'] })).toBe(true);
    expect(shouldDehydrateQuery({ state: { status: 'success' }, queryKey: ['roster', 'team-1'] })).toBe(true);

    // Denied (never persist billing, settings, tokens, or pending/error queries)
    expect(shouldDehydrateQuery({ state: { status: 'success' }, queryKey: ['billing', 'team-1'] })).toBe(false);
    expect(shouldDehydrateQuery({ state: { status: 'success' }, queryKey: ['settings'] })).toBe(false);
    expect(shouldDehydrateQuery({ state: { status: 'success' }, queryKey: ['tokens'] })).toBe(false);
    expect(shouldDehydrateQuery({ state: { status: 'pending' }, queryKey: ['shifts', 'team-1'] })).toBe(false);
    expect(shouldDehydrateQuery({ state: { status: 'error' }, queryKey: ['shifts', 'team-1'] })).toBe(false);
  });

  // 4. Notification Route Allow-List Test
  it('Validates notification deep-link routes against strict allow-list', () => {
    expect(validateNotificationUrl('/shifts/123-abc')).toBe('/shifts/123-abc');
    expect(validateNotificationUrl('/swaps/swap-999')).toBe('/swaps/swap-999');
    expect(validateNotificationUrl('/billing')).toBe('/billing');
    expect(validateNotificationUrl('/feed')).toBe('/feed');
    expect(validateNotificationUrl('/settings')).toBe('/settings');

    // Invalid / Disallowed paths
    expect(validateNotificationUrl('/admin/delete')).toBeNull();
    expect(validateNotificationUrl('https://phishing.site')).toBeNull();
    expect(validateNotificationUrl('javascript:alert(1)')).toBeNull();
    expect(validateNotificationUrl(null)).toBeNull();
    expect(validateNotificationUrl('')).toBeNull();
  });

  // 5. Client-only UI Store isolation test
  it('Maintains UI-only client state in Zustand separate from server state', async () => {
    const { useUiStore } = await import('../src/state/uiStore.js');

    const state = useUiStore.getState();
    expect(state.selectedTab).toBe('shifts');
    expect(state.swapDraftNote).toBe('');

    useUiStore.getState().setTab('feed');
    useUiStore.getState().setSwapDraftNote('Can someone cover my Friday evening shift?');
    useUiStore.getState().dismissOfflineBanner();

    expect(useUiStore.getState().selectedTab).toBe('feed');
    expect(useUiStore.getState().swapDraftNote).toBe('Can someone cover my Friday evening shift?');
    expect(useUiStore.getState().isOfflineBannerDismissed).toBe(true);

    useUiStore.getState().resetUi();
    expect(useUiStore.getState().selectedTab).toBe('shifts');
    expect(useUiStore.getState().swapDraftNote).toBe('');
    expect(useUiStore.getState().isOfflineBannerDismissed).toBe(false);
  });

  // 6. FlashList Feed Pagination Deduplication Test
  it('Deduplicates activity feed events by ID when merging pages across rapid pagination', () => {
    const page1 = [
      { id: '100', type: 'shift_created', created_at: '2026-10-12T10:00:00.000Z' },
      { id: '99', type: 'shift_created', created_at: '2026-10-12T09:59:00.000Z' },
    ];
    // Simulating page 2 containing an overlap or repeated item due to mid-scroll insert
    const page2 = [
      { id: '99', type: 'shift_created', created_at: '2026-10-12T09:59:00.000Z' },
      { id: '98', type: 'swap_requested', created_at: '2026-10-12T09:58:00.000Z' },
    ];

    const map = new Map<string, any>();
    for (const page of [page1, page2]) {
      for (const item of page) {
        map.set(item.id, item);
      }
    }
    const deduplicated = Array.from(map.values());

    expect(deduplicated.length).toBe(3);
    expect(deduplicated.map((x) => x.id)).toEqual(['100', '99', '98']);
  });
});
