import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.sql'],
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
});
