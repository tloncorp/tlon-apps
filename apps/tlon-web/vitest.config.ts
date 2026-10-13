import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only rube unit tests — apps/tlon-web/e2e/*.spec.ts are Playwright
    // specs and must never be collected by vitest.
    // Root-level *.test.ts files are the build-plugin unit tests.
    // No passWithNoTests: this package owns these tests now, so a broken
    // include should fail CI rather than silently collecting nothing.
    include: ['rube/**/*.test.ts', '*.test.ts', 'src/**/*.test.ts'],
  },
});
