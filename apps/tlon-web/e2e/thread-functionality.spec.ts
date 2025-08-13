import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test comprehensive thread functionality', async ({ zodPage }) => {
  const page = zodPage;

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Send a message in the General channel
  await helpers.sendMessage(page, 'Hello, world!');

  // Verify message preview is visible
  await helpers.verifyMessagePreview(page, 'Hello, world!', false, 'General');

  // Start a thread from the message
  await helpers.startThread(page, 'Hello, world!');

  // Send a reply in the thread
  await helpers.sendThreadReply(page, 'Thread reply');

  // React to the thread reply with thumb emoji
  await helpers.reactToMessage(page, 'Thread reply', 'thumb');

  // Un-react to the message
  await helpers.removeReaction(page, '👍');

  // Quote-reply within the thread context
  await helpers.threadQuoteReply(page, 'Thread reply', 'Quote reply');

  // Send a message and report it (in thread)
  await helpers.sendThreadReply(page, 'Report this reply');
  if (await page.getByText('Report this reply', { exact: true }).isVisible()) {
    await helpers.reportMessage(page, 'Report this reply');
  }

  // Send a message and delete it (in thread)
  await helpers.sendThreadReply(page, 'Delete this reply');
  await helpers.deleteMessage(page, 'Delete this reply');

  // Send a message and edit it (in thread)
  await helpers.sendThreadReply(page, 'Edit this reply');
  await helpers.editMessage(page, 'Edit this reply', 'Edited reply', true);

  // Verify the edited message is visible
  await expect(page.getByText('Edited reply', { exact: true })).toBeVisible();

  // Navigate back to the main channel
  await helpers.navigateBack(page);
});

test('should test cross-ship thread functionality', async ({
  zodPage,
  tenPage,
}) => {
  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Create a new group as ~zod
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText(groupName).first()).toBeVisible({
      timeout: 5000,
    });
    await zodPage.getByText(groupName).first().click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Send initial message as ~zod
  await helpers.sendMessage(zodPage, 'Cross-ship thread test message');

  // Accept the group invitation as ~ten
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Navigate to General channel
  await helpers.navigateToChannel(tenPage, 'General');

  // Verify ~ten can see the message from ~zod
  await expect(
    tenPage
      .getByTestId('Post')
      .getByText('Cross-ship thread test message', { exact: true })
  ).toBeVisible();

  // Start a thread from the message (as ~zod)
  await helpers.startThread(zodPage, 'Cross-ship thread test message');

  // Send a reply in the thread
  await helpers.sendThreadReply(zodPage, 'Reply from zod');

  // Navigate back to channel to check thread indicator
  await helpers.navigateBack(zodPage);
  await expect(zodPage.getByText('1 reply')).toBeVisible();

  // TEN: Verify thread indicator is visible
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });

  // TEN: Navigate to the same thread and verify zod's reply is visible
  await tenPage.getByText('1 reply').click();
  await expect(tenPage.getByText('Reply from zod')).toBeVisible();

  // TEN: Send a reply in the thread
  await helpers.sendThreadReply(tenPage, 'Reply from ten');

  // ZOD: Navigate back to thread and verify ten's reply is visible
  await zodPage.getByText('2 replies').click();
  await expect(zodPage.getByText('Reply from ten')).toBeVisible({
    timeout: 10000,
  });

  // ZOD: React to ten's message with heart emoji
  await helpers.reactToMessage(zodPage, 'Reply from ten', 'heart');

  // TEN: Verify the reaction from zod is visible (cross-ship sync)
  await expect(tenPage.getByText('❤️')).toBeVisible({ timeout: 15000 });

  // TEN: Edit their own message
  await helpers.editMessage(
    tenPage,
    'Reply from ten',
    'Edited reply from ten',
    true
  );

  // ZOD: Wait for sync and verify the edited message is visible
  // Reload the page to ensure sync, similar to DM test pattern
  await zodPage.reload();
  // Navigate back to the group and channel context
  await expect(zodPage.getByText(groupName).first()).toBeVisible({
    timeout: 10000,
  });
  await zodPage.getByText(groupName).first().click();
  await helpers.navigateToChannel(zodPage, 'General');
  await expect(zodPage.getByText('2 replies')).toBeVisible({ timeout: 10000 });
  await zodPage.getByText('2 replies').click();
  await expect(
    zodPage
      .getByTestId('Post')
      .getByText('Edited reply from ten', { exact: true })
  ).toBeVisible({ timeout: 15000 });

  // ZOD: Add another reaction to the edited message
  await helpers.reactToMessage(zodPage, 'Edited reply from ten', 'thumb');

  // TEN: Navigate back to main channel, then to thread to react to zod's message
  await helpers.navigateBack(tenPage);
  await expect(tenPage.getByText('2 replies')).toBeVisible({ timeout: 10000 });
  await tenPage.getByText('2 replies').click();
  await expect(tenPage.getByText('Reply from zod')).toBeVisible({
    timeout: 5000,
  });

  // TEN: Add a reaction to zod's original message
  await helpers.reactToMessage(tenPage, 'Reply from zod', 'laughing');

  // ZOD: Verify the reaction from ten is visible
  await expect(zodPage.getByText('😆')).toBeVisible({ timeout: 15000 });

  // Both ships navigate back to channel and verify thread count
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(tenPage);

  // Verify both ships see updated thread count (2 replies)
  await expect(zodPage.getByText('2 replies')).toBeVisible();
  await expect(tenPage.getByText('2 replies')).toBeVisible();

  // ZOD: Quote-reply to ten's edited message
  await zodPage.getByText('2 replies').click();
  await helpers.threadQuoteReply(
    zodPage,
    'Edited reply from ten',
    'Quote reply to edited message'
  );

  // TEN: Navigate to thread and verify the quote reply is visible
  await tenPage.getByText('2 replies').click();
  await expect(tenPage.getByText('Quote reply to edited message')).toBeVisible({
    timeout: 10000,
  });

  // Verify both ships can see the full thread history
  await expect(zodPage.getByText('Reply from zod').first()).toBeVisible();
  await expect(
    zodPage.getByText('Edited reply from ten').first()
  ).toBeVisible();
  await expect(
    zodPage.getByText('Quote reply to edited message').first()
  ).toBeVisible();

  await expect(tenPage.getByText('Reply from zod').first()).toBeVisible();
  await expect(
    tenPage.getByText('Edited reply from ten').first()
  ).toBeVisible();
  await expect(
    tenPage.getByText('Quote reply to edited message').first()
  ).toBeVisible();
});
