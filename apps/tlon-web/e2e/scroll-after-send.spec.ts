import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Tests for TLON-5075: Verify that sending a message scrolls the view to show the new message
// Use a constrained viewport to ensure messages overflow and scrolling is required

test.describe('Scroll to new message after sending', () => {
  // Use a small viewport height to ensure scrolling is needed
  test.use({ viewport: { width: 1280, height: 500 } });

  test('should scroll to new message in main channel after sending', async ({
    zodPage,
  }) => {
    const page = zodPage;

    // Assert that we're on the Home page
    await expect(page.getByText('Home')).toBeVisible();

    // Create a new group
    await helpers.createGroup(page);

    // Send enough messages to create scrollable content
    // With 500px viewport height and ~40px per message, we need ~20+ messages to overflow
    for (let i = 0; i < 25; i++) {
      await helpers.sendMessage(page, `Filler message ${i}`);
    }

    // Wait for all messages to render
    await expect(page.getByText('Filler message 24')).toBeVisible();

    // Scroll to show the oldest message
    // Main channel scroller may not respond to scrollIntoView, so use mouse wheel
    const messageElement = page.getByText('Filler message 24');
    await messageElement.hover();

    // Scroll up aggressively to reach oldest messages (use many iterations)
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(50);
    }

    // Wait for scroll to settle
    await page.waitForTimeout(500);

    // Verify oldest message is now in viewport (we scrolled away from newest)
    await expect(page.getByText('Filler message 0')).toBeInViewport();

    // Send a new message
    await helpers.sendMessage(page, 'New message after scrolling away');

    // The new message should be visible (scroll happened automatically)
    await expect(
      page.getByText('New message after scrolling away')
    ).toBeVisible();

    // The oldest message should no longer be in viewport (we scrolled back to newest)
    await expect(page.getByText('Filler message 0')).not.toBeInViewport();
  });

  test('should scroll to new reply in thread after sending', async ({
    zodPage,
  }) => {
    const page = zodPage;

    // Assert that we're on the Home page
    await expect(page.getByText('Home')).toBeVisible();

    // Create a new group
    await helpers.createGroup(page);

    // Send a message to start a thread from
    await helpers.sendMessage(page, 'Thread parent message');

    // Start a thread
    await helpers.startThread(page, 'Thread parent message');

    // Send enough replies to create scrollable content in thread panel
    for (let i = 0; i < 20; i++) {
      await helpers.sendThreadReply(page, `Thread reply ${i}`);
    }

    // Wait for all replies to render
    await expect(page.getByText('Thread reply 19')).toBeVisible();

    // Scroll to show the oldest reply using scrollIntoView
    // This is more reliable than mouse wheel for reaching a specific element
    await page.getByText('Thread reply 0').scrollIntoViewIfNeeded();

    // Wait for scroll to settle
    await page.waitForTimeout(500);

    // Verify oldest reply is now in viewport (we scrolled away)
    await expect(page.getByText('Thread reply 0')).toBeInViewport();

    // Send a new reply
    await helpers.sendThreadReply(page, 'New reply after scrolling');

    // The new reply should be visible (scroll happened automatically)
    await expect(page.getByText('New reply after scrolling')).toBeVisible();

    // The oldest reply should no longer be in viewport
    await expect(page.getByText('Thread reply 0')).not.toBeInViewport();
  });
});
