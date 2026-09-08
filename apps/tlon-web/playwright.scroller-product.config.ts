import { defineConfig } from '@playwright/test';

import config from './playwright.scroller-warm.config';

/**
 * Actual conversation tests against verified, already-running local ships and
 * frontends. Detector calibration has separate configs and cannot pass here.
 */
export default defineConfig({
  ...config,
  // Debug recording runs during the test even when artifacts are retained only
  // on failure. Measurement runs keep explicit collectors and failure screenshots;
  // use Playwright's --trace override for a separate diagnostic run.
  use: {
    ...config.use,
    // Bound missing controls without inheriting a scenario's long capture budget.
    // Explicit operation timeouts and the 60s Home readiness checks still apply.
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    trace: 'off',
    video: 'off',
  },
  testMatch: [
    'scroller-stability.spec.ts',
    'scroller-reading-stability.spec.ts',
    'scroller-input-stability.spec.ts',
    'scroller-reference-stability.spec.ts',
    'scroller-concurrent-content.spec.ts',
    'scroller-keyboard-stability.spec.ts',
    'scroller-navigation-stability.spec.ts',
    'scroller-center-edit-stability.spec.ts',
    'scroller-pagination-stability.spec.ts',
  ],
  grepInvert: /Scroller detector self-tests/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: './test-results/scroller-product',
  reporter: [
    ['./e2e/helpers/scrollerAttemptClockReporter.cjs'],
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
          'test-results/scroller-product.json',
      },
    ],
  ],
  projects: config.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      channel: 'chromium',
      headless: process.env.SCROLLER_HEADED !== '1',
    },
  })),
});
