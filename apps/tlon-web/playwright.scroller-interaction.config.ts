import { defineConfig } from '@playwright/test';

import config from './playwright.scroller-product.config';

/** Functional input/transport proof; strict sampled geometry stays separate. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-send-button.spec.ts',
});
