import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('Forward chat message from group channel to DM - verify toast and reference message', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing groups and DMs
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');
  if (await zodPage.getByText('~ten', { exact: true }).isVisible()) {
    await helpers.leaveDM(zodPage, '~ten');
  }

  // Create DM between ~zod and ~ten
  await helpers.createDirectMessage(zodPage, '~ten');
  await zodPage.getByTestId('HomeNavIcon').click();

  // Create a test group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod'; // Group name updates after inviting members

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  // Navigate back to the main channel view after inviting members
  await zodPage.getByTestId('HomeNavIcon').click();

  if (await zodPage.getByText('Home').isVisible()) {
    // Wait for the group to be available
    await zodPage.waitForTimeout(2000);

    // Click on the group (it stays as "Untitled group")
    await expect(zodPage.getByText(groupName).first()).toBeVisible({
      timeout: 10000,
    });
    await zodPage.getByText(groupName).first().click();

    // Wait for group to load by checking for a non-loading header
    await expect(
      zodPage
        .getByTestId('ScreenHeaderTitle')
        .filter({ hasNotText: 'Loading…' })
    ).toBeVisible({
      timeout: 5000,
    });
  }

  // Test message content
  const testMessage = 'This is a test chat message to forward to DM';

  // Step 1: ~zod sends message in group channel
  await helpers.sendMessage(zodPage, testMessage);

  // Verify message is visible
  await expect(
    zodPage.getByTestId('Post').getByText(testMessage)
  ).toBeVisible();

  // Step 2: ~zod forwards the message to DM with ~ten
  await helpers.forwardMessageToDM(zodPage, testMessage, '~ten');

  // Step 3: Verify toast appears on ~zod's screen
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();
  await expect(zodPage.getByText('Forwarded post to ~ten')).toBeVisible();

  // Wait for the group invitation and accept it
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Group invitation')).toBeVisible();
  await tenPage.getByText('Group invitation').click();

  // Accept the invitation
  if (await tenPage.getByText('Accept invite').isVisible()) {
    await tenPage.getByText('Accept invite').click();
  }

  // Wait for joining process and go to group
  await tenPage.waitForSelector('text=Joining, please wait...');
  await tenPage.waitForSelector('text=Go to group', { state: 'visible' });

  if (await tenPage.getByText('Go to group').isVisible()) {
    await tenPage.getByText('Go to group').click();
    // Wait a moment for navigation to complete
    await tenPage.waitForTimeout(2000);
  } else {
    await tenPage.getByText(groupName).first().click();
  }

  // Navigate back to Home to access DMs
  await tenPage.getByTestId('HomeNavIcon').click();

  // Navigate to DM with ~zod to check forwarded message
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible();
  await tenPage.getByTestId('ChannelListItem-~zod').click();

  await tenPage.waitForTimeout(1000);

  // Step 4: ~ten verifies forwarded message appears as a reference/citation
  // Verify message is visible
  await expect(
    tenPage.getByTestId('Post').getByText(testMessage)
  ).toBeVisible();

  // Verify it shows as a forwarded/referenced message
  await expect(tenPage.getByText('Chat Post').first()).toBeVisible();
  await expect(tenPage.locator('text=' + testMessage).first()).toBeVisible();
});
