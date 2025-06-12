import { expect, test } from '@playwright/test';

import {
  clickThroughWelcome,
  createDirectMessage,
  deleteMessage,
  hideMessage,
  isMobileViewport,
  leaveDM,
  navigateBack,
  quoteReply,
  reactToMessage,
  removeReaction,
  sendMessage,
  sendThreadReply,
  startThread,
  verifyMessagePreview,
} from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test comprehensive direct message functionality', async ({
  page,
}) => {
  // Launch and login
  await page.goto(zodUrl);
  await clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  if (await page.getByText('~bus', { exact: true }).isVisible()) {
    await leaveDM(page, '~bus');
  }

  // Create a direct message with ~zod
  await createDirectMessage(page, '~bus');

  // Send a message in the DM
  await sendMessage(page, 'Hello, ~bus!');

  if (await isMobileViewport(page)) {
    await navigateBack(page);
  }

  // Verify message preview is visible
  await verifyMessagePreview(page, 'Hello, ~bus!', true, '~bus');

  // Start a thread from the message
  await startThread(page, 'Hello, ~bus!');

  // Send a reply in the thread
  await sendThreadReply(page, 'Thread reply');

  // Navigate back to the channel and verify thread reply count
  await navigateBack(page);
  await expect(page.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await reactToMessage(page, 'Hello, ~bus!', 'thumb');

  // Remove the reaction
  await removeReaction(page, '👍');

  // Quote reply to the message
  await quoteReply(page, 'Hello, ~bus!', 'Quote reply', true);

  // Send a message and hide it
  await sendMessage(page, 'Hide this message');
  await hideMessage(page, 'Hide this message', true);

  // Send a message and delete it
  await sendMessage(page, 'Delete this message');
  await deleteMessage(page, 'Delete this message', true);

  // Leave the DM from the Home screen
  await leaveDM(page, '~bus');

  // Verify we're back at Home and DM is gone
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('~bus')).not.toBeVisible();
});
