import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const busUrl = `${shipManifest['~bus'].webUrl}/apps/groups/`;

test('should invite ~bus to a group and test protocol mismatch', async ({
  browser,
}) => {
  // Create two browser contexts - one for ~zod (group creator) and one for ~bus (invitee)
  const zodContext = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  const busContext = await browser.newContext({
    storageState: shipManifest['~bus'].authFile,
  });

  const zodPage = await zodContext.newPage();
  const busPage = await busContext.newPage();

  try {
    // Step 0: Clean up any existing invites on ~bus
    await busPage.goto(busUrl);
    await helpers.clickThroughWelcome(busPage);
    await busPage.evaluate(() => {
      window.toggleDevTools();
    });
    await helpers.rejectGroupInvite(busPage);

    // Step 1: ~zod creates a group and invites ~bus
    await zodPage.goto(zodUrl);
    await helpers.clickThroughWelcome(zodPage);
    await zodPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Clean up any existing group on zod
    await helpers.cleanupExistingGroup(zodPage);
    await helpers.cleanupExistingGroup(zodPage, '~bus, ~zod');

    // Create a new group on zod
    await helpers.createGroup(zodPage);

    // Open group settings to invite ~bus
    await helpers.openGroupSettings(zodPage);

    // Invite ~bus to the group
    await zodPage.getByText('Invite people').click();
    await expect(zodPage.getByText('Select people to invite')).toBeVisible();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~bus');
    await zodPage.getByTestId('ContactRow').first().click();
    await zodPage.getByText('Invite 1 and continue').click();

    // Navigate back to group
    await helpers.navigateBack(zodPage);
    await helpers.navigateBack(zodPage);

    // Step 2: ~bus accepts the invite

    // Wait for and accept the group invitation
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
  } finally {
    // Clean up - delete the group from zod's side
    await zodPage.getByText('~bus, ~zod').click();
    await helpers.openGroupSettings(zodPage);
    await helpers.deleteGroup(zodPage, '~bus, ~zod');

    // Close contexts
    await zodContext.close();
    await busContext.close();
  }
});
