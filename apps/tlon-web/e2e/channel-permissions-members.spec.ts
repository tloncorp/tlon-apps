import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('Members row appears with correct defaults when enabling Custom Permissions', async ({
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

  // Toggle Custom Permissions on
  const privateToggle = page.getByTestId('PrivateChannelToggle');
  const isEnabled = await privateToggle.getAttribute('aria-checked');
  if (isEnabled !== 'true') {
    await privateToggle.click();
  }

  // Verify Members row appears in the permission table with Read and Write
  await expect(page.getByTestId('ReadToggle-Members')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId('WriteToggle-Members')).toBeVisible();

  // Verify Members Read toggle has a checked indicator (checkmark icon)
  await expect(
    page.getByTestId('ReadToggle-Members').getByRole('img')
  ).toBeVisible();

  // Verify Members Write toggle has a checked indicator
  await expect(
    page.getByTestId('WriteToggle-Members').getByRole('img')
  ).toBeVisible();

  // Verify Admin row is also visible
  await expect(page.getByTestId('ReadToggle-Admin')).toBeVisible();
  await expect(page.getByTestId('WriteToggle-Admin')).toBeVisible();

  // Verify "Add roles" button is visible
  await expect(page.getByText('Add roles')).toBeVisible();
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

test('Members appears in SelectChannelRoles screen', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a group with multiple channels
  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Navigate to channel permissions
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible({
    timeout: 5000,
  });

  // Toggle Custom Permissions on
  const privateToggle = page.getByTestId('PrivateChannelToggle');
  const isEnabled = await privateToggle.getAttribute('aria-checked');
  if (isEnabled !== 'true') {
    await privateToggle.click();
  }

  // Click "Add roles" to open the role selection screen
  await page.getByText('Add roles').click();
  await expect(page.getByText('Select roles')).toBeVisible({ timeout: 5000 });

  // Verify "Members" appears in the role selection list
  await expect(page.getByTestId('RoleOption-Members')).toBeVisible();
});
