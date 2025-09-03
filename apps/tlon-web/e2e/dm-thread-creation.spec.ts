import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test DM thread creation and initial interactions', async ({
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
  await expect(
    tenPage.getByText("Hello ~ten! Let's test threads in DMs.").first()
  ).toBeVisible({ timeout: 10000 });

  // Verify ~ten can see the message from ~zod
  await expect(
    tenPage.getByText("Hello ~ten! Let's test threads in DMs.").first()
  ).toBeVisible();

  // ~ten accepts the DM
  await expect(tenPage.getByText('Accept')).toBeVisible({ timeout: 5000 });
  await tenPage.getByText('Accept').click();
  // Wait for accept to process
  await expect(tenPage.getByTestId('MessageInput')).toBeVisible({
    timeout: 10000,
  });

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
});
