import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should clear thread unreads while user is viewing the thread', async ({
  zodSetup,
  tenSetup,
}) => {
  test.setTimeout(120000); // 2 minutes for cross-ship group operations

  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Create a new group as ~zod
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and into the group
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(
      zodPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 5000 });
    await zodPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Send initial message as ~zod with distinctive text for selector scoping
  await helpers.sendMessage(zodPage, 'Thread unread test parent message');

  // Accept the group invitation as ~ten
  await helpers.acceptGroupInvite(tenPage, groupName);
  await helpers.navigateToChannel(tenPage, 'General');

  // Verify ~ten can see the message from ~zod
  await expect(
    tenPage
      .getByTestId('Post')
      .getByText('Thread unread test parent message', { exact: true })
  ).toBeVisible({ timeout: 10000 });

  // ~zod starts a thread on the message
  await helpers.startThread(zodPage, 'Thread unread test parent message');
  await helpers.sendThreadReply(zodPage, 'Initial thread reply from zod');

  // ~zod stays in the thread — this is the key setup for the bug fix test
  // Verify ~zod is in the thread view
  await expect(
    zodPage.getByText('Initial thread reply from zod').first()
  ).toBeVisible();

  // ~ten sees the thread indicator and enters the thread
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 15000 });

  // ~ten sends a reply WHILE ~zod is still viewing the thread
  // This is the exact scenario that triggered the bug: the new reply should
  // be auto-marked as read because ~zod is actively viewing the thread.
  await tenPage.getByText('1 reply').click();
  await expect(
    tenPage.getByText('Initial thread reply from zod').first()
  ).toBeVisible({ timeout: 5000 });
  await helpers.sendThreadReply(tenPage, 'New reply while zod views thread');

  // ~zod should see the new reply arrive in the thread they're viewing
  await expect(
    zodPage.getByText('New reply while zod views thread').first()
  ).toBeVisible({ timeout: 15000 });

  // ~zod navigates back to the channel view
  await helpers.navigateBack(zodPage);

  // The critical assertion: the parent message should NOT show a thread unread dot.
  // Before the fix, the unread dot would persist because useMarkThreadAsReadEffect
  // never re-fired while the user was already viewing the thread.
  const parentMessage = zodPage
    .getByTestId('Post')
    .filter({ hasText: 'Thread unread test parent message' });
  await expect(parentMessage).toBeVisible({ timeout: 10000 });
  await expect(parentMessage.getByTestId('ThreadUnreadDot')).not.toBeVisible({
    timeout: 15000,
  });
});
