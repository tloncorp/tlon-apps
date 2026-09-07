import { defineConfig } from '@playwright/test';
import config from './playwright.scroller-keyboard.config';
/** Native browser semantics calibration, excluded from actual-app coverage. */
export default defineConfig({
  ...config,
  testMatch: 'scroller-keyboard-controls.spec.ts',
});
