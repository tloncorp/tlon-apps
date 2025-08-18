import { expect } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';
import { test } from './test-fixtures';

test.use({ permissions: ['clipboard-write', 'clipboard-read'] });

test('should generate an invite link and be able to redeem group/personal invites', async ({
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
  await helpers.setGroupPrivacy(zodPage, 'public');

  await helpers.openGroupSettings(zodPage);
  await helpers.navigateBack(zodPage);

  await expect(zodPage.getByText('Invite Friends')).toBeVisible({
    timeout: 15000,
  });

  await zodPage.getByText('Invite Friends').click();

  const clipboardText: string = await zodPage.evaluate(
    'navigator.clipboard.readText()'
  );
  expect(clipboardText).toContain('join.tlon.io');
  const token = clipboardText.split('/').pop();
  expect(token).toBeDefined();

  // Grab zod's personal invite token
  await zodPage.getByTestId('PersonalInviteNavIcon').click();
  await zodPage.getByText('Share Invite Link').click();
  const zodClipboardText: string = await zodPage.evaluate(
    'navigator.clipboard.readText()'
  );
  const zodPersonalInviteToken = zodClipboardText.split('/').pop();
  // Reload closes the dialog. TODO: find a better way to do this.
  await zodPage.reload();

  // Confirm you receive an group invite after clicking a group invite link
  const tenInviteUrl = `${shipManifest['~ten'].webUrl}/apps/groups/Home?inviteToken=${token}`;
  await tenPage.goto(tenInviteUrl);
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Accept invite')).toBeVisible();

  // Confirm you open the contact profile after clicking a user invite link
  const tenUserInviteUrl = `${shipManifest['~ten'].webUrl}/apps/groups/Home?inviteToken=${zodPersonalInviteToken}`;
  await tenPage.goto(tenUserInviteUrl);
  await tenPage.waitForTimeout(6000);
  await expect(tenPage.getByText('Remove contact')).toBeVisible();
  
  // Clean up: Remove ~zod from ~ten's contacts to prevent test pollution
  await tenPage.getByText('Remove contact').click();
  await tenPage.waitForTimeout(1000);
  // Verify the contact was removed
  await expect(tenPage.getByText('Remove contact')).not.toBeVisible();
});
