import { config } from 'dotenv';
import { configDefaults, defineConfig } from 'vitest/config';

config();

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
