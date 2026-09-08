import { defineConfig, devices } from '@playwright/test';

// Self-contained desktop detector controls: no app server, ships or auth setup.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'scroller-reading-detectors.spec.ts',
  timeout: 20_000,
  retries: 0,
  workers: 1,
  forbidOnly: true,
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    headless: process.env.SCROLLER_HEADED !== '1',
    viewport: { width: 1280, height: 800 },
    // Visible runs are opt-in so worker restarts do not interrupt desktop work.
    // Cadence checks remain strict in either mode; a headless pass does not
    // replace visible-rendering or presentation evidence.
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium' }],
  outputDir:
    process.env.SCROLLER_READING_OUTPUT_DIR ??
    './test-results/scroller-reading-detectors',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
          'test-results/scroller-reading-detectors.json',
      },
    ],
  ],
});
