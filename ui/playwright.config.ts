import { defineConfig, devices } from '@playwright/test';
import shipManifest from './e2e/shipManifest.json';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  // fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000/apps/groups/',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // {
    // name: 'chromium',
    // use: {
    // ...devices['Desktop Chrome'],
    // },
    // dependencies: ['setup'],
    // },

    // {
    // name: 'firefox',
    // use: {
    // ...devices['Desktop Firefox'],
    // },
    // dependencies: ['setup'],
    // },

    // Just testing against webkit for now until we figure out how to
    // reset state before each browser project.
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    // {
    // name: 'Mobile Chrome',
    // use: {
    // ...devices['Pixel 5'],
    // },
    // dependencies: ['setup'],
    // },
    // {
    // name: 'Mobile Safari',
    // use: {
    // ...devices['iPhone 12'],
    // },
    // dependencies: ['setup'],
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ..devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: `cross-env SHIP_URL=${
        (shipManifest as Record<string, any>)['~habduc-patbud'].url
      } npm run dev-no-ssl`,
      url: 'http://localhost:3000/apps/groups/',
    },
    {
      command: `cross-env SHIP_URL=${
        (shipManifest as Record<string, any>)['~naldeg-mardev'].url
      } E2E_PORT_3001=true npm run dev-no-ssl`,
      url: 'http://localhost:3001/apps/groups/',
    },
  ],
  timeout: 60 * 1000,
});
