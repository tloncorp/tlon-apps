import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Secret Group Reference Display', () => {
  test('should display "Secret Group" title and disabled join button for non-members', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Step 1: Create DM between ~zod and ~ten
    await helpers.createDirectMessage(zodPage, '~ten');
    await helpers.sendMessage(
      zodPage,
      'Setting up DM for group reference test'
    );
    await zodPage.getByTestId('HomeNavIcon').click();

    // Step 2: ~ten accepts the DM
    await tenPage.reload();
    await tenPage.getByTestId('HomeNavIcon').click();
    await expect(tenPage.getByText('Home')).toBeVisible({ timeout: 10000 });
    await tenPage.getByTestId('ChannelListItem-~zod').click();
    await tenPage.getByText('Accept').click();
    await expect(tenPage.getByText('Accept')).not.toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByTestId('HomeNavIcon').click();

    // Step 3: Create a group and set it to secret
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'secret');
    // Navigate back to group settings to access Forward reference
    await helpers.navigateBack(zodPage);
    await expect(zodPage.getByText('Group info')).toBeVisible({ timeout: 5000 });

    // Step 4: Forward group reference to DM with ~ten
    await zodPage.getByText('Forward reference').click();
    await expect(zodPage.getByText('Forward group')).toBeVisible({
      timeout: 5000,
    });
    await zodPage.getByPlaceholder('Search channels').fill('~ten');
    await zodPage.waitForTimeout(2000);
    await zodPage.getByTestId('ChannelListItem-~ten').click();
    await zodPage.getByText('Forward to ~ten').click();
    await expect(zodPage.getByText('Forwarded')).toBeVisible({ timeout: 5000 });

    // Allow cross-ship sync
    await zodPage.waitForTimeout(3000);

    // Step 5: ~ten opens DM and verifies group reference shows "Secret Group"
    await tenPage.getByTestId('ChannelListItem-~zod').click();
    await tenPage.waitForTimeout(2000);

    // Verify "Secret Group" is visible and the original bug text is NOT
    await expect(tenPage.getByText('Secret Group')).toBeVisible({
      timeout: 10000,
    });
    // "New group" was the bug - secret groups without preview were showing this
    await expect(tenPage.getByText('New group')).not.toBeVisible({
      timeout: 2000,
    });
    await expect(tenPage.getByText('Untitled group')).not.toBeVisible({
      timeout: 2000,
    });

    // Step 6: Click reference to open preview sheet
    // Use force click to bypass opacity animation on reference frame
    await tenPage.getByText('Secret Group').click({ force: true });
    await tenPage.waitForTimeout(1000);

    // Verify preview shows correct UI for secret groups
    await expect(
      tenPage.getByTestId('ActionButton-This group is secret')
    ).toBeVisible({ timeout: 5000 });
    await expect(
      tenPage.getByText('You need an invite to join this group')
    ).toBeVisible({ timeout: 5000 });

    // Close the preview sheet to allow cleanup
    await tenPage.keyboard.press('Escape');
    await tenPage.waitForTimeout(500);
  });
});
