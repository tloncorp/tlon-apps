import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only — apps/tlon-web/e2e/*.spec.ts are Playwright specs
    // and must never be collected by vitest, which is why this is an
    // explicit `.test.ts` include rather than a directory sweep.
    // No passWithNoTests: this package owns these tests now, so a broken
    // include should fail CI rather than silently collecting nothing.
    include: ['rube/**/*.test.ts', 'src/**/*.test.ts', '*.test.ts'],
  },
});
