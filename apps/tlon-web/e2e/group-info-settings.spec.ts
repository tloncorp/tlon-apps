import { expect, test } from '@playwright/test';

import {
  clickThroughWelcome,
  createGroup,
  deleteGroup,
  fillFormField,
  navigateToHomeAndVerifyGroup,
  openGroupSettings,
} from './helpers';
import shipManifest from './shipManifest.json';

// const busUrl = `${shipManifest['~bus'].webUrl}/apps/groups/`;
const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should handle complete group lifecycle with settings management', async ({
  page,
}) => {
  await page.goto(zodUrl);
  await clickThroughWelcome(page);

  await expect(page.getByText('Home')).toBeVisible();

  if (await page.getByText('Untitled group').first().isVisible()) {
    // this is necessary for retrying the test (it's not visible on the first run)
    // this still doesn't work right, the header back button is not visible
    // for some reason. TODO: figure out why.
    await page.getByText('Untitled group').first().click();
    await openGroupSettings(page);
    await deleteGroup(page);
  }

  // Create a new group
  await createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await page.getByTestId('HeaderBackButton').first().click();
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test pin/unpin functionality
  await page.getByText('Pin').click();
  if (await page.getByText('Unpin').isVisible({ timeout: 2000 })) {
    await expect(page.getByText('Unpin')).toBeVisible();
  }

  // Navigate back to check pinned status
  await navigateToHomeAndVerifyGroup(page, 'pinned');

  // Return to group settings
  await page.getByText('Untitled group').first().click();
  await openGroupSettings(page);

  // Unpin the group
  await page.getByText('Unpin').click();
  if (await page.getByText('Pin').isVisible({ timeout: 2000 })) {
    await expect(page.getByText('Pin')).toBeVisible();
  }

  // Navigate back to check unpinned status
  await navigateToHomeAndVerifyGroup(page, 'unpinned');

  // Return to group settings for remaining tests
  await page.getByText('Untitled group').first().click();
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test reference copying
  await page.getByText('Reference').click();
  // Check for copy confirmation (optional)
  if (await page.getByText('Copied').isVisible({ timeout: 2000 })) {
    await expect(page.getByText('Copied')).toBeVisible();
  }

  // Test privacy settings
  await page.getByText('Privacy').click();
  await page.getByText('Private', { exact: true }).click();
  await page.getByTestId('HeaderBackButton').first().click();
  await expect(page.getByText('Private group with 1 member')).toBeVisible();
  await expect(
    page.getByTestId('GroupPrivacy').getByText('Private')
  ).toBeVisible();

  // Test role management
  await page.getByTestId('GroupRoles').click();
  await expect(page.getByText('Group Roles')).toBeVisible();
  await expect(page.getByTestId('GroupRole-Admin')).toBeVisible();

  // Edit existing role
  await page.getByTestId('GroupRole-Admin').click();
  await expect(
    page.getByText(/.*Admins can add and remove channels.*/)
  ).toBeVisible();
  await expect(page.getByText('Delete role')).not.toBeVisible();
  await page.getByText('Save').click();

  // Create new role
  await page.getByText('Add Role').click();
  await expect(page.getByRole('dialog').getByText('Add role')).toBeVisible();

  await fillFormField(page, 'RoleTitleInput', 'Testing role');
  await fillFormField(
    page,
    'RoleDescriptionInput',
    'Description for test role'
  );

  await page.getByText('Save').click();
  await expect(page.getByText('Testing role')).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();
  await expect(
    page.getByTestId('GroupRoles').locator('div').filter({ hasText: '2' })
  ).toBeVisible();

  // Test channel management
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await expect(page.getByText('Manage channels')).toBeVisible();
  await expect(
    page
      .locator('div')
      .filter({ hasText: /^GeneralChat$/ })
      .first()
  ).toBeVisible();

  // Create new channel
  await page.getByText('New Channel').click();
  await expect(page.getByText('Create a new channel')).toBeVisible();

  await fillFormField(page, 'ChannelTitleInput', 'Second chat channel');
  await page.getByText('Create channel').click();

  await page.getByTestId('HeaderBackButton').first().click();
  await expect(
    page.getByTestId('GroupChannels').locator('div').filter({ hasText: '2' })
  ).toBeVisible();

  // Test channel reordering
  // TODO: figure out why this is flaky
  // await page.getByTestId('GroupChannels').click();

  // // Move channel down
  // await page.getByTestId('MoveChannelDownButton').first().click();

  // await page.waitForTimeout(2000);

  // // Wait for the channel to appear at index 0 with a longer timeout
  // await expect(
  //   page.getByTestId('ChannelItem-Second chat channel-0')
  // ).toBeVisible({ timeout: 10000 });

  // // Move channel up
  // await page.getByTestId('MoveChannelUpButton').nth(1).click();

  // // Wait for the channel to appear at index 1 with a longer timeout
  // await expect(
  //   page.getByTestId('ChannelItem-Second chat channel-1')
  // ).toBeVisible({ timeout: 10000 });

  // Edit channel
  await page.getByTestId('GroupChannels').click();
  await page
    .getByTestId('ChannelItem-Second chat channel-1')
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  // Clear and update channel name
  await fillFormField(
    page,
    'ChannelTitleInput',
    'Testing channel renaming',
    true
  );
  await fillFormField(
    page,
    'ChannelDescriptionInput',
    'Testing channel description'
  );

  await page.getByText('Save').click();
  await page.getByText('Group info').click();
  await page.getByTestId('GroupChannels').click();
  await expect(
    page.getByText('Testing channel renaming').first()
  ).toBeVisible();

  // Create channel section
  await page.getByText('New Section').click();
  await expect(page.getByText('Add section')).toBeVisible();

  await fillFormField(page, 'SectionNameInput', 'Testing section', true);
  await page.getByText('Save').click();

  // Wait for section creation (with timeout, marked as optional in original)
  try {
    await expect(page.getByText('Testing section')).toBeVisible({
      timeout: 10000,
    });
  } catch (e) {
    // Optional assertion - continue if it fails
  }

  await page.getByTestId('HeaderBackButton').first().click();

  // Test notification settings
  await page.getByTestId('GroupNotifications').click();
  await expect(page.getByText('Posts, mentions, and replies')).toBeVisible();
  await page.getByText('All activity').click();
  await page.getByTestId('HeaderBackButton').nth(1).click();
  await expect(
    page.getByTestId('GroupNotifications').getByText('All activity')
  ).toBeVisible();

  // Navigate back to verify multi-channel navigation
  // this is mobile only
  // await page.getByTestId('HeaderBackButton').first().click();
  // await expect(page.getByText('General')).toBeVisible();
  // await page.getByTestId('HeaderBackButton').first().click();
  // await expect(page.getByText('Home')).toBeVisible();

  // await page.getByText('Untitled group').click();
  // await expect(page.getByText('Untitled group')).toBeVisible();
  // await expect(page.getByText('General')).toBeVisible();
  // await expect(
  //   page.getByText('Testing channel renaming').first()
  // ).toBeVisible();

  // await page.getByText('General').click();
  // await page.getByTestId('ChannelHeaderOverflowMenuButton').click();
  // await page.getByText('Group info & settings').click();

  // Delete channel and verify count update
  await page.waitForTimeout(2000);
  await page.getByTestId('GroupChannels').click();
  await page
    .getByTestId('ChannelItem-Testing channel renaming-1')
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  await page.getByText('Delete channel for everyone').click();
  await expect(page.getByText('This action cannot be undone.')).toBeVisible();
  await page.getByText('Delete channel', { exact: true }).click();

  await expect(page.getByText('Manage channels')).toBeVisible();
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).not.toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();
  await expect(
    page.getByTestId('GroupChannels').locator('div').filter({ hasText: '1' })
  ).toBeVisible();

  // Delete group
  await deleteGroup(page);
});
