import { expect } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';
import { test } from './test-fixtures';

test.use({ permissions: ['clipboard-write', 'clipboard-read'] });

test.skip(true);

test('should generate an invite link and be able to redem group/personal invites', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Step 1: ~zod creates a group and makes various changes
  await helpers.cleanupExistingGroup(zodPage, 'Invite Test');

  // Create a new group, get it's ID, give it a name
  await helpers.createGroup(zodPage);
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText('Untitled group')).toBeVisible();
    await zodPage.getByText('Untitled group').click();
    await expect(zodPage.getByText('Untitled group').first()).toBeVisible();
  }

  await helpers.openGroupCustomization(zodPage);
  await helpers.changeGroupName(zodPage, 'Invite Test');

  await helpers.openGroupSettings(zodPage);
  await helpers.setGroupPrivacy(zodPage, false);

  await helpers.openGroupSettings(zodPage);
  await zodPage.getByText('Reference').click();
  await helpers.navigateBack(zodPage);

  // Confirm it generated an invite link for the group
  await zodPage.waitForTimeout(10000);
  await zodPage.getByText('Invite Friends').click();
  const clipboardText: string = await zodPage.evaluate(
    'navigator.clipboard.readText()'
  );
  expect(clipboardText).toContain('join.tlon.io');
  const token = clipboardText.split('/').pop();
  expect(token).toBeDefined();

  // Initialize the other ship
  const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;
  await tenPage.goto(tenUrl);
  await tenPage.waitForSelector('text=Home', { state: 'visible' });
  await tenPage.evaluate(() => {
    window.toggleDevTools();
  });

  // Confirm you receive an group invite after clicking a group invite link
  const tenInviteUrl = `${shipManifest['~ten'].webUrl}/apps/groups/Home?inviteToken=${token}`;
  await tenPage.goto(tenInviteUrl);
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Accept invite')).toBeVisible();

  // Confirm you open the contact profile after clicking a user invite link
  const busPersonalInviteToken = '0v4.u1ijr.399a5.j472m.2nj24.c5q9k';
  const tenUserInviteUrl = `${shipManifest['~ten'].webUrl}/apps/groups/Home?inviteToken=${busPersonalInviteToken}`;
  await tenPage.goto(tenUserInviteUrl);
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Remove contact')).toBeVisible();

  // Clean up - delete the group from zod's side
  try {
    await helpers.cleanupExistingGroup(zodPage, 'Invite Test');
  } catch (error) {
    console.log('Cleanup failed:', error);
  }
});
