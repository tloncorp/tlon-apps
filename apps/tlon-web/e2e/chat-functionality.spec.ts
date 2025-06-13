import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test comprehensive chat functionality', async ({ page }) => {
  // Launch and login
  await page.goto(zodUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing group
  await helpers.cleanupExistingGroup(page);

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

  // Navigate back to the channel and verify thread reply count
  await helpers.navigateBack(page);
  await expect(page.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await helpers.reactToMessage(page, 'Hello, world!', 'thumb');

  // Remove the reaction
  await helpers.removeReaction(page, '👍');

  // Quote reply to the message
  await helpers.quoteReply(page, 'Hello, world!', 'Quote reply');

  // Send a message and hide it
  await helpers.sendMessage(page, 'Hide this message');
  await helpers.hideMessage(page, 'Hide this message');

  // Send a message and report it
  await helpers.sendMessage(page, 'Report this message');

  // Navigate away and back to work around potential bug mentioned in Maestro test
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Report the message
  if (
    await page.getByText('Report this message', { exact: true }).isVisible()
  ) {
    await helpers.reportMessage(page, 'Report this message');
  }

  // Send a message and delete it
  await helpers.sendMessage(page, 'Delete this message');
  await helpers.deleteMessage(page, 'Delete this message');

  // Send a message and edit it
  await helpers.sendMessage(page, 'Edit this message');
  await helpers.editMessage(page, 'Edit this message', 'Edited message');

  // Delete the group and clean up
  await helpers.openGroupSettings(page);
  await helpers.deleteGroup(page);

  // Verify we're back at Home and group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
});
