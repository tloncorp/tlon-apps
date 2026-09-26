import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['lab/src/**/*.test.ts'] },
});
