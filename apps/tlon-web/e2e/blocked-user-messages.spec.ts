import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should hide messages from blocked users in a group channel', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await zodPage.waitForTimeout(1000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
    await zodPage.getByText(groupName).first().click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // ~zod sends a message in the General channel
  await helpers.sendMessage(zodPage, 'Hello from zod');

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Open the General channel
  await helpers.navigateToChannel(tenPage, 'General');

  // Wait for ~zod's message to be visible to ensure channel is fully loaded
  await expect(
    tenPage.getByTestId('Post').getByText('Hello from zod', { exact: true })
  ).toBeVisible({ timeout: 15000 });

  // Verify ~ten can see ~zod's message before blocking
  await expect(tenPage.getByText('Hello from zod').first()).toBeVisible();

  // Navigate to Home before blocking user
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // ~ten blocks ~zod (blockUser automatically adds as contact if needed and returns to Home)
  await helpers.blockUser(tenPage, '~zod');

  // Navigate to the group from Home
  await tenPage.waitForTimeout(1000);
  await expect(tenPage.getByText(groupName).first()).toBeVisible();
  await tenPage.getByText(groupName).first().click();
  await expect(tenPage.getByText(groupName).first()).toBeVisible();

  // Open the General channel
  await helpers.navigateToChannel(tenPage, 'General');

  // Wait for UI to reflect the blocking state
  await tenPage.waitForTimeout(2000);

  // Verify that ~ten can no longer see ~zod's message content in the channel (not sidebar)
  await expect(
    tenPage.getByTestId('Post').getByText('Hello from zod').first()
  ).not.toBeVisible();

  // Verify the blocked message placeholder is shown
  await expect(
    tenPage.getByText('Message from a blocked user.').first()
  ).toBeVisible();

  // Verify the "Show anyway" button is present
  await expect(
    tenPage.getByTestId('ShowBlockedMessageButton').first()
  ).toBeVisible();

  // Click "Show anyway" to temporarily reveal the message
  await tenPage.getByTestId('ShowBlockedMessageButton').first().click();

  // Verify the message is now visible
  await expect(
    tenPage.getByTestId('Post').getByText('Hello from zod').first()
  ).toBeVisible();

  // Navigate away and back to verify the message is hidden again
  await tenPage.getByTestId('HomeNavIcon').click();
  await tenPage.waitForTimeout(1000);
  await expect(tenPage.getByText(groupName).first()).toBeVisible();
  await tenPage.getByText(groupName).first().click();
  await helpers.navigateToChannel(tenPage, 'General');

  // Verify the message is hidden again after navigation
  await expect(
    tenPage.getByTestId('Post').getByText('Hello from zod').first()
  ).not.toBeVisible();
  await expect(
    tenPage.getByText('Message from a blocked user.').first()
  ).toBeVisible();

  // Clean up: ~ten unblocks ~zod and removes contact
  await helpers.unblockUser(tenPage, '~zod');
  await helpers.removeContact(tenPage, '~zod');
});
