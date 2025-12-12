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

  // Create DM between ~zod and ~ten
  await helpers.createDirectMessage(zodPage, '~ten');

  // Wait for DM to load
  await expect(zodPage.getByTestId('ChannelListItem-~ten')).toBeVisible({
    timeout: 10000,
  });

  // Send a message to ~ten
  await helpers.sendMessage(zodPage, 'This is a test message to ~ten');

  // Navigate to Home
  await zodPage.getByTestId('HomeNavIcon').click();

  // Accept the DM on ~ten's side
  await tenPage.reload();
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible({ timeout: 10000 });
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  await tenPage.getByText('Accept').click();
  await expect(tenPage.getByText('Accept')).not.toBeVisible({
    timeout: 10000,
  });

  // Navigate to Home on ~ten's side
  await tenPage.getByTestId('HomeNavIcon').click();

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
    try {
      await expect(zodPage.getByText(groupName).first()).toBeVisible({
        timeout: 10000,
      });
      await zodPage.getByText(groupName).first().click();
    } catch {
      await expect(zodPage.getByText('Untitled group').first()).toBeVisible({
        timeout: 10000,
      });
      await zodPage.getByText('Untitled group').first().click();
    }

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

  // Wait for the forward operation to complete and sync
  await zodPage.waitForTimeout(3000);

  // Verify the message is visible in the DM on ~zod's side
  await zodPage.getByTestId('HomeNavIcon').click();
  await expect(zodPage.getByTestId('ChannelListItem-~ten')).toBeVisible({
    timeout: 10000,
  });
  await zodPage.getByTestId('ChannelListItem-~ten').click();

  // Wait for DM to load
  await zodPage.waitForTimeout(2000);

  // Verify it shows as a forwarded/referenced message with "Chat Post" header
  await expect(zodPage.getByText('Chat Post')).toBeVisible({ timeout: 10000 });
  // Then verify the actual message content is visible
  await expect(zodPage.getByTestId('Post').getByText(testMessage)).toBeVisible({
    timeout: 10000,
  });

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Navigate back to Home to access DMs
  await tenPage.getByTestId('HomeNavIcon').click();

  // Navigate to DM with ~zod to check forwarded message
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible({
    timeout: 10000,
  });
  await tenPage.getByTestId('ChannelListItem-~zod').click();

  await tenPage.waitForTimeout(1000);

  // Step 4: ~ten verifies forwarded message appears as a reference/citation
  // Verify it shows as a forwarded/referenced message with "Chat Post" header
  await expect(
    tenPage.getByTestId('Post').getByText('Chat Post')
  ).toBeVisible();
  // Then verify the actual message content is visible
  await expect(
    tenPage.getByTestId('Post').getByText(testMessage)
  ).toBeVisible();
});
