import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-reading-product.config';

export default defineConfig({
  ...config,
  testMatch: 'scroller-reference-stability.spec.ts',
  retries: 0,
});
