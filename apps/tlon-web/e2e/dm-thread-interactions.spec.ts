import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test DM thread interactions and message operations', async ({
  zodPage,
  tenPage,
}) => {
  // Increase timeout for this complex test
  test.setTimeout(120000); // 2 minutes instead of default 60 seconds
  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Setup: Create DM and establish thread
  await helpers.createDirectMessage(zodPage, '~ten');
  await helpers.sendMessage(zodPage, "Hello ~ten! Let's test threads in DMs.");

  if (await helpers.isMobileViewport(zodPage)) {
    await helpers.navigateBack(zodPage);
  }

  // ~ten receives and accepts DM
  await tenPage.reload();
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible({
    timeout: 15000,
  });
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  await expect(
    tenPage.getByText("Hello ~ten! Let's test threads in DMs.").first()
  ).toBeVisible({ timeout: 10000 });
  await expect(tenPage.getByText('Accept')).toBeVisible({ timeout: 5000 });
  await tenPage.getByText('Accept').click();
  await expect(tenPage.getByTestId('MessageInput')).toBeVisible({
    timeout: 10000,
  });

  await helpers.sendMessage(
    tenPage,
    'Ten responds: Ready for DM thread testing!'
  );

  // ZOD: Start thread and send first reply
  await zodPage.getByTestId('ChannelListItem-~ten').click();
  await expect(
    zodPage.getByText('Ten responds: Ready for DM thread testing!').first()
  ).toBeVisible({ timeout: 20000 });
  await helpers.startThread(zodPage, "Hello ~ten! Let's test threads in DMs.");
  await helpers.sendThreadReply(
    zodPage,
    'This is my first thread reply in a DM!'
  );

  // Navigate back to see thread indicator
  await helpers.navigateBack(zodPage);
  await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });
  await expect(zodPage.getByText('~ten').first()).toBeVisible({
    timeout: 5000,
  });

  // TEN: Click on the thread indicator to enter the thread
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 20000 });
  await tenPage.getByText('1 reply').click();
  // Wait for thread to load
  await expect(tenPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({
    timeout: 5000,
  });

  // TEN: Verify they can see zod's thread reply
  await expect(
    tenPage.getByText('This is my first thread reply in a DM!').first()
  ).toBeVisible({ timeout: 5000 });

  // TEN: Send a reply in the thread
  await helpers.sendThreadReply(
    tenPage,
    'Great! I can see your thread reply and respond to it.'
  );

  // TEN: React to zod's thread message with heart emoji
  await helpers.reactToMessage(
    tenPage,
    'This is my first thread reply in a DM!',
    'heart'
  );

  // ZOD: Navigate back to thread and verify ten's reply and reaction
  // Navigate to DM and wait for thread indicator - cross-ship sync
  await zodPage.getByTestId('ChannelListItem-~ten').click();
  // Verify we're in the correct DM context before looking for thread indicators
  await expect(zodPage.getByText('~ten').first()).toBeVisible({
    timeout: 5000,
  });
  await expect(zodPage.getByText(/\d+ repl(y|ies)/)).toBeVisible({
    timeout: 20000,
  });
  await zodPage
    .getByText(/\d+ repl(y|ies)/)
    .first()
    .click();
  // Wait for thread to load
  await expect(zodPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    zodPage
      .getByText('Great! I can see your thread reply and respond to it.')
      .first()
  ).toBeVisible({ timeout: 5000 });
  // Wait for reactions to load (already checked below with timeout)
  await expect(zodPage.getByText('❤️')).toBeVisible({ timeout: 5000 });

  // ZOD: Quote-reply to ten's message in the thread
  await helpers.threadQuoteReply(
    zodPage,
    'Great! I can see your thread reply and respond to it.',
    'Quoted your message in this DM thread!',
    true
  );

  // TEN: Verify the quote reply is visible
  // Cross-ship sync - longer timeout for cross-ship operation
  await expect(
    tenPage.getByText('Quoted your message in this DM thread!').first()
  ).toBeVisible({ timeout: 15000 });

  // TEN: Send another thread reply to test multi-message threads
  await helpers.sendThreadReply(tenPage, 'Additional message in DM thread');

  // TEN: Navigate back to main DM view to see thread indicators
  await helpers.navigateBack(tenPage);
  await expect(tenPage.getByText('~zod').first()).toBeVisible({
    timeout: 5000,
  });

  // ZOD: Verify the additional message is visible - cross-ship sync
  await expect(
    zodPage.getByText('Additional message in DM thread').first()
  ).toBeVisible({ timeout: 15000 });

  // ZOD: Send another message and delete it
  await helpers.sendThreadReply(zodPage, 'Delete this thread message');
  await helpers.deleteMessage(zodPage, 'Delete this thread message', true);

  // TEN: Navigate to thread and send a message to hide
  await expect(tenPage.getByText(/\d+ repl(y|ies)/).first()).toBeVisible({
    timeout: 15000,
  });
  await tenPage
    .getByText(/\d+ repl(y|ies)/)
    .first()
    .click();
  await expect(tenPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({
    timeout: 5000,
  });

  await helpers.sendThreadReply(tenPage, 'Hide this thread message');
  await helpers.hideMessage(zodPage, 'Hide this thread message', true);
});
