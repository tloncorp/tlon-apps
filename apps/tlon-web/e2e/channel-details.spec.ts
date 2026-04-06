import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should display channel details screen with all expected elements', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group and add a second channel (multi-channel groups show channel details)
  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();

  // Verify channel details screen elements are visible
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
  await expect(page.getByText('Permissions')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('Notifications')).toBeVisible({
    timeout: 5000,
  });

  // Leave/Delete actions - host sees "Delete channel" instead of "Leave channel"
  await expect(page.getByText('Delete channel')).toBeVisible({
    timeout: 5000,
  });
});

test('should navigate to channel edit settings from channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Click on the header edit button to navigate to channel edit screen
  await page.getByTestId('DetailsEditButton').click();

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

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Verify Pin button is visible (channel is not pinned initially)
  await expect(page.getByText('Pin', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Click Pin to pin the channel
  await page.getByText('Pin', { exact: true }).click();

  // Verify button changes to Unpin
  await expect(page.getByText('Unpin', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Click Unpin to unpin the channel
  await page.getByText('Unpin', { exact: true }).click();

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

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Click on Privacy setting
  await page.getByTestId('ChannelPrivacy').click();

  // Verify we're on the channel privacy screen (now a separate screen)
  await expect(page.getByText('Channel permissions')).toBeVisible({
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

test('channel privacy back button returns to channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Verify sidebar shows group channels (not Home sidebar)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Click on Privacy setting
  await page.getByTestId('ChannelPrivacy').click();

  // Verify we're on the channel privacy screen
  await expect(page.getByText('Channel permissions')).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').first().click();

  // Verify we're back on channel details
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels after navigating back
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
});

// Note: Delete channel from channel details is tested in group-channel-management.spec.ts
// The test was removed here due to test fixture cleanup conflicts after channel deletion

test('channel edit meta back button returns to channel details with sidebar context', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Verify sidebar shows group channels (not Home sidebar)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Click on the header edit button to navigate to channel edit screen
  await page.getByTestId('DetailsEditButton').click();

  // Verify we're on the channel edit screen
  await expect(page.getByTestId('ChannelTitleInput')).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels while on edit screen
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Click back button (or save to go back)
  await page.getByTestId('HeaderBackButton').first().click();

  // Verify we're back on channel details (use exact match to avoid matching "Edit channel info")
  await expect(page.getByText('Channel info', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels after navigating back
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
});

test('channel header title navigates to channel details with sidebar context', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // We should now be in the General channel of a multi-channel group
  // Verify sidebar shows group channels (not Home sidebar)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Click the channel title to navigate to channel details
  await page.getByTestId('ScreenHeaderTitle').click();

  // Verify we're on channel details
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels (this tests the fix in ChannelScreen.tsx)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
});

test('channel overflow menu: Channel info & settings maintains sidebar context', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // We should now be in the General channel of a multi-channel group
  // Verify sidebar shows group channels (not Home sidebar)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });

  // Right-click on the channel in the sidebar to open the context menu
  await page.getByTestId('ChannelListItem-General').click({ button: 'right' });

  // Wait for the options sheet to appear and click "Channel info & settings"
  await expect(page.getByText('Channel info & settings')).toBeVisible({
    timeout: 5000,
  });
  await page.getByText('Channel info & settings').click();

  // Verify we're on channel details
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Verify sidebar still shows group channels (this tests the fix in ChatOptionsSheet.tsx)
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 5000,
  });
});

// Back navigation tests for notifications screen

test('multi-channel group: notifications back button returns to channel details', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();
  await expect(page.getByText('Channel info')).toBeVisible({ timeout: 5000 });

  // Click on Notifications setting
  await page.getByTestId('ChannelNotifications').click();

  // Verify we're on the notifications screen - use ScreenHeaderTitle to avoid strict mode violation
  await expect(
    page.getByTestId('ScreenHeaderTitle').filter({ hasText: 'Notifications' })
  ).toBeVisible({
    timeout: 5000,
  });
  // Note: On desktop, the subtitle with channel name may not be visible in the header

  // Click back button
  await page.getByTestId('HeaderBackButton').first().click();

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
  await expect(page.getByTestId('MessageInput')).toBeVisible({ timeout: 5000 });

  // Click on channel header title - should open GROUP details (single-channel behavior)
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();

  // Verify we're on GROUP details (not channel details)
  await expect(page.getByText('Group info & settings')).toBeVisible({
    timeout: 5000,
  });

  // Click on Notifications setting
  await page.getByTestId('GroupNotifications').click();

  // Verify we're on the notifications screen - use ScreenHeaderTitle to avoid strict mode violation
  await expect(
    page.getByTestId('ScreenHeaderTitle').filter({ hasText: 'Notifications' })
  ).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').first().click();

  // Verify we're back on group details
  await expect(page.getByText('Group info & settings')).toBeVisible({
    timeout: 5000,
  });
});

test('channel details back button returns to channel conversation', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroup(page);
  await helpers.setupMultiChannelGroup(page);

  // Send a message so we can verify we return to the channel
  await helpers.sendMessage(page, 'Testing channel details back navigation.');

  // Wait for message to appear
  await expect(
    page.getByText('Testing channel details back navigation.').first()
  ).toBeVisible({ timeout: 5000 });

  // Click on channel header title to open channel details
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();

  // Verify we're on channel details (multi-channel group)
  await expect(page.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').first().click();

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
  await expect(page.getByTestId('MessageInput')).toBeVisible({ timeout: 5000 });

  // Send a message so we can verify we return to the channel
  await helpers.sendMessage(page, 'Testing group details back navigation.');

  // Wait for message to appear
  await expect(
    page.getByText('Testing group details back navigation.').first()
  ).toBeVisible({ timeout: 5000 });

  // Click on channel header title - should open GROUP details (single-channel behavior)
  await page
    .getByTestId('ChannelHeaderTitle')
    .getByTestId('ScreenHeaderTitle')
    .click();

  // Verify we're on GROUP details
  await expect(page.getByText('Group info & settings')).toBeVisible({
    timeout: 5000,
  });

  // Click back button
  await page.getByTestId('HeaderBackButton').first().click();

  // Verify we're back in the channel conversation
  await expect(
    page.getByText('Testing group details back navigation.').first()
  ).toBeVisible({ timeout: 5000 });

  // Verify we're in the channel context by checking for message input
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 5000,
  });
});
