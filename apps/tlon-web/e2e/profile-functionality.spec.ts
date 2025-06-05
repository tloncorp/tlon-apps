import { expect, test } from '@playwright/test';

import { clickThroughWelcome } from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test profile functionality', async ({ page }) => {
  await page.goto(zodUrl);
  await clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible();
  await page.getByText('You').click();
  await expect(page.getByText('Profile')).toBeVisible();
  await page.getByText('Edit').click();
  await expect(page.getByText('Edit Profile')).toBeVisible();
  await page.getByTestId('ProfileNicknameInput').click();
  await page.getByTestId('ProfileNicknameInput').fill('Testing nickname');
  await page.getByRole('textbox', { name: 'Hanging out...' }).click();
  await page
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Testing status');
  await page.getByRole('textbox', { name: 'About yourself' }).click();
  await page
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Testing bio');
  await page.getByText('Add a group').click();
  // This is a fake ship, so we don't have any groups to add. We could add a group to this test, though
  await page.getByTestId('CloseFavoriteGroupSelectorSheet').click();
  await page.getByText('Done').click();
  // TODO: figure out why we need to reload here. This should be fixed.
  await page.reload();
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Testing nickname').first()).toBeVisible();
  await expect(page.getByText('Testing status').first()).toBeVisible();
  await expect(page.getByText('Testing bio')).toBeVisible();
});
