import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-warm.config';

/** Real application and verified local ships; no synthetic DOM in these cases. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-input-stability.spec.ts',
  projects: config.projects?.map((project) => ({
    ...project,
    use: { ...project.use, channel: 'chromium', headless: false },
  })),
});
