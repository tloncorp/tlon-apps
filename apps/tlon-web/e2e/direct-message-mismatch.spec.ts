import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

const INCLUDE_OPTIONAL_SHIPS = process.env.INCLUDE_OPTIONAL_SHIPS === 'true';

test('should test direct message protocol mismatch', async ({ zodPage }) => {
  test.skip(
    !INCLUDE_OPTIONAL_SHIPS,
    'Test requires ~bus ship (set INCLUDE_OPTIONAL_SHIPS=true)'
  );

  const page = zodPage;

  await helpers.createDirectMessage(page, '~bus');

  if (await zodPage.getByTestId('MessageInput').isVisible()) {
    await helpers.sendMessage(page, 'Hello, ~bus!');
    // navigate to home
    await page.getByTestId('HomeNavIcon').click();
    // give some time for the mismatch to register
    await page.waitForTimeout(10000);
    await page.getByTestId('ChannelListItem-~bus').click();

    await expect(page.getByTestId('read-only-notice-dm-mismatch')).toBeVisible({
      timeout: 10000,
    });
  }
});
