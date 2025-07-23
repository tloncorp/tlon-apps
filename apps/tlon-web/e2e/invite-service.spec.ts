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
  await helpers.setGroupPrivacy(zodPage, false);

  await helpers.openGroupSettings(zodPage);
  await zodPage.getByText('Reference').click();
  await helpers.navigateBack(zodPage);

  // Confirm it generated an invite link for the group
  // Wait for the button to show "Invite Friends" (indicating linkIsReady = true)
  // But also add retry logic since enableGroupLinks might not be complete yet
  let attempts = 0;
  const maxAttempts = 6; // 30 seconds total with 5s intervals
  
  while (attempts < maxAttempts) {
    try {
      // Wait for the button to appear with "Invite Friends" text
      await expect(zodPage.getByText('Invite Friends')).toBeVisible({ timeout: 15000 });
      
      // Try to click - if enableGroupLinks isn't complete, this might fail
      await zodPage.getByText('Invite Friends').click();
      
      // If click succeeded, break out of retry loop
      break;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      console.log(`Invite button click attempt ${attempts} failed, retrying...`);
      await zodPage.waitForTimeout(5000); // Wait 5s before retry (matches useLure refetch interval)
    }
  }
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
});
