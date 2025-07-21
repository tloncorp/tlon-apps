import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should invite ~bus to a group and test protocol mismatch', async ({
  zodSetup,
  busSetup,
}) => {
  const zodPage = zodSetup.page;
  const busPage = busSetup.page;

  // Step 0: Clean up any existing invites on ~ten
  await helpers.rejectGroupInvite(busPage);

  // Step 1: ~zod creates a group and invites ~bus
  // Clean up any existing group on zod
  await helpers.cleanupExistingGroup(zodPage);
  await helpers.cleanupExistingGroup(zodPage, '~bus, ~zod');

  // Create a new group on zod
  await helpers.createGroup(zodPage);

  // Open group settings to invite ~ten
  await helpers.openGroupSettings(zodPage);

  // Invite ~ten to the group
  await zodPage.getByText('Invite people').click();
  await expect(zodPage.getByText('Select people to invite')).toBeVisible();
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~bus');
  await zodPage.waitForTimeout(2000);
  await zodPage.getByTestId('ContactRow').first().click();
  await zodPage.getByText('Invite 1 and continue').click();

  // Navigate back to group
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(zodPage);

  // Step 2: ~bus accepts the invite

  // Wait for and accept the group invitation
  await zodPage.waitForTimeout(5000);
  await busPage.waitForTimeout(5000);
  await expect(busPage.getByText('Group invitation')).toBeVisible();
  await busPage.getByText('Group invitation').click();

  // If there's an accept invitation button, click it
  if (await busPage.getByText('Accept invite').isVisible()) {
    await busPage.getByText('Accept invite').click();
  }

  await busPage.waitForSelector('text=Joining, please wait...');

  await busPage.waitForSelector('text=Go to group', { state: 'visible' });

  if (await busPage.getByText('Go to group').isVisible()) {
    await busPage.getByText('Go to group').click();
  } else {
    await busPage.getByText('~bus, ~zod').click();
  }

  // Navigate to the General channel
  await busPage.getByTestId('ChannelListItem-General').click();

  // Wait for the mismatch notice to appear on ~bus
  await expect(
    busPage.getByTestId('read-only-notice-channel-mismatch')
  ).toBeVisible();

  // Verify the message about protocol mismatch is displayed
  await expect(
    busPage.getByText(
      "Your node's version of the Tlon app doesn't match the channel host."
    )
  ).toBeVisible();
});
