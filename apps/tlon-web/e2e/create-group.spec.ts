import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should create a group with a default single channel', async ({
  zodPage,
}) => {
  const page = zodPage;
  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);

  await expect(page.getByText('Welcome to your group!')).toBeVisible({
    timeout: 5000,
  });

  const homeVisible = await page.getByText('Home').isVisible();
  if (!homeVisible) {
    await page.getByTestId('HomeNavIcon').click();
  }

  await expect(page.getByText('Untitled group')).toBeVisible({
    timeout: 10000,
  });

  await page.getByText('Untitled group').click();
  await page.waitForTimeout(1000);

  await helpers.verifyGroupChannels(page, [{ title: 'General', type: 'chat' }]);

  // Clean up: navigate back and delete the group
  await helpers.navigateBack(page);
  await helpers.navigateBack(page);
  await helpers.openGroupSettings(page);
  await helpers.deleteGroup(page);

  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
});
