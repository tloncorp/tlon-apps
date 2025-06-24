import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

test('should show group info, channel, and role changes to invited user', async ({
  browser,
}) => {
  // Create two browser contexts - one for ~zod (group creator) and one for ~ten (invitee)
  const zodContext = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  const tenContext = await browser.newContext({
    storageState: shipManifest['~ten'].authFile,
  });

  const zodPage = await zodContext.newPage();
  const tenPage = await tenContext.newPage();

  try {
    // Step 1: ~zod creates a group and makes various changes
    await zodPage.goto(zodUrl);
    await helpers.clickThroughWelcome(zodPage);
    await zodPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Clean up any existing group on zod
    await helpers.cleanupExistingGroup(zodPage, 'Test Group');
    await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');
    await helpers.cleanupExistingGroup(zodPage);

    // Create a new group on zod
    await helpers.createGroup(zodPage);

    // Open group settings to make changes
    await helpers.openGroupSettings(zodPage);

    // Change group info - set privacy to private
    await helpers.setGroupPrivacy(zodPage, true);
    await helpers.navigateBack(zodPage);

    // Verify privacy setting on zod's side
    await expect(
      zodPage.getByText('Private group with 1 member')
    ).toBeVisible();

    // Open group settings again to make more changes
    await helpers.openGroupSettings(zodPage);

    // Create a new role
    await zodPage.getByTestId('GroupRoles').click();
    await helpers.createRole(
      zodPage,
      'Test Role',
      'A test role for verification'
    );
    await zodPage.waitForTimeout(1000);
    await helpers.navigateBack(zodPage);

    // Create additional channels
    await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
    await helpers.createChannel(zodPage, 'Test Channel');
    await helpers.navigateBack(zodPage);

    // Create a channel section
    await zodPage.getByTestId('GroupChannels').click();
    await helpers.createChannelSection(zodPage, 'Test Section');
    await helpers.navigateBack(zodPage);

    // Step 2: Invite ~ten to the group
    await zodPage.getByText('Invite people').click();
    await expect(zodPage.getByText('Select people to invite')).toBeVisible();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.getByTestId('ContactRow').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(1000);

    // Navigate back to group
    // await helpers.navigateBack(zodPage);

    // Step 3: ~ten accepts the invite
    await tenPage.goto(tenUrl);
    await helpers.clickThroughWelcome(tenPage);
    await tenPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Wait for and accept the group invitation
    await expect(tenPage.getByText('Group invitation')).toBeVisible();
    await tenPage.getByText('Group invitation').click();

    // Accept the invitation if the button is visible
    if (await tenPage.getByText('Accept invite').isVisible()) {
      await tenPage.getByText('Accept invite').click();
    }

    await tenPage.waitForSelector('text=Joining, please wait...');
    await tenPage.waitForSelector('text=Go to group', { state: 'visible' });

    if (await tenPage.getByText('Go to group').isVisible()) {
      await tenPage.getByText('Go to group').click();
    } else {
      await tenPage.getByText('~ten, ~zod').click();
    }

    // Step 4: ~zod makes ~ten an admin
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await helpers.assignRoleToMember(zodPage, 'Admin', 1);
    await helpers.navigateBack(zodPage);

    // Step 5: Verify that ~ten can see all the changes made by ~zod
    await helpers.openGroupSettings(tenPage);

    // Verify privacy setting is visible to ten
    await helpers.openGroupSettings(tenPage);
    await expect(
      tenPage.getByText('Private group with 2 members')
    ).toBeVisible();

    // Verify channels are visible to ten
    await expect(tenPage.getByTestId('ChannelListItem-General')).toBeVisible();
    await expect(
      tenPage.getByTestId('ChannelListItem-Test Channel')
    ).toBeVisible();

    // Open group settings on ten's side to verify roles and other settings
    await helpers.openGroupSettings(tenPage);

    await tenPage.getByTestId('GroupRoles').click();
    await expect(tenPage.getByText('Group Roles')).toBeVisible();
    await expect(tenPage.getByTestId('GroupRole-Admin')).toBeVisible();
    await expect(tenPage.getByTestId('GroupRole-Test Role')).toBeVisible();
    await expect(
      tenPage.getByText('A test role for verification', { exact: true })
    ).toBeVisible();

    await helpers.navigateBack(tenPage);

    // Verify channels are visible in settings
    await tenPage.getByTestId('GroupChannels').getByText('Channels').click();
    await expect(tenPage.getByText('Manage channels')).toBeVisible();
    await expect(
      tenPage
        .locator('div')
        .filter({ hasText: /^General$/ })
        .first()
    ).toBeVisible();
    await expect(
      tenPage
        .locator('div')
        .filter({ hasText: /^Test Channel$/ })
        .first()
    ).toBeVisible();

    // Verify channel section is visible
    await expect(tenPage.getByText('Test Section')).toBeVisible();

    await helpers.navigateBack(tenPage);

    // Step 6: Test that ~ten can see real-time updates
    // Make additional changes on zod's side while ten is in the group
    await zodPage.getByTestId('GroupChannels').click();
    await helpers.createChannel(zodPage, 'Real-time Channel');
    await helpers.navigateBack(zodPage);
    await helpers.navigateBack(zodPage);

    // Verify ten can see the new channel
    await tenPage.waitForTimeout(2000); // Allow time for sync
    await expect(
      tenPage.getByTestId('ChannelListItem-Real-time Channel')
    ).toBeVisible();
  } finally {
    // Clean up - delete the group from zod's side
    try {
      await helpers.cleanupExistingGroup(zodPage, 'Test Group');
      await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');
      await helpers.cleanupExistingGroup(zodPage);
    } catch (error) {
      console.log('Cleanup failed:', error);
    }

    // Close contexts
    await zodContext.close();
    await tenContext.close();
  }
});
