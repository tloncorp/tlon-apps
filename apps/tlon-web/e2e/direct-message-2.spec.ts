import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~ten'].authFile });

test('should test if direct messages are received (from ~zod to ~ten)', async ({
  page,
}) => {
  await page.goto(tenUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  await expect(page.getByTestId('ChannelListItem-~zod')).toBeVisible();
  await page.getByTestId('ChannelListItem-~zod').click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Hello, ~ten!').first()).toBeVisible();

  await expect(page.getByText('Accept')).toBeVisible();
  await expect(page.getByText('Deny')).toBeVisible();
  await expect(page.getByText('Block')).toBeVisible();

  await page.getByText('Accept').click();

  await page.waitForTimeout(1000);

  await expect(page.getByText('Accept')).not.toBeVisible();

  await expect(page.getByText('Deny')).not.toBeVisible();

  await helpers.sendMessage(page, 'Hello, ~zod!');

  await expect(page.getByText('Hello, ~zod!')).toBeVisible();

  await helpers.leaveDM(page, '~zod');
});
