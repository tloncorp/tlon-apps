import { config } from 'dotenv';
import { configDefaults, defineConfig } from 'vitest/config';

// Load .env file
config();

// Integration suite config: test/cases/* prompt a live bot against ephemeral
// fakezod ships (see test/run.sh), so timeouts are generous and files run
// sequentially to avoid overlapping DM prompts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { shuffle: false },
    pool: 'forks',
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '**/.pnpm-store/**'],
  },
});
