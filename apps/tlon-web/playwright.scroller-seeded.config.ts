import { defineConfig } from '@playwright/test';
import product from './playwright.scroller-product.config';

// Opt-in one-session pilot; existing 43-case product selection is unchanged.
export default defineConfig({
  ...product,
  testMatch: ['scroller-seeded-session.spec.ts'],
  outputDir: './test-results/scroller-seeded',
});
