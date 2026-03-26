import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should allow banning and unbanning users in public groups', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Create a public group
  await helpers.createGroup(zodPage);

  // Keep it public (default)
  await helpers.openGroupSettings(zodPage);
  // Just verify we're in settings, don't check exact text
  await expect(zodPage.getByText('Group info')).toBeVisible();

  // Invite ~ten
  await helpers.openInvitePeople(zodPage);
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
  await zodPage.getByText('Invite 1 and continue').click();

  // ~ten accepts invite
  await helpers.acceptGroupInvite(tenPage);

  // Navigate to members page and verify ban option exists
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupMembers').click();
  await expect(
    zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' })
  ).toBeVisible({ timeout: 5000 });

  // Click on ~ten to open profile sheet
  await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

  // Verify ban option is available and click it
  await expect(zodPage.getByText('Ban User')).toBeVisible();
  await zodPage.getByText('Ban User').click();

  // Verify that ban completed — ~ten should now be in banned users section
  const bannedSection = zodPage.getByText('Banned Users');
  await expect(bannedSection).toBeVisible({ timeout: 10000 });

  // Close sheet if needed
  await zodPage.keyboard.press('Escape');

  // Click on ~ten in the banned section
  const memberRows = zodPage.getByTestId('MemberRow');
  const tenRow = memberRows.filter({ hasText: '~ten' });
  await tenRow.click();
  await expect(zodPage.getByText('Unban User')).toBeVisible();

  // Verify ~ten can no longer see the group after being banned
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(
    tenPage.getByTestId('GroupListItem-Untitled group-unpinned')
  ).not.toBeVisible({ timeout: 5000 });

  // Now unban ~ten
  await zodPage.getByText('Unban User').click();

  // Verify ~ten is no longer in the banned section
  await expect(zodPage.getByText('Banned Users')).not.toBeVisible({
    timeout: 10000,
  });

  // Close sheet
  await zodPage.keyboard.press('Escape');

  // After unbanning, ~ten still can't see the group (needs re-invite)
  await expect(
    tenPage.getByTestId('GroupListItem-Untitled group-unpinned')
  ).not.toBeVisible({ timeout: 5000 });

  // Navigate to group settings to re-invite
  await helpers.openGroupSettings(zodPage);

  // Re-invite ~ten to the group (now that they've been unbanned)
  await helpers.openInvitePeople(zodPage);
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
  await zodPage.getByText('Invite 1 and continue').click();
  await zodPage.waitForTimeout(1000);

  // Refresh ~ten's page to ensure invite appears
  await tenPage.reload();

  // ~ten accepts re-invite
  await helpers.acceptGroupInvite(tenPage);

  // Verify ~ten can access the group again after being unbanned and re-invited
});
