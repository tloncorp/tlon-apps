import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'scroller-input-detectors.spec.ts',
  workers: 1,
  retries: 0,
  use: {
    browserName: 'chromium',
    channel: 'chromium',
    headless: process.env.SCROLLER_HEADED !== '1',
    viewport: { width: 1280, height: 800 },
  },
  outputDir: './test-results/scroller-input-detectors',
});
