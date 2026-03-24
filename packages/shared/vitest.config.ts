import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.sql'],
  resolve: {
    conditions: ['source'],
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
});
