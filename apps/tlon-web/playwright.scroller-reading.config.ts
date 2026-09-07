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
    headless: false,
    viewport: { width: 1280, height: 800 },
    // Full headed Chromium avoids this host's independently measured 10 Hz
    // headless scheduling. Raw DOM traces remain the detector evidence.
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
