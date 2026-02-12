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

  // Navigate back to Home and navigate to group using stable testID
  await helpers.navigateBack(zodPage);
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Navigate ~ten to home BEFORE message is sent (so it will be unread)
  await tenPage.getByTestId('HomeNavIcon').click();
  await tenPage.waitForTimeout(1000);
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Wait for the group to appear in the home list (group sync)
  await expect(
    tenPage.getByTestId('GroupListItem-Untitled group-unpinned')
  ).toBeVisible({ timeout: 15000 });

  // Send a message from ~zod to create unread
  await helpers.sendMessage(zodPage, 'Unread message test');

  // Wait for cross-ship message sync
  await tenPage.waitForTimeout(2000);

  // Verify unread count on ~ten's side
  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 1, false, true);

  // Send another message to test count increment
  await helpers.sendMessage(zodPage, 'Second unread message');

  // Wait for cross-ship message sync
  await tenPage.waitForTimeout(2000);

  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 2, false, true);

  // Navigate to the group as ~ten to clear unread count
  await tenPage.getByText(groupName).first().click();
  await expect(tenPage.getByText(groupName).first()).toBeVisible();

  // Navigate back to home and verify unread count is cleared
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.verifyChatUnreadCount(tenPage, 'Untitled group', 0, false, true);
});
