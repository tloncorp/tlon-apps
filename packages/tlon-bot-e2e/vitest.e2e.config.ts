import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/tlon-bot-e2e-e2e',
  test: {
    environment: 'node',
    include: ['src/scenarios/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    sequence: {
      concurrent: false,
    },
  },
});
