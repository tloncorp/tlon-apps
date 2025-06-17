import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test comprehensive direct message functionality', async ({
  page,
}) => {
  // Launch and login
  await page.goto(zodUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  if (await page.getByText('~ten', { exact: true }).isVisible()) {
    await helpers.leaveDM(page, '~ten');
  }

  // Create a direct message with ~zod
  await helpers.createDirectMessage(page, '~ten');

  // Send a message in the DM
  await helpers.sendMessage(page, 'Hello, ~ten!');

  if (await helpers.isMobileViewport(page)) {
    await helpers.navigateBack(page);
  }

  // Verify message preview is visible
  await helpers.verifyMessagePreview(page, 'Hello, ~ten!', true, '~ten');

  // Start a thread from the message
  await helpers.startThread(page, 'Hello, ~ten!');

  // Send a reply in the thread
  await helpers.sendThreadReply(page, 'Thread reply');

  // Navigate back to the channel and verify thread reply count
  await helpers.navigateBack(page);
  await expect(page.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await helpers.reactToMessage(page, 'Hello, ~ten!', 'thumb');

  // Remove the reaction
  await helpers.removeReaction(page, '👍');

  // Quote reply to the message
  await helpers.quoteReply(page, 'Hello, ~ten!', 'Quote reply', true);

  // Send a message and hide it
  await helpers.sendMessage(page, 'Hide this message');
  await helpers.hideMessage(page, 'Hide this message', true);

  // Send a message and delete it
  await helpers.sendMessage(page, 'Delete this message');
  await helpers.deleteMessage(page, 'Delete this message', true);

  // Leave the DM from the Home screen
  await helpers.leaveDM(page, '~ten');

  // Verify we're back at Home and DM is gone
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('~ten')).not.toBeVisible();
});
