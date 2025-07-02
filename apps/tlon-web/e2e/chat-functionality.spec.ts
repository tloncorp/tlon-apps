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
  await helpers.cleanupExistingGroup(page, '~ten, ~zod');

  // Create a new group
  await helpers.createGroup(page);
  const groupName = '~bus, ~zod';

  await helpers.inviteMembersToGroup(page, ['bus']);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText(groupName)).toBeVisible();
    await page.getByText(groupName).click();
    await expect(page.getByText(groupName).first()).toBeVisible();
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
    await expect(page.getByText(groupName)).toBeVisible();
    await page.getByText(groupName).click();
    await expect(page.getByText(groupName).first()).toBeVisible();
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

  // Mention a user in a message
  await page.getByTestId('MessageInput').click();
  await page.fill('[data-testid="MessageInput"]', 'mentioning @bus');
  await page.getByTestId('~bus-contact').click();
  await page.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(page.getByText('mentioning ~bus')).toBeVisible();

  // Mention all in a message
  await page.getByTestId('MessageInput').click();
  await page.fill('[data-testid="MessageInput"]', 'mentioning @all');
  await page.getByTestId('-all--group').click();
  await page.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(page.getByText('mentioning @all')).toBeVisible();

  // Mention a role in a message
  await page.getByTestId('MessageInput').click();
  await page.fill('[data-testid="MessageInput"]', 'mentioning @admin');
  await page.getByTestId('admin-group').click();
  await page.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(page.getByText('mentioning @admin')).toBeVisible();

  // Delete the group and clean up
  await helpers.openGroupSettings(page);
  await helpers.deleteGroup(page, groupName);

  // Verify we're back at Home and group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText(groupName)).not.toBeVisible();
});
