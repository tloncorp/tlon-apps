import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-warm.config';

/** Real local-ship application only. No detector or synthetic page in this config. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-keyboard-stability.spec.ts',
  projects: config.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      channel: 'chromium',
      headless: process.env.SCROLLER_HEADED !== '1',
    },
  })),
});
