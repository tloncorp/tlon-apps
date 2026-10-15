import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('Everyone can see and post by default on channel permissions', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a group with multiple channels so channel details is accessible
  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Navigate to channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Navigate to channel permissions
  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible({
    timeout: 5000,
  });

  // Everyone can see and post until someone picks otherwise
  await helpers.expectAccessLevel(page, 'Everyone', 'Can post');
  await expect(page.getByText('Everyone can see and post.')).toBeVisible();

  // A role can be made from here
  await expect(page.getByTestId('ChannelPermissionsNewRole')).toBeVisible();
});

test('Members row appears in GroupRolesScreen', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your group!').isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and re-enter group
  if (await page.getByTestId('HomeNavIcon').isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Verify Members row is visible
  await expect(page.getByTestId('GroupRole-Members')).toBeVisible({
    timeout: 5000,
  });

  // Verify Admin row is also visible
  await expect(page.getByTestId('GroupRole-Admin')).toBeVisible();
});
