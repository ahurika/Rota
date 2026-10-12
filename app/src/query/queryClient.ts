import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

// 1. Initialize TanStack onlineManager with NetInfo
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

// 2. Query Client with standard caching policies
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds default
      gcTime: 24 * 60 * 60 * 1000, // 24 hours (must be >= maxAge for persistence)
      retry: 2,
    },
  },
});

// 3. AsyncStorage persister for offline support (cache version 1)
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rota-cache-v1',
});

// 4. Persistence configuration: only persist shifts and roster (Rule 04)
export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  dehydrateOptions: {
    shouldDehydrateQuery: (query: any) => {
      const isSuccess = query.state.status === 'success';
      const rootKey = String(query.queryKey[0]);
      // Strictly whitelist shifts and roster for offline persistence
      return isSuccess && ['shifts', 'roster'].includes(rootKey);
    },
  },
};

/**
 * Resets query cache and offline storage on logout
 */
export async function clearQueryCacheOnLogout(): Promise<void> {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {}
}
