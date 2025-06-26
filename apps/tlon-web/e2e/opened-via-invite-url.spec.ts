import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ permissions: ['clipboard-write', 'clipboard-read'] });

test.only('should generate an invite link and view that invite from another ship', async ({
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
    await zodPage.waitForTimeout(10000);
    await helpers.clickThroughWelcome(zodPage);
    await zodPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Create a new group, get it's ID, give it a name
    await helpers.createGroup(zodPage);
    await helpers.navigateBack(zodPage);
    if (await zodPage.getByText('Home').isVisible()) {
      await expect(zodPage.getByText('Untitled group')).toBeVisible();
      await zodPage.getByText('Untitled group').click();
      await expect(zodPage.getByText('Untitled group').first()).toBeVisible();
    }

    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Reference').click();
    const referenceText: string = await zodPage.evaluate(
      'navigator.clipboard.readText()'
    );
    const invitedGroupId = `~zod/${referenceText.split('/').pop()}`;
    console.log('bl: referenceText', referenceText);
    await helpers.navigateBack(zodPage);

    await zodPage.waitForTimeout(2000);
    await helpers.openGroupCustomization(zodPage);
    await helpers.changeGroupName(zodPage, 'Invite Test');

    // Confirm it generated an invite link for the group
    await zodPage.waitForTimeout(4000);
    await zodPage.getByText('Invite Friends').click();
    const clipboardText: string = await zodPage.evaluate(
      'navigator.clipboard.readText()'
    );
    expect(clipboardText).toContain('join.tlon.io');
    const token = clipboardText.split('/').pop();
    expect(token).toBeDefined();

    // mock the provider response
    await tenPage.route(
      `https://loshut-lonreg.tlon.network/lure/${token}/metadata`,
      async (route) => {
        const json = {
          fields: {
            'bite-type': '2',
            invitedGroupId,
            image: '',
            title: 'Invite Test',
            cover: '',
            description: '',
            inviterNickname: '',
            group: invitedGroupId,
            inviter: '~zod',
            inviterUserId: '~zod',
            inviterColor: '#C4E814',
            inviterAvatarImage: '',
          },
          tag: 'groups-0',
        };
        await route.fulfill({ json });
      }
    );

    // Initialize the other ship
    const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;
    await tenPage.goto(tenUrl);
    await tenPage.waitForTimeout(10000);
    await helpers.clickThroughWelcome(tenPage);
    await tenPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Confirm visiting an invite link works
    const tenInviteUrl = `${shipManifest['~ten'].webUrl}/apps/groups/?inviteToken=${token}`;
    await tenPage.goto(tenInviteUrl);
    await tenPage.waitForTimeout(10000);
    expect(tenPage.getByText('Invite Test')).toBeVisible();
  } finally {
    // Clean up - delete the group from zod's side
    try {
      await helpers.cleanupExistingGroup(zodPage, 'Invite Test');
      await helpers.cleanupExistingGroup(zodPage);
    } catch (error) {
      console.log('Cleanup failed:', error);
    }
  }
});
