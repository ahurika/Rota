import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'test/mocks/asyncStorage.ts'),
      '@react-native-community/netinfo': path.resolve(__dirname, 'test/mocks/netinfo.ts'),
      'expo-secure-store': path.resolve(__dirname, 'test/mocks/secureStore.ts'),
    },
  },
});
