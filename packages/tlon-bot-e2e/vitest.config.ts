import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/tlon-bot-e2e',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: [
      ...configDefaults.exclude,
      '**/.pnpm-store/**',
      'src/scenarios/**/*.test.ts',
    ],
  },
});
