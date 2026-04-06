import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Tests that scroll position is preserved when navigating away from and back to a channel.

test.describe('Scroll position preservation', () => {
  test.use({ viewport: { width: 1280, height: 500 } });

  test('should maintain scroll position when viewing profile and returning', async ({
    zodPage,
  }) => {
    const page = zodPage;

    await expect(page.getByText('Home')).toBeVisible();
    await helpers.createGroup(page);

    // Send enough messages to create scrollable content
    for (let i = 0; i < 25; i++) {
      await helpers.sendMessage(
        page,
        `ProfileScrollMsg-${i.toString().padStart(2, '0')}`
      );
    }

    await expect(
      page.getByText('ProfileScrollMsg-24', { exact: true })
    ).toBeVisible();

    // Scroll up to show older messages
    const messageElement = page.getByText('ProfileScrollMsg-24', {
      exact: true,
    });
    await messageElement.hover();
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Verify we scrolled to older messages
    await expect(
      page.getByText('ProfileScrollMsg-00', { exact: true })
    ).toBeInViewport();
    await expect(
      page.getByText('ProfileScrollMsg-05', { exact: true })
    ).toBeInViewport();

    // Click on an author to open their profile
    const firstVisiblePost = page
      .getByTestId('Post')
      .filter({ hasText: 'ProfileScrollMsg-00' });
    await firstVisiblePost.locator('text=~zod').first().click();
    await page.waitForTimeout(2000);

    // Navigate back
    await helpers.navigateBack(page);
    await helpers.channelIsLoaded(page);
    await page.waitForTimeout(500);

    // Scroll position should be preserved
    await expect(
      page.getByText('ProfileScrollMsg-05', { exact: true }),
      'Scroll position should be preserved after viewing profile'
    ).toBeInViewport();

    await expect(
      page.getByText('ProfileScrollMsg-24', { exact: true }),
      'Should not have scrolled to bottom'
    ).not.toBeInViewport();
  });

  test('should maintain scroll position when opening thread and returning', async ({
    zodPage,
  }) => {
    const page = zodPage;

    await expect(page.getByText('Home')).toBeVisible();
    await helpers.createGroup(page);

    // Send messages and create a thread on an early one
    for (let i = 0; i < 15; i++) {
      await helpers.sendMessage(
        page,
        `ThreadScrollMsg-${i.toString().padStart(2, '0')}`
      );
    }

    await helpers.startThread(page, 'ThreadScrollMsg-02');
    await helpers.sendThreadReply(page, 'Reply to early message');
    await helpers.navigateBack(page);

    // Send more messages to push the threaded message up
    for (let i = 15; i < 25; i++) {
      await helpers.sendMessage(
        page,
        `ThreadScrollMsg-${i.toString().padStart(2, '0')}`
      );
    }

    await expect(
      page.getByText('ThreadScrollMsg-24', { exact: true })
    ).toBeVisible();

    // Scroll up to show the message with thread
    const messageElement = page.getByText('ThreadScrollMsg-24', {
      exact: true,
    });
    await messageElement.hover();
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Verify we scrolled to older messages
    await expect(
      page.getByText('ThreadScrollMsg-02', { exact: true })
    ).toBeInViewport();
    await expect(
      page.getByText('ThreadScrollMsg-05', { exact: true })
    ).toBeInViewport();

    // Open the thread
    await page.getByText('1 reply').click();
    await expect(page.getByText('Reply to early message')).toBeVisible({
      timeout: 10000,
    });

    // Navigate back
    await helpers.navigateBack(page);
    await helpers.channelIsLoaded(page);
    await page.waitForTimeout(5000);

    const newestMessage = page.getByText('ThreadScrollMsg-24', { exact: true });

    // Scroll position should be preserved
    await expect(
      newestMessage,
      'Should not have scrolled to bottom'
    ).not.toBeInViewport({ timeout: 3000 });

    await expect(
      page.getByText('ThreadScrollMsg-05', { exact: true }),
      'Scroll position should be preserved after viewing thread'
    ).toBeInViewport({ timeout: 3000 });

    // Verify scroll remains stable
    await page.waitForTimeout(1000);
    await expect(
      newestMessage,
      'Scroll should remain stable'
    ).not.toBeInViewport({ timeout: 1000 });
  });
});
