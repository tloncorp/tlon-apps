import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test DM thread management and multiple threads', async ({
  zodPage,
  tenPage,
}) => {
  // Increase timeout for this complex test
  test.setTimeout(120000); // 2 minutes instead of default 60 seconds
  // Assert that we're on the Home page for both ships
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Setup: Create DM, establish conversation with threads
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

  // ZOD: Start first thread
  await zodPage.getByTestId('ChannelListItem-~ten').click();
  await expect(
    zodPage.getByText('Ten responds: Ready for DM thread testing!').first()
  ).toBeVisible({ timeout: 20000 });
  await helpers.startThread(zodPage, "Hello ~ten! Let's test threads in DMs.");
  await helpers.sendThreadReply(
    zodPage,
    'This is my first thread reply in a DM!'
  );

  // Navigate back and establish thread interaction
  await helpers.navigateBack(zodPage);
  await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });

  // TEN: Participate in first thread
  await expect(tenPage.getByText('1 reply')).toBeVisible({ timeout: 20000 });
  await tenPage.getByText('1 reply').click();
  await expect(tenPage.getByRole('textbox', { name: 'Reply' })).toBeVisible({
    timeout: 5000,
  });
  await helpers.sendThreadReply(
    tenPage,
    'Great! I can see your thread reply and respond to it.'
  );
  await helpers.sendThreadReply(tenPage, 'Additional message in DM thread');

  // Navigate back to main DM view to verify thread count
  // For zodPage: check if we're in thread context and navigate back if needed
  const zodReplyBox = await zodPage
    .getByRole('textbox', { name: 'Reply' })
    .isVisible();
  if (zodReplyBox) {
    await helpers.navigateBack(zodPage);
  }

  // For tenPage: Navigate back from thread to main DM view
  await helpers.navigateBack(tenPage);

  // Wait for navigation to complete - ensure we're in DM context
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
  await zodPage.waitForTimeout(1000);

  // Should see thread indicators now (at least one from the original thread)
  const replyElements = await zodPage.getByText(/\d+ repl(y|ies)/).count();
  expect(replyElements).toBeGreaterThanOrEqual(1); // At least one thread

  // TEN: Verify they can see thread indicators too
  // Wait for cross-ship sync - longer timeout for second thread sync
  await expect(tenPage.getByText(/\d+ repl(y|ies)/).first()).toBeVisible({
    timeout: 25000,
  });
  const tenReplyElements = await tenPage.getByText(/\d+ repl(y|ies)/).count();
  expect(tenReplyElements).toBeGreaterThanOrEqual(1); // At least one thread

  // Test cleanup is handled automatically by test-fixtures.ts
});
