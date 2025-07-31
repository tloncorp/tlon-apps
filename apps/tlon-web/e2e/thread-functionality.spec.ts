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

  // Un-react to the message (marked as optional in Maestro due to flakiness)
  try {
    await helpers.removeReaction(page, '👍');
  } catch (error) {
    // Optional operation - continue if it fails
    console.warn('Un-react operation failed (expected flakiness)');
  }

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
