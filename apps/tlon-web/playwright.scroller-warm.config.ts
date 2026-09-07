import { defineConfig } from '@playwright/test';

import config from './playwright.config';

/**
 * Focused rechecks against explicitly verified, already-running test frontends.
 * Authenticate with scripts/authenticate-scroller-web.mjs first. This config
 * neither starts servers nor changes the real application fixtures/assertions.
 */
export default defineConfig({
  ...config,
  webServer: undefined,
  testMatch: 'scroller-stability.spec.ts',
  projects: config.projects
    ?.filter((project) => project.name === 'chromium')
    .map((project) => ({ ...project, dependencies: [] })),
});
