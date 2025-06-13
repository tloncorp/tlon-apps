import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test app settings', async ({ page }) => {
  await page.goto(zodUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  await expect(page.getByTestId('SettingsNavIcon')).toBeVisible();
  await page.getByTestId('SettingsNavIcon').click();
  await expect(page.getByText('Settings', { exact: true })).toBeVisible();

  await page.getByText('Notification settings').click();
  await expect(page.getByText('Push Notifications')).toBeVisible();
  await page.getByText('Blocked users').click();
  await expect(page.getByText('Blocked users').first()).toBeVisible();
  await page.getByText('Privacy').click();
  await expect(page.getByText('Privacy Settings')).toBeVisible();
  await page.getByText('Theme').click();
  await expect(page.getByText('Theme').first()).toBeVisible();
  await page.getByText('App info').click();
  await page.getByText('Report a bug').click();
  await expect(page.getByText('Report a bug').first()).toBeVisible();
  await page.getByText('Experimental features').click();
  await expect(page.getByText('Feature Previews')).toBeVisible();
});
