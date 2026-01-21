import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Group Ban Option UI Visibility', () => {
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
    await helpers.acceptGroupInvite(tenPage);
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

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
    // setGroupPrivacy now navigates back to group settings automatically

    // Invite ~ten
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(2000);

    // ~ten accepts invite
    await helpers.acceptGroupInvite(tenPage);
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

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
    // setGroupPrivacy now navigates back to group settings automatically

    // Invite ~ten
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByText('Invite people').click();
    await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodPage.waitForTimeout(1000);
    await zodPage.getByTestId('ContactRow').getByText('~ten').first().click();
    await zodPage.getByText('Invite 1 and continue').click();
    await zodPage.waitForTimeout(2000);

    // ~ten accepts invite
    await helpers.acceptGroupInvite(tenPage);
    await tenPage.waitForTimeout(3000);

    // Verify that ~zod (admin) can see ban option for regular members
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();

    // Click on ~ten to open profile sheet
    await zodPage.getByTestId('MemberRow').filter({ hasText: '~ten' }).click();

    // Verify ban option is available
    await expect(zodPage.getByText('Ban User')).toBeVisible();

    // Close sheet
    await zodPage.keyboard.press('Escape');
    await zodPage.waitForTimeout(1000);
  });
});