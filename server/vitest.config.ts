import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 8000,
    hookTimeout: 8000,
  },
});
