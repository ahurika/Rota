import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'rota_access_token';
const REFRESH_TOKEN_KEY = 'rota_refresh_token';

// In-memory fallback for testing environments (Node.js/Vitest)
const memoryStorage = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
      return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    }
    return memoryStorage.get(ACCESS_TOKEN_KEY) ?? null;
  },

  async setAccessToken(token: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    } else {
      memoryStorage.set(ACCESS_TOKEN_KEY, token);
    }
  },

  async getRefreshToken(): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
      return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
    return memoryStorage.get(REFRESH_TOKEN_KEY) ?? null;
  },

  async setRefreshToken(token: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      memoryStorage.set(REFRESH_TOKEN_KEY, token);
    }
  },

  async clearTokens(): Promise<void> {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } else {
      memoryStorage.delete(ACCESS_TOKEN_KEY);
      memoryStorage.delete(REFRESH_TOKEN_KEY);
    }
  },
};
