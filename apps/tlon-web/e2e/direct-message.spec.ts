import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test comprehensive direct message functionality between ~zod and ~ten', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // ~zod creates a direct message with ~ten
  await helpers.createDirectMessage(zodPage, '~ten');

  // ~zod sends the first message
  await helpers.sendMessage(zodPage, 'Hello, ~ten!');

  if (await helpers.isMobileViewport(zodPage)) {
    await helpers.navigateBack(zodPage);
  }

  // Verify message preview is visible on ~zod's side
  await helpers.verifyMessagePreview(zodPage, 'Hello, ~ten!', true, '~ten');

  // ~ten receives the DM and accepts it
  await tenPage.reload();
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

  // ~ten sends a reply
  await helpers.sendMessage(tenPage, 'Hello, ~zod!');
  await expect(tenPage.getByText('Hello, ~zod!').first()).toBeVisible();

  // Start a thread from the original message
  await helpers.startThread(zodPage, 'Hello, ~ten!');

  // Send a reply in the thread
  await helpers.sendThreadReply(zodPage, 'Thread reply');

  // Navigate back to the channel and verify thread reply count
  await helpers.navigateBack(zodPage);
  await zodPage.waitForTimeout(1000);
  await expect(zodPage.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await helpers.reactToMessage(zodPage, 'Hello, ~ten!', 'thumb');

  // Remove the reaction
  await helpers.removeReaction(zodPage, '👍');

  // Quote reply to the message
  await helpers.quoteReply(zodPage, 'Hello, ~ten!', 'Quote reply', true);

  // Send a message and hide it
  await helpers.sendMessage(tenPage, 'Hide this message');
  await helpers.hideMessage(zodPage, 'Hide this message', true);

  // Send a message and delete it
  await helpers.sendMessage(zodPage, 'Delete this message');
  await helpers.deleteMessage(zodPage, 'Delete this message', true);
});
