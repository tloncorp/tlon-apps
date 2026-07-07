import { config } from 'dotenv';
import { configDefaults, defineConfig } from 'vitest/config';

// Load .env file
config();

// Unit tests only. The Docker-based integration suite under test/ runs via
// vitest.integration.config.ts; restricting include here keeps the monorepo's
// recursive test sweep (`pnpm run -r test`) from ever picking up test/cases.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { shuffle: false },
    pool: 'forks',
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '**/.pnpm-store/**'],
  },
});
