import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should show group info, channel, and role changes to invited user', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Step 1: ~zod creates a group and makes various changes
  // Create a new group on zod
  await helpers.createGroup(zodPage);

  // Open group settings to make changes
  await helpers.openGroupSettings(zodPage);

  // Change group info - set privacy to private
  await helpers.setGroupPrivacy(zodPage, 'private');
  await helpers.navigateBack(zodPage);

  // Verify privacy setting on zod's side
  await expect(zodPage.getByText('Private group with 1 member')).toBeVisible();

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
  await zodPage.waitForTimeout(1000);
  await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
  await zodPage.getByText('Invite 1 and continue').click();
  await zodPage.waitForTimeout(1000);

  // Navigate back to group
  // await helpers.navigateBack(zodPage);

  // Step 3: ~ten accepts the invite
  await helpers.acceptGroupInvite(tenPage, '~ten, ~zod');

  // Step 4: ~zod makes ~ten an admin
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupMembers').click();
  await helpers.assignRoleToMember(zodPage, 'Admin', 1);
  await helpers.navigateBack(zodPage);

  // Step 5: Verify that ~ten can see all the changes made by ~zod
  await helpers.openGroupSettings(tenPage);

  // Verify privacy setting is visible to ten
  await helpers.openGroupSettings(tenPage);
  await expect(tenPage.getByText('Private group with 2 members')).toBeVisible();

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

  // Verify we're on the Channels screen by checking for the Sort and New buttons
  await expect(tenPage.getByText('Sort', { exact: true })).toBeVisible();
  await expect(tenPage.getByText('New', { exact: true })).toBeVisible();

  // Verify channels are visible (using regex to match any index)
  await expect(tenPage.getByTestId(/^ChannelItem-General-/)).toBeVisible();
  await expect(tenPage.getByTestId(/^ChannelItem-Test Channel-/)).toBeVisible();

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
});
