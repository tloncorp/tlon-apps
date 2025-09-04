import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should create threads and send basic messages', async ({ zodPage }) => {
  const page = zodPage;

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

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

  // Verify the reply is visible
  await expect(page.getByText('Thread reply', { exact: true })).toBeVisible();

  // Send another reply to test thread flow
  await helpers.sendThreadReply(page, 'Second thread reply');
  await expect(
    page.getByText('Second thread reply', { exact: true })
  ).toBeVisible();

  // Navigate back to the main channel
  await helpers.navigateBack(page);

  // Verify thread indicator shows correct count
  await expect(page.getByText('2 replies')).toBeVisible();
});
