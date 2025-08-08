import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should create, verify, and delete a group', async ({ zodPage }) => {
  const page = zodPage;

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group (this handles the entire creation flow)
  await helpers.createGroup(page);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open the overflow menu and access group settings
  await helpers.openGroupSettings(page);

  // Verify group status (check for any group with 1 member text pattern)
  const groupStatusText = page.locator('text=/.*group with 1 member/');
  await expect(groupStatusText).toBeVisible();

  // Assert we're in group settings
  await expect(page.getByText('Group info')).toBeVisible();

  // Delete the group (this handles the entire deletion flow)
  await helpers.deleteGroup(page);

  // Verify we're back at Home and group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
});
