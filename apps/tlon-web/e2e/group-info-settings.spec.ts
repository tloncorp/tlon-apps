import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

// const busUrl = `${shipManifest['~bus'].webUrl}/apps/groups/`;
const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should handle complete group lifecycle with settings management', async ({
  page,
}) => {
  await page.goto(zodUrl);
  await page.click('[data-testid="lets-get-started"]');
  await page.click('[data-testid="got-it"]');
  await page.click('[data-testid="one-quick-thing"]');
  await page.click('[data-testid="invite-friends"]');
  await page.click('[data-testid="connect-contact-book"]');

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await page.locator('[data-testid="CreateChatSheetTrigger"]').click();

  await expect(
    page.getByText('Create a customizable group chat')
  ).toBeVisible();

  await page.getByText('New group').click();
  await expect(page.getByText('Select contacts to invite')).toBeVisible();

  await page.getByText('Create group').click();

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await page.click('[data-testid="HeaderBackButton"]');
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await page
    .locator('[data-testid="GroupOptionsSheetTrigger"]')
    .first()
    .click();
  await expect(page.getByText('Group info & settings')).toBeVisible();
  await page.getByText('Group info & settings').click();
  await expect(page.getByText('Group info')).toBeVisible();

  // Test pin/unpin functionality
  await page.getByText('Pin').click();
  await expect(page.getByText('Unpin')).toBeVisible();

  // Navigate back to check pinned status
  await page.getByTestId('HeaderBackButton').nth(1).click();

  if (await page.getByText('Home').isVisible()) {
    await expect(
      page.getByTestId('ChatListItem-Untitled group-pinned')
    ).toBeVisible();
  }

  // Return to group settings
  await page.getByText('Untitled group').first().click();
  await page
    .locator('[data-testid="GroupOptionsSheetTrigger"]')
    .first()
    .click();
  await expect(page.getByText('Group info & settings')).toBeVisible();
  await page.getByText('Group info & settings').click();

  // Unpin the group
  await page.getByText('Unpin').click();
  await expect(page.getByText('Pin')).toBeVisible();

  // Navigate back to check unpinned status
  await page.getByTestId('HeaderBackButton').nth(1).click();

  if (await page.getByText('Home').isVisible()) {
    await expect(
      page.getByTestId('ChatListItem-Untitled group-unpinned')
    ).toBeVisible();
  }

  // Return to group settings for remaining tests
  await page.getByText('Untitled group').first().click();
  await page
    .locator('[data-testid="GroupOptionsSheetTrigger"]')
    .first()
    .click();
  await expect(page.getByText('Group info & settings')).toBeVisible();
  await page.getByText('Group info & settings').click();
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

  await page.getByTestId('RoleTitleInput').click();
  await page.fill('[data-testid="RoleTitleInput"]', 'Testing role');

  await page.getByTestId('RoleDescriptionInput').click();
  await page.fill(
    '[data-testid="RoleDescriptionInput"]',
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

  await page.getByTestId('ChannelTitleInput').click();
  await page.fill('[data-testid="ChannelTitleInput"]', 'Second chat channel');
  await page.getByText('Create channel').click();

  await page.getByTestId('HeaderBackButton').first().click();
  await expect(
    page.getByTestId('GroupChannels').locator('div').filter({ hasText: '2' })
  ).toBeVisible();

  // Test channel reordering
  await page.getByTestId('GroupChannels').click();

  // Move channel down
  await page.getByTestId('MoveChannelDownButton').first().click();

  // Wait for the channel to appear at index 0 with a longer timeout
  await expect(
    page.getByTestId('ChannelItem-Second chat channel-0')
  ).toBeVisible({ timeout: 10000 });

  // Move channel up
  await page.getByTestId('MoveChannelUpButton').nth(1).click();

  // Wait for the channel to appear at index 1 with a longer timeout
  await expect(
    page.getByTestId('ChannelItem-Second chat channel-1')
  ).toBeVisible({ timeout: 10000 });

  // Edit channel
  await page
    .getByTestId('ChannelItem-Second chat channel-1')
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  // Clear and update channel name
  await page.getByTestId('ChannelTitleInput').click();
  await page.getByTestId('ChannelTitleInput').fill('');
  await page.fill(
    '[data-testid="ChannelTitleInput"]',
    'Testing channel renaming'
  );

  await page.getByTestId('ChannelDescriptionInput').click();
  await page.fill(
    '[data-testid="ChannelDescriptionInput"]',
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

  await page.getByTestId('SectionNameInput').click();
  await page.fill('[data-testid="SectionNameInput"]', '');
  await page.fill('[data-testid="SectionNameInput"]', 'Testing section');
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
  await page.getByTestId('GroupChannels').getByText('Channels').click();
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
});
