import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test direct message protocol mismatch', async ({ page }) => {
  await page.goto(zodUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  await helpers.createDirectMessage(page, '~bus');

  await helpers.sendMessage(page, 'Hello, ~bus!');

  // we need to reload the page to trigger the visible mismatch state
  // TODO: fix this
  await page.reload();

  await expect(page.getByTestId('read-only-notice-dm-mismatch')).toBeVisible();

  // we can't leave the DM when it's in a mismatch state. bug?
  //   await helpers.leaveDM(page, '~bus');
});
