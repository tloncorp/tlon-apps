import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should allow kicking users from groups', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Create a public group
  await helpers.createGroup(zodPage);

  // Invite ~ten
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByText('Invite people').click();
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);
  await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
  await zodPage.getByText('Invite 1 and continue').click();
  await zodPage.waitForTimeout(1000);

  // ~ten accepts invite
  await helpers.acceptGroupInvite(tenPage);

  // Navigate to members page and kick ~ten
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupMembers').click();
  await zodPage.waitForTimeout(2000);

  // Click on ~ten to open profile sheet
  await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

  // Verify kick option is available and click it
  await expect(zodPage.getByText('Kick User')).toBeVisible();
  
  // Set up dialog handler to accept the confirmation
  zodPage.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Kick');
    expect(dialog.message()).toContain('invalidate all the invitations');
    await dialog.accept();
  });
  
  await zodPage.getByText('Kick User').click();

  // Wait for kick to complete
  await zodPage.waitForTimeout(3000);

  // Close sheet if needed
  await zodPage.keyboard.press('Escape');
  await zodPage.waitForTimeout(1000);

  // Verify ~ten is no longer in the members list
  await expect(
    zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' })
  ).not.toBeVisible({ timeout: 5000 });

  // Verify ~ten can no longer see the group after being kicked
  await tenPage.getByTestId('HomeNavIcon').click();
  await tenPage.waitForTimeout(2000);

  // The group should not be visible in ~ten's chat list
  await expect(
    tenPage.getByTestId('ChatListItem-Untitled group-unpinned')
  ).not.toBeVisible({ timeout: 5000 });

  // Verify that unlike ban, ~ten doesn't appear in a "banned" section
  // Navigate to group settings to check
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupMembers').click();
  await zodPage.waitForTimeout(2000);

  // There should be no "Banned Users" section after a kick (only after ban)
  await expect(zodPage.getByText('Banned Users')).not.toBeVisible({
    timeout: 2000,
  });

  // Navigate back to group settings to re-invite (no unban needed for kicks)
  await helpers.navigateBack(zodPage);
  await helpers.openGroupSettings(zodPage);

  // Re-invite ~ten immediately (no unban required after kick)
  await zodPage.getByText('Invite people').click();
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);
  await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
  await zodPage.getByText('Invite 1 and continue').click();
  await zodPage.waitForTimeout(3000); // Wait for invite to propagate

  // Refresh ~ten's page to ensure invite appears
  await tenPage.reload();
  await tenPage.waitForTimeout(2000);

  // ~ten accepts re-invite
  await helpers.acceptGroupInvite(tenPage);

  // Verify ~ten can access the group again after being kicked and re-invited
});
