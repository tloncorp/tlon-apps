import { defineConfig } from '@playwright/test';

import config from './playwright.config';

/** Calibrate the geometry detector without starting ships or web servers. */
export default defineConfig({
  ...config,
  webServer: undefined,
  testMatch: 'scroller-stability.spec.ts',
  grep: /Scroller detector self-tests/,
  projects: config.projects
    ?.filter((project) => project.name === 'chromium')
    .map((project) => ({ ...project, dependencies: [] })),
  outputDir: './test-results/scroller-detectors',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
          'test-results/scroller-detectors.json',
      },
    ],
  ],
});
