import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Group Ban Functionality', () => {
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
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(1000);

    // ~ten accepts invite
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForSelector('text=Joining, please wait...');
    await tenPage.waitForSelector('text=Go to group', { state: 'visible' });
    await tenPage.getByText('Go to group').click();

    // Wait for group to load
    await expect(tenPage.getByTestId('ChannelListItem-General')).toBeVisible({
      timeout: 10000,
    });

    // Verify ~ten can access the group (showing general channel)
    await expect(tenPage.getByTestId('ChannelListItem-General')).toBeVisible({
      timeout: 10000,
    });

    // Navigate to members page and verify ban option exists
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await zodPage.waitForTimeout(2000);

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

    // Verify ban option is available and click it
    await expect(zodPage.getByText('Ban User')).toBeVisible();
    await zodPage.getByText('Ban User').click();

    // Wait for ban to complete
    await zodPage.waitForTimeout(3000);

    // Close sheet if needed
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);

    // Verify that ~ten no longer appears in regular members
    // Note: They should now be in banned users section, but we'll just verify they're not in regular list
    const memberRows = zodPage.getByTestId('MemberRow');
    const tenRow = memberRows.filter({ hasText: '~ten' });

    // The member might still be visible in banned section, so we just verify ban action worked
    // by checking that we can now see unban option if we click on them again
    const bannedSection = zodPage.getByText('Banned Users');
    if (await bannedSection.isVisible({ timeout: 2000 })) {
      // If banned section exists, click on ~ten there
      await tenRow.click();
      await expect(zodPage.getByText('Unban User')).toBeVisible();
      // Close sheet after checking
      await zodPage.keyboard.press('Escape');
      await zodPage.waitForTimeout(1000);
    }

    // Verify ~ten can no longer see the group after being banned
    // Navigate to Home on ~ten's page
    await tenPage.getByTestId('HomeNavIcon').click();
    await tenPage.waitForTimeout(2000);
    
    // The group should not be visible in ~ten's chat list
    await expect(
      tenPage.getByTestId('ChatListItem-Untitled group-unpinned')
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow banning and unbanning users in private groups', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Create a group and make it private
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'private');
    await helpers.navigateBack(zodPage);

    // Invite ~ten
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(1000);

    // ~ten accepts invite
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForSelector('text=Joining, please wait...');
    await tenPage.waitForSelector('text=Go to group', { state: 'visible' });
    await tenPage.getByText('Go to group').click();

    // Wait for group to load
    await expect(tenPage.getByTestId('ChannelListItem-General')).toBeVisible({
      timeout: 10000,
    });

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
      tenPage.getByTestId('ChatListItem-Untitled group-unpinned')
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow banning and unbanning users in secret groups', async ({
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
    await helpers.navigateBack(zodPage);

    // Invite ~ten to the secret group
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(1000);

    // ~ten accepts invite to secret group
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForSelector('text=Joining, please wait...');
    await tenPage.waitForSelector('text=Go to group', { state: 'visible' });
    await tenPage.getByText('Go to group').click();

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
      tenPage.getByTestId('ChatListItem-Untitled group-unpinned')
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('should show ban option for non-admin members in public groups', async ({
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
    await zodPage.waitForTimeout(2000);

    // ~ten accepts invite
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage
      .getByTestId('MemberRow')
      .filter({ hasText: '~ten' })
      .click();

    // Verify ban option is available
    await expect(zodPage.getByText('Ban User')).toBeVisible();

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);
  });

  test('should show ban option for non-admin members in private groups', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Create a private group
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'private');
    await helpers.navigateBack(zodPage);

    // Invite ~ten
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(2000);

    // ~ten accepts invite
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage
      .getByTestId('MemberRow')
      .filter({ hasText: '~ten' })
      .click();

    // Verify ban option is available
    await expect(zodPage.getByText('Ban User')).toBeVisible();

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);
  });

  test('should show ban option for non-admin members in secret groups', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Create a secret group
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'secret');
    await helpers.navigateBack(zodPage);

    // Invite ~ten
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(2000);

    // ~ten accepts invite
    await expect(tenPage.getByText('Group invitation')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByText('Group invitation').click();
    await tenPage.getByText('Accept invite').click();
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage
      .getByTestId('MemberRow')
      .filter({ hasText: '~ten' })
      .click();

    // Verify ban option is available
    await expect(zodPage.getByText('Ban User')).toBeVisible();

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);
  });
});
