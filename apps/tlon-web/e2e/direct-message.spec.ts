import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

test('should test comprehensive direct message functionality between ~zod and ~ten', async ({
  browser,
}) => {
  // Create two browser contexts - one for ~zod (DM initiator) and one for ~ten (DM receiver)
  const zodContext = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  const tenContext = await browser.newContext({
    storageState: shipManifest['~ten'].authFile,
  });

  const zodPage = await zodContext.newPage();
  const tenPage = await tenContext.newPage();

  try {
    // Step 1: ~zod initiates and sets up
    await zodPage.goto(zodUrl);
    await helpers.clickThroughWelcome(zodPage);
    await zodPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Assert that we're on the Home page
    await expect(zodPage.getByText('Home')).toBeVisible();

    // Clean up any existing DM with ~ten
    if (await zodPage.getByText('~ten', { exact: true }).isVisible()) {
      await helpers.leaveDM(zodPage, '~ten');
    }

    // Step 2: ~ten sets up and navigates
    await tenPage.goto(tenUrl);
    await helpers.clickThroughWelcome(tenPage);
    await tenPage.evaluate(() => {
      window.toggleDevTools();
    });

    // Clean up any existing DM with ~zod
    if (await tenPage.getByText('~zod', { exact: true }).isVisible()) {
      await helpers.leaveDM(tenPage, '~zod');
    }

    // Step 3: ~zod creates a direct message with ~ten
    await helpers.createDirectMessage(zodPage, '~ten');

    // Step 4: ~zod sends the first message
    await helpers.sendMessage(zodPage, 'Hello, ~ten!');

    if (await helpers.isMobileViewport(zodPage)) {
      await helpers.navigateBack(zodPage);
    }

    // Verify message preview is visible on ~zod's side
    await helpers.verifyMessagePreview(zodPage, 'Hello, ~ten!', true, '~ten');

    // Step 5: ~ten receives the DM and accepts it
    await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible();
    await tenPage.getByTestId('ChannelListItem-~zod').click();

    await tenPage.waitForTimeout(1000);

    // Verify ~ten can see the message from ~zod
    await expect(tenPage.getByText('Hello, ~ten!').first()).toBeVisible();

    // Verify the accept/deny/block options are present
    await expect(tenPage.getByText('Accept')).toBeVisible();
    await expect(tenPage.getByText('Deny')).toBeVisible();
    await expect(tenPage.getByText('Block')).toBeVisible();

    // ~ten accepts the DM
    await tenPage.getByText('Accept').click();

    await tenPage.waitForTimeout(1000);

    // Verify accept/deny buttons are gone after accepting
    await expect(tenPage.getByText('Accept')).not.toBeVisible();
    await expect(tenPage.getByText('Deny')).not.toBeVisible();

    // Step 6: ~ten sends a reply
    await helpers.sendMessage(tenPage, 'Hello, ~zod!');
    await expect(tenPage.getByText('Hello, ~zod!').first()).toBeVisible();

    // Start a thread from the original message
    await helpers.startThread(zodPage, 'Hello, ~ten!');

    // Send a reply in the thread
    await helpers.sendThreadReply(zodPage, 'Thread reply');

    // Navigate back to the channel and verify thread reply count
    await helpers.navigateBack(zodPage);
    await expect(zodPage.getByText('1 reply')).toBeVisible();

    // React to the original message with thumb emoji
    await helpers.reactToMessage(zodPage, 'Hello, ~ten!', 'thumb');

    // Remove the reaction
    await helpers.removeReaction(zodPage, '👍');

    // Quote reply to the message
    await helpers.quoteReply(zodPage, 'Hello, ~ten!', 'Quote reply', true);

    // Send a message and hide it
    await helpers.sendMessage(zodPage, 'Hide this message');
    await helpers.hideMessage(zodPage, 'Hide this message', true);

    // Send a message and delete it
    await helpers.sendMessage(zodPage, 'Delete this message');
    await helpers.deleteMessage(zodPage, 'Delete this message', true);

    // Step 8: Clean up - both ships leave the DM
    // ~zod leaves the DM
    await helpers.leaveDM(zodPage, '~ten');

    // Verify ~zod is back at Home and DM is gone
    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(zodPage.getByText('~ten')).not.toBeVisible();

    // ~ten leaves the DM
    await helpers.leaveDM(tenPage, '~zod');
  } finally {
    // Close contexts
    await zodContext.close();
    await tenContext.close();
  }
});
