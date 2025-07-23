import { defineConfig, devices } from '@playwright/test';

import shipManifest from './e2e/shipManifest.json';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const webServers = Object.entries(shipManifest).map(
  ([key, ship]: [string, any]) => ({
    command: `cross-env SHIP_URL=${ship.url} VITE_DISABLE_SPLASH_MODAL=true pnpm dev-no-ssl`,
    url: `${ship.webUrl}/apps/groups/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  })
);

export default defineConfig({
  testDir: './e2e',

  timeout: process.env.CI ? 120 * 1000 : 60 * 1000,

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  retries: 2,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000/apps/groups/',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    //   dependencies: ['setup'],
    //   testIgnore: /.*\.setup\.ts/,
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: webServers,
});
