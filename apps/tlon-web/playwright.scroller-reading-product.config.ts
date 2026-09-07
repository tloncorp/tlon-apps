import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-warm.config';

/** Actual ChatMessage rendering on the root-verified local application. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-reading-stability.spec.ts',
  retries: 0,
  reporter: [
    ['./e2e/helpers/scrollerAttemptClockReporter.cjs'],
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
          'test-results/scroller-reading-product.json',
      },
    ],
  ],
  projects: config.projects?.map((project) => ({
    ...project,
    use: { ...project.use, channel: 'chromium', headless: false },
  })),
});
