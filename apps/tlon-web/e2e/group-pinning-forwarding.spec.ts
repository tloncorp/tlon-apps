import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should handle group pinning/unpinning and forwarding', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test pin functionality
  const pinStatus = await helpers.toggleChatPin(page);

  // Navigate back to check pinned status
  if (pinStatus) {
    await helpers.navigateToHomeAndVerifyGroup(page, pinStatus);
  }

  // Return to group settings and toggle pin again
  await page.getByText('Untitled group').first().click();
  await helpers.openGroupSettings(page);
  const unpinStatus = await helpers.toggleChatPin(page);

  // Navigate back to check unpinned status
  if (unpinStatus) {
    await helpers.navigateToHomeAndVerifyGroup(page, unpinStatus);
  }

  // Return to group settings for forwarding test
  await page.getByText('Untitled group').first().click();
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test forwarding group reference
  await helpers.forwardGroupReference(page, 'Chat');
});
