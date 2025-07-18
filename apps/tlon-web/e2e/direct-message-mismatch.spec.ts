import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test direct message protocol mismatch', async ({ zodPage }) => {
  const page = zodPage;

  await helpers.createDirectMessage(page, '~bus');

  if (await zodPage.getByTestId('MessageInput').isVisible()) {
    await helpers.sendMessage(page, 'Hello, ~bus!');
    // we need to reload the page to trigger the visible mismatch state
    // TODO: fix this
    await page.reload();
  }

  await expect(page.getByTestId('read-only-notice-dm-mismatch')).toBeVisible();
});
