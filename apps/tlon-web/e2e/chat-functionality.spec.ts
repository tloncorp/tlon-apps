import { expect, test } from '@playwright/test';

import {
  cleanupExistingGroup,
  clickThroughWelcome,
  createGroup,
  deleteGroup,
  deleteMessage,
  editMessage,
  hideMessage,
  navigateBack,
  openGroupSettings,
  quoteReply,
  reactToMessage,
  removeReaction,
  reportMessage,
  sendMessage,
  sendThreadReply,
  startThread,
  verifyMessagePreviewOnHome,
} from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test comprehensive chat functionality', async ({ page }) => {
  // Launch and login
  await page.goto(zodUrl);
  await clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing group
  await cleanupExistingGroup(page);

  // Create a new group
  await createGroup(page);

  // Navigate back to Home and verify group creation
  await navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Send a message in the General channel
  await sendMessage(page, 'Hello, world!');

  // Navigate back to Home and verify message preview is visible
  await verifyMessagePreviewOnHome(page, 'Hello, world!');

  // Navigate back into the group
  await page.getByText('Untitled group').click();

  // Start a thread from the message
  await startThread(page, 'Hello, world!');

  // Send a reply in the thread
  await sendThreadReply(page, 'Thread reply');

  // Navigate back to the channel and verify thread reply count
  await navigateBack(page);
  await expect(page.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await reactToMessage(page, 'Hello, world!', 'thumb');

  // Remove the reaction
  await removeReaction(page, '👍');

  // Quote reply to the message
  await quoteReply(page, 'Hello, world!', 'Quote reply');

  // Send a message and hide it
  await sendMessage(page, 'Hide this message');
  await hideMessage(page, 'Hide this message');

  // Send a message and report it
  await sendMessage(page, 'Report this message');

  // Navigate away and back to work around potential bug mentioned in Maestro test
  await navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Report the message
  if (
    await page.getByText('Report this message', { exact: true }).isVisible()
  ) {
    await reportMessage(page, 'Report this message');
  }

  // Send a message and delete it
  await sendMessage(page, 'Delete this message');
  await deleteMessage(page, 'Delete this message');

  // Send a message and edit it
  await sendMessage(page, 'Edit this message');
  await editMessage(page, 'Edit this message', 'Edited message');

  // Delete the group and clean up
  await openGroupSettings(page);
  await deleteGroup(page);

  // Verify we're back at Home and group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
});
