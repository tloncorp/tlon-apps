import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.sql'],
  resolve: {
    conditions: ['tlon-source'],
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
});
