import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should clear DM thread unreads while user is viewing the thread', async ({
  zodPage,
  tenPage,
}) => {
  test.setTimeout(120000); // 2 minutes for cross-ship DM operations

  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // ~zod creates a DM with ~ten
  await helpers.createDirectMessage(zodPage, '~ten');
  await helpers.sendMessage(zodPage, 'DM thread unread test parent message');

  if (await helpers.isMobileViewport(zodPage)) {
    await helpers.navigateBack(zodPage);
  }

  // ~ten receives and accepts the DM
  await tenPage.reload();
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible({
    timeout: 15000,
  });
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  await expect(
    tenPage.getByText('DM thread unread test parent message').first()
  ).toBeVisible({ timeout: 10000 });
  await expect(tenPage.getByText('Accept')).toBeVisible({ timeout: 5000 });
  await tenPage.getByText('Accept').click();
  await expect(tenPage.getByTestId('MessageInput')).toBeVisible({
    timeout: 10000,
  });

  // ~zod starts a thread on the message
  await zodPage.getByTestId('ChannelListItem-~ten').click();
  await expect(
    zodPage.getByText('DM thread unread test parent message').first()
  ).toBeVisible({ timeout: 10000 });
  await helpers.startThread(zodPage, 'DM thread unread test parent message');
  await helpers.sendThreadReply(zodPage, 'Initial DM thread reply from zod');

  // ~zod stays in the thread — this is the key setup for the bug fix test
  await expect(
    zodPage.getByText('Initial DM thread reply from zod').first()
  ).toBeVisible();

  // ~ten sees the thread indicator
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 20000 });

  // ~ten enters the thread and sends a reply WHILE ~zod is still viewing it
  await tenPage.getByText('1 reply').click();
  await expect(
    tenPage.getByText('Initial DM thread reply from zod').first()
  ).toBeVisible({ timeout: 5000 });
  await helpers.sendThreadReply(tenPage, 'DM reply while zod views thread');

  // ~zod should see the new reply arrive in the thread they're viewing
  await expect(
    zodPage.getByText('DM reply while zod views thread').first()
  ).toBeVisible({ timeout: 15000 });

  // ~zod navigates back to the DM view
  await helpers.navigateBack(zodPage);

  // The critical assertion: the parent message should NOT show a thread unread dot.
  // Before the fix, the unread dot would persist because useMarkThreadAsReadEffect
  // never re-fired while the user was already viewing the thread.
  const parentMessage = zodPage
    .getByTestId('Post')
    .filter({ hasText: 'DM thread unread test parent message' });
  await expect(parentMessage).toBeVisible({ timeout: 10000 });
  await expect(parentMessage.getByTestId('ThreadUnreadDot')).not.toBeVisible({
    timeout: 15000,
  });
});
