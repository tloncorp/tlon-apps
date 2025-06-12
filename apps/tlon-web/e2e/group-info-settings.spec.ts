import { expect, test } from '@playwright/test';

import {
  cleanupExistingGroup,
  clickThroughWelcome,
  createChannel,
  createChannelSection,
  createGroup,
  createRole,
  deleteChannel,
  deleteGroup,
  editChannel,
  navigateBack,
  navigateToHomeAndVerifyGroup,
  openGroupSettings,
  setGroupNotifications,
  setGroupPrivacy,
  toggleChatPin,
  verifyElementCount,
  waitForElementAndAct,
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

  // Clean up any existing group
  await cleanupExistingGroup(page);

  // Create a new group
  await createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test pin/unpin functionality
  const pinStatus = await toggleChatPin(page);

  // Navigate back to check pinned status
  if (pinStatus) {
    await navigateToHomeAndVerifyGroup(page, pinStatus);
  }

  // Return to group settings and toggle pin again
  await page.getByText('Untitled group').first().click();
  await openGroupSettings(page);
  const unpinStatus = await toggleChatPin(page);

  // Navigate back to check unpinned status
  if (unpinStatus) {
    await navigateToHomeAndVerifyGroup(page, unpinStatus);
  }

  // Return to group settings for remaining tests
  await page.getByText('Untitled group').first().click();
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test reference copying
  await page.getByText('Reference').click();
  // Check for copy confirmation (optional)
  await waitForElementAndAct(page, 'Copied', async () => {
    await expect(page.getByText('Copied')).toBeVisible();
  });

  // Test privacy settings
  await setGroupPrivacy(page, true);
  await navigateBack(page);
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
  await createRole(page, 'Testing role', 'Description for test role');

  await navigateBack(page);
  await verifyElementCount(page, 'GroupRoles', 2);

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
  await createChannel(page, 'Second chat channel');

  await navigateBack(page);
  await page.waitForTimeout(500);
  await verifyElementCount(page, 'GroupChannels', 2);

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
  await editChannel(
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
  await createChannelSection(page, 'Testing section');

  await navigateBack(page);

  // Test notification settings
  await setGroupNotifications(page, 'All activity');
  await navigateBack(page, 1);
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
  await deleteChannel(page, 'Testing channel renaming');

  await expect(page.getByText('Manage channels')).toBeVisible();
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).not.toBeVisible();

  await navigateBack(page);
  await verifyElementCount(page, 'GroupChannels', 1);

  // Delete group
  await deleteGroup(page);
});
