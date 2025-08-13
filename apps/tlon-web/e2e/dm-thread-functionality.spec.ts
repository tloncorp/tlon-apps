import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test comprehensive DM thread functionality between ~zod and ~ten', async ({
  zodPage,
  tenPage,
}) => {
  // Increase timeout for this complex test
  test.setTimeout(120000); // 2 minutes instead of default 60 seconds
  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // ~zod creates a direct message with ~ten
  await helpers.createDirectMessage(zodPage, '~ten');

  // ~zod sends the initial message
  await helpers.sendMessage(zodPage, "Hello ~ten! Let's test threads in DMs.");

  if (await helpers.isMobileViewport(zodPage)) {
    await helpers.navigateBack(zodPage);
  }

  // Verify message preview is visible on ~zod's side
  await helpers.verifyMessagePreview(
    zodPage,
    "Hello ~ten! Let's test threads in DMs.",
    true,
    '~ten'
  );

  // ~ten receives the DM and accepts it
  await tenPage.reload();
  // Wait for DM to appear after reload - deterministic wait
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible({
    timeout: 15000,
  });
  await tenPage.getByTestId('ChannelListItem-~zod').click();

  // Wait for DM to fully load
  await expect(tenPage.getByText("Hello ~ten! Let's test threads in DMs.").first()).toBeVisible({ timeout: 10000 });

  // Verify ~ten can see the message from ~zod
  await expect(
    tenPage.getByText("Hello ~ten! Let's test threads in DMs.").first()
  ).toBeVisible();

  // ~ten accepts the DM
  await expect(tenPage.getByText('Accept')).toBeVisible({ timeout: 5000 });
  await tenPage.getByText('Accept').click();
  // Wait for accept to process
  await expect(tenPage.getByTestId('MessageInput')).toBeVisible({ timeout: 10000 });

  // ~ten sends a reply to establish the conversation
  await helpers.sendMessage(
    tenPage,
    'Ten responds: Ready for DM thread testing!'
  );

  // ZOD: Navigate back to DM and wait for ten's message to sync
  await zodPage.getByTestId('ChannelListItem-~ten').click();
  // Wait for ten's message to appear - cross-ship sync with longer timeout
  await expect(
    zodPage.getByText('Ten responds: Ready for DM thread testing!').first()
  ).toBeVisible({ timeout: 20000 });
  await helpers.startThread(zodPage, "Hello ~ten! Let's test threads in DMs.");

  // ZOD: Send a reply in the thread
  await helpers.sendThreadReply(
    zodPage,
    'This is my first thread reply in a DM!'
  );

  // Navigate back to see thread indicator
  await helpers.navigateBack(zodPage);
  // Wait for thread count to update
  await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });
  // Ensure we're still in the DM, not back at Home
  await expect(zodPage.getByText('~ten').first()).toBeVisible({
    timeout: 5000,
  });
  await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 5000 });

  // TEN: Verify thread indicator is visible (cross-ship sync) - longer timeout for cross-ship operation
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 20000 });

  // TEN: Click on the thread indicator to enter the thread
  await tenPage.getByText('1 reply').click();
  // Wait for thread to load
  await expect(tenPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({ timeout: 5000 });

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
  await expect(zodPage.getByText('~ten').first()).toBeVisible({ timeout: 5000 });
  await expect(zodPage.getByText(/\d+ repl(y|ies)/)).toBeVisible({
    timeout: 20000,
  });
  await zodPage
    .getByText(/\d+ repl(y|ies)/)
    .first()
    .click();
  // Wait for thread to load
  await expect(zodPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({ timeout: 5000 });
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

  // Both navigate back to the main DM to verify thread count
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(tenPage);

  // Wait for navigation to complete
  await expect(zodPage.getByText('~ten').first()).toBeVisible({
    timeout: 5000,
  });
  await expect(tenPage.getByText('~zod').first()).toBeVisible({
    timeout: 5000,
  });

  // Ensure both pages are in DM conversation context
  await expect(zodPage.getByText('~ten').first()).toBeVisible({
    timeout: 5000,
  });
  await expect(tenPage.getByText('~zod').first()).toBeVisible({
    timeout: 5000,
  });

  // Verify both ships see updated thread count (should be 3+ replies now) - cross-ship sync
  await expect(zodPage.getByText(/\d+ repl(y|ies)/)).toBeVisible({
    timeout: 15000,
  });
  await expect(tenPage.getByText(/\d+ repl(y|ies)/)).toBeVisible({
    timeout: 15000,
  });

  // ZOD: Test starting a second thread from ten's original reply
  // Scroll to top to find ten's first message
  await zodPage.keyboard.press('Home');

  // Wait for and find ten's original message to start second thread
  await expect(
    zodPage.getByText('Ten responds: Ready for DM thread testing!').first()
  ).toBeVisible({ timeout: 10000 });
  await helpers.startThread(
    zodPage,
    'Ten responds: Ready for DM thread testing!'
  );
  await helpers.sendThreadReply(
    zodPage,
    'Starting a second thread in this DM!'
  );

  // Navigate back to main DM view
  await helpers.navigateBack(zodPage);

  // Should see thread indicators now (at least one from the original thread)
  const replyElements = await zodPage.getByText(/\d+ repl(y|ies)/).count();
  expect(replyElements).toBeGreaterThanOrEqual(1); // At least one thread

  // TEN: Verify they can see thread indicators too
  // Wait for cross-ship sync - longer timeout for second thread sync
  await expect(tenPage.getByText(/\d+ repl(y|ies)/).first()).toBeVisible({ timeout: 25000 });
  const tenReplyElements = await tenPage.getByText(/\d+ repl(y|ies)/).count();
  expect(tenReplyElements).toBeGreaterThanOrEqual(1); // At least one thread

  // Test cleanup is handled automatically by test-fixtures.ts
});

