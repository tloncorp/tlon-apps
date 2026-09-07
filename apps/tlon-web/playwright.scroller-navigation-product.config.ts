import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-reading-product.config';

/** Actual application navigation; separate from synthetic detector controls. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-navigation-stability.spec.ts',
  retries: 0,
  outputDir:
    process.env.SCROLLER_NAVIGATION_OUTPUT_DIR ??
    './test-results/scroller-navigation-product',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
          'test-results/scroller-navigation-product.json',
      },
    ],
  ],
});
