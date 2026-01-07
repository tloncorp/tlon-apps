import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Group Ban Privacy-Specific Behaviors', () => {
  test('should allow banning users in private groups', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Create a group and make it private
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'private');
    // setGroupPrivacy now navigates back to group settings automatically

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

    // Verify all members joined
    await helpers.openGroupSettings(zodPage);
    await zodPage.waitForTimeout(1000);

    // Navigate to members page and verify ban option exists
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await zodPage.waitForTimeout(2000);

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

    // Verify ban option is available in private group
    await expect(zodPage.getByText('Ban User')).toBeVisible();
    await zodPage.getByText('Ban User').click();

    // Wait for ban to complete
    await zodPage.waitForTimeout(3000);

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);

    // Verify ~ten can no longer see the group after being banned
    // Navigate to Home on ~ten's page
    await tenPage.getByTestId('HomeNavIcon').click();
    await tenPage.waitForTimeout(2000);

    // The group should not be visible in ~ten's chat list
    await expect(
      tenPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow banning users in secret groups', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Create a group and make it secret
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);

    // Change privacy to secret
    await helpers.setGroupPrivacy(zodPage, 'secret');
    // setGroupPrivacy now navigates back to group settings automatically

    // Invite ~ten to the secret group
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(1000);

    // ~ten accepts invite to secret group
    await helpers.acceptGroupInvite(tenPage);

    // Navigate to members page and verify ban option exists
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await zodPage.waitForTimeout(2000);

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

    // Verify ban option is available in secret group
    await expect(zodPage.getByText('Ban User')).toBeVisible();
    await zodPage.getByText('Ban User').click();

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);

    // Wait for ban to complete
    await zodPage.waitForTimeout(3000);

    // Verify ~ten can no longer see the group after being banned
    // Navigate to Home on ~ten's page
    await tenPage.getByTestId('HomeNavIcon').click();
    await tenPage.waitForTimeout(2000);

    // The group should not be visible in ~ten's chat list
    await expect(
      tenPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).not.toBeVisible({ timeout: 5000 });
  });
});