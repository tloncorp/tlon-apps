import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-reading-product.config';

/** Real production renderer, normal flags, independent local image requests. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-concurrent-content.spec.ts',
  retries: 0,
});
