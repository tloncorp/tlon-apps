import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
    testTimeout: 30000, // 30s for network operations
  },
});
