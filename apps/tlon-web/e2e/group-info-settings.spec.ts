import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should handle complete group lifecycle with settings management', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing group
  await helpers.cleanupExistingGroup(page);
  await helpers.cleanupExistingGroup(page, '~ten, ~zod');

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

  // Test pin/unpin functionality
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

  // Return to group settings for remaining tests
  await page.getByText('Untitled group').first().click();
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test reference copying
  await page.getByText('Reference').click();
  // Check for copy confirmation (optional)
  await helpers.waitForElementAndAct(page, 'Copied', async () => {
    await expect(page.getByText('Copied')).toBeVisible();
  });

  // Test privacy settings
  await helpers.setGroupPrivacy(page, true);
  await helpers.navigateBack(page);
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
  await helpers.createRole(page, 'Testing role', 'Description for test role');

  await helpers.navigateBack(page);
  await helpers.verifyElementCount(page, 'GroupRoles', 2);

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
  await helpers.createChannel(page, 'Second chat channel');

  await helpers.navigateBack(page);
  await page.waitForTimeout(500);
  await helpers.verifyElementCount(page, 'GroupChannels', 2);

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
  await helpers.editChannel(
    page,
    'Second chat channel',
    'Testing channel renaming',
    'Testing channel description'
  );

  await page.getByText('Group info').click();
  await page.waitForTimeout(500);
  await page.getByTestId('GroupChannels').click();
  await page.waitForTimeout(500);
  await expect(
    page.getByText('Testing channel renaming').first()
  ).toBeVisible();

  // Create channel section
  await helpers.createChannelSection(page, 'Testing section');

  await helpers.navigateBack(page);

  // Test notification settings
  await helpers.setGroupNotifications(page, 'All activity');
  await helpers.navigateBack(page, 1);
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
  await helpers.deleteChannel(page, 'Testing channel renaming');

  await expect(page.getByText('Manage channels')).toBeVisible();
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).not.toBeVisible();

  await helpers.navigateBack(page);
  await helpers.verifyElementCount(page, 'GroupChannels', 1);

  // Delete group
  await helpers.deleteGroup(page);
});
