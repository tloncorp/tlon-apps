import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should show and clear unread message counts', async ({
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

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Send a message from ~zod to create unread
  await helpers.sendMessage(zodPage, 'Unread message test');

  // Navigate ~ten to home to prepare for unread testing
  // Click the back button to go to Home
  await tenPage.getByTestId('HeaderBackButton').first().click();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Verify unread count on ~ten's side
  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 1);

  // Send another message to test count increment
  await helpers.sendMessage(zodPage, 'Second unread message');
  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 2);

  // Navigate to the group as ~ten to clear unread count
  await tenPage.getByText(groupName).first().click();
  await expect(tenPage.getByText(groupName).first()).toBeVisible();

  // Navigate back to home and verify unread count is cleared
  await tenPage.getByTestId('HeaderBackButton').first().click();
  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 0);
});
