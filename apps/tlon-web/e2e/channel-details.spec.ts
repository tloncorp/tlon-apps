import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should display channel details screen with all expected elements', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  // (single-channel groups navigate to group details instead)
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify channel details screen elements are visible
  // Check header shows "Channel info"
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Quick actions - verify Invite and Pin buttons are visible
  await expect(page.getByText('Invite', { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('Pin', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Settings section - verify settings are visible by text
  await expect(page.getByText('Privacy')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('Edit name and description')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('Notifications')).toBeVisible({
    timeout: 5000,
  });

  // Leave actions - check for "Leave channel" text
  await expect(page.getByText('Leave channel')).toBeVisible({
    timeout: 5000,
  });
});

test('should navigate to channel edit settings from channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Click on Edit name and description
  await page.getByTestId('ChannelEditMeta').click();
  await page.waitForTimeout(500);

  // Verify we're on the channel edit screen
  await expect(page.getByTestId('ChannelTitleInput')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId('ChannelDescriptionInput')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId('ChannelSettingsSaveButton')).toBeVisible({
    timeout: 5000,
  });
});

test('should toggle pin/unpin from channel details', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify Pin button is visible (channel is not pinned initially)
  await expect(page.getByText('Pin', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Click Pin to pin the channel
  await page.getByText('Pin', { exact: true }).click();
  await page.waitForTimeout(500);

  // Verify button changes to Unpin
  await expect(page.getByText('Unpin', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Click Unpin to unpin the channel
  await page.getByText('Unpin', { exact: true }).click();
  await page.waitForTimeout(500);

  // Verify button changes back to Pin
  await expect(page.getByText('Pin', { exact: true })).toBeVisible({
    timeout: 5000,
  });
});

test('should navigate to channel privacy settings from channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Click on Privacy setting
  await page.getByTestId('ChannelPrivacy').click();
  await page.waitForTimeout(500);

  // Verify we're on the channel privacy screen (now a separate screen)
  await expect(page.getByText('Channel privacy')).toBeVisible({
    timeout: 5000,
  });
  // The privacy toggle should be visible
  await expect(page.getByTestId('PrivateChannelToggle')).toBeVisible({
    timeout: 5000,
  });
  // Save button should be visible
  await expect(page.getByTestId('ChannelPrivacySaveButton')).toBeVisible({
    timeout: 5000,
  });
});

// Note: Delete channel from channel details is tested in group-channel-management.spec.ts
// The test was removed here due to test fixture cleanup conflicts after channel deletion

// Back navigation tests for notifications screen

test('multi-channel group: notifications back button returns to channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify we're on channel details
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Click on Notifications setting
  await page.getByTestId('ChannelNotifications').click();
  await page.waitForTimeout(500);

  // Verify we're on the notifications screen with channel subtitle
  await expect(page.getByText('Notifications')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('General')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').click();
  await page.waitForTimeout(500);

  // Verify we're back on channel details (not group details)
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });
});

test('single-channel group: notifications back button returns to group details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group (single channel - only General)
  await helpers.createGroup(page);

  // Navigate to the General channel
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Click on channel header title - should open GROUP details (single-channel behavior)
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify we're on GROUP details (not channel details)
  await expect(page.getByText('Group info')).toBeVisible({
    timeout: 5000,
  });

  // Click on Notifications setting
  await page.getByTestId('GroupNotifications').click();
  await page.waitForTimeout(500);

  // Verify we're on the notifications screen
  await expect(page.getByText('Notifications')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').click();
  await page.waitForTimeout(500);

  // Verify we're back on group details
  await expect(page.getByText('Group info')).toBeVisible({
    timeout: 5000,
  });
});

test('channel details back button returns to channel conversation', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Create a second channel so it's a multi-channel group
  await helpers.createChannel(page, 'Second Channel');

  // Navigate back to General channel
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Send a message so we can verify we return to the channel
  await helpers.sendMessage(page, 'Testing channel details back navigation.');

  // Wait for message to appear
  await expect(
    page.getByText('Testing channel details back navigation.').first()
  ).toBeVisible({ timeout: 10000 });

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify we're on channel details
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').click();
  await page.waitForTimeout(500);

  // Verify we're back in the channel conversation
  await expect(
    page.getByText('Testing channel details back navigation.').first()
  ).toBeVisible({ timeout: 5000 });

  // Verify we're in the channel context by checking for message input
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 5000,
  });
});

test('group details back button returns to channel conversation (single-channel)', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group (single channel - only General)
  await helpers.createGroup(page);

  // Navigate to the General channel
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
  await page.getByTestId('ChannelListItem-General').click();
  await page.waitForTimeout(500);

  // Send a message so we can verify we return to the channel
  await helpers.sendMessage(page, 'Testing group details back navigation.');

  // Wait for message to appear
  await expect(
    page.getByText('Testing group details back navigation.').first()
  ).toBeVisible({ timeout: 10000 });

  // Click on channel header title - should open GROUP details (single-channel behavior)
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await page.waitForTimeout(500);

  // Verify we're on GROUP details
  await expect(page.getByText('Group info')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').click();
  await page.waitForTimeout(500);

  // Verify we're back in the channel conversation
  await expect(
    page.getByText('Testing group details back navigation.').first()
  ).toBeVisible({ timeout: 5000 });

  // Verify we're in the channel context by checking for message input
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 5000,
  });
});
