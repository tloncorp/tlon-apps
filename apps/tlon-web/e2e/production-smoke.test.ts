import { expect } from '@playwright/test';

import { test } from './test-fixtures';

// Set explicit timeout for production build testing
test.setTimeout(30000);

/**
 * Minimal smoke test to verify production builds work correctly.
 * This test will catch runtime errors like the Expo 52 issue
 * where "Cannot assign to read only property" errors occur in production.
 */
test('production build loads without runtime errors', async ({
  zodPage: page,
}) => {
  // The error detector in test-fixtures will automatically catch any runtime errors
  // when USE_PRODUCTION_BUILD=true

  // Just verify the app loads - this is enough to catch transpilation issues
  await expect(page.getByText('Home')).toBeVisible({ timeout: 15000 });

  // Navigate to trigger different module loading
  await page.getByTestId('MessagesNavIcon').click();
  await expect(
    page.getByTestId('ScreenHeaderTitle').getByText('Messages')
  ).toBeVisible();

  // If we get here without the error detector throwing, the production build works
  console.log(
    '✅ Production build smoke test passed - no runtime errors detected'
  );
});
