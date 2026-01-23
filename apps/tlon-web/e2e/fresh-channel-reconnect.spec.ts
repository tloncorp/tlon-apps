import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Increase timeout for these comprehensive tests
test.setTimeout(120000);

/**
 * Helper to enable the fresh channel on reconnect feature flag via page.evaluate
 */
async function enableFreshChannelReconnect(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    // Access the feature flag store on the window (exposed by the app)
    const store = (window as any).__FEATURE_FLAG_STORE__;
    if (store && typeof store.setEnabled === 'function') {
      store.setEnabled('freshChannelOnReconnect', true);
      return true;
    }

    // Fallback: try to access via zustand store if exposed differently
    // The featureFlags module exports setEnabled which modifies the store
    if ((window as any).setFeatureFlag) {
      (window as any).setFeatureFlag('freshChannelOnReconnect', true);
      return true;
    }

    return false;
  });

  // Also enable via UI as a more reliable method
  await page.getByTestId('SettingsNavIcon').click();
  await expect(page.getByText('Settings', { exact: true })).toBeVisible();

  // Navigate to experimental features
  await page.getByText('Experimental features').click();
  await expect(
    page.getByTestId('ScreenHeaderTitle').getByText('Experimental features')
  ).toBeVisible();

  // Find and enable the "Fast foreground reconnect" toggle
  const toggleRow = page.locator('div').filter({
    hasText: 'Fast foreground reconnect (experimental)',
  });
  const toggle = toggleRow.locator('input[type="checkbox"], [role="switch"]');

  // Check if toggle exists and click it if not already enabled
  if (await toggle.count()) {
    const isChecked = await toggle.isChecked().catch(() => false);
    if (!isChecked) {
      await toggle.click();
      await page.waitForTimeout(500); // Allow state to persist
    }
  }

  // Navigate back to home
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByText('Home')).toBeVisible();
}

/**
 * Simulate app being "backgrounded" by disconnecting the network.
 * In a real mobile app, this would be the SSE connection being interrupted.
 */
async function simulateBackground(context: import('@playwright/test').BrowserContext) {
  await context.setOffline(true);
}

/**
 * Simulate app being "foregrounded" by reconnecting the network.
 * This triggers the SSE reconnection flow.
 */
async function simulateForeground(context: import('@playwright/test').BrowserContext) {
  await context.setOffline(false);
}

test.describe('Fresh Channel Reconnection', () => {
  test('should skip event backlog and use sync for fast foreground return', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const zodContext = zodSetup.context;
    const tenPage = tenSetup.page;

    // Assert initial state
    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(tenPage.getByText('Home')).toBeVisible();

    // Enable the experimental feature flag on zod's session
    await enableFreshChannelReconnect(zodPage);

    // Create a group for messaging
    await helpers.createGroup(zodPage);
    const groupName = '~ten, ~zod';

    // Invite ten to the group
    await helpers.inviteMembersToGroup(zodPage, ['ten']);

    // Wait for invitation to propagate
    await zodPage.waitForTimeout(2000);

    // Accept invitation as ten
    await helpers.acceptGroupInvite(tenPage, groupName);

    // Navigate to the General channel on both ships
    await helpers.navigateToChannel(tenPage, 'General');
    await zodPage.getByTestId('HomeNavIcon').click();
    await helpers.navigateToGroupByTestId(zodPage, {
      expectedDisplayName: groupName,
    });
    await helpers.navigateToChannel(zodPage, 'General');

    // Wait for session stability before simulating background
    await helpers.waitForSessionStability(zodPage);
    await helpers.waitForSessionStability(tenPage);

    // Send an initial message to confirm setup works
    await helpers.sendMessage(zodPage, 'Initial message before background');
    await expect(tenPage.getByText('Initial message before background')).toBeVisible({
      timeout: 10000,
    });

    // --- SIMULATE BACKGROUND ---
    // Go offline on zod's context to simulate app being backgrounded
    await simulateBackground(zodContext);

    // Wait a brief moment to ensure connection is dropped
    await zodPage.waitForTimeout(1000);

    // Send multiple messages from ten while zod is "backgrounded"
    // This simulates the event backlog that would build up
    const messagesWhileBackgrounded = [
      'Message while backgrounded 1',
      'Message while backgrounded 2',
      'Message while backgrounded 3',
      'Message while backgrounded 4',
      'Message while backgrounded 5',
    ];

    for (const message of messagesWhileBackgrounded) {
      await tenPage.getByTestId('MessageInput').click();
      await tenPage.fill('[data-testid="MessageInput"]', message);
      await tenPage.getByTestId('MessageInputSendButton').click();
      await expect(tenPage.getByText(message)).toBeVisible({ timeout: 5000 });
      // Small delay between messages
      await tenPage.waitForTimeout(300);
    }

    // Wait a bit longer to simulate being "backgrounded" for some time
    // (In real scenario this could be minutes/hours, but we use seconds for test)
    await zodPage.waitForTimeout(3000);

    // --- SIMULATE FOREGROUND ---
    // Record start time for measuring foreground performance
    const foregroundStartTime = Date.now();

    // Go back online (simulate foregrounding)
    await simulateForeground(zodContext);

    // Wait for reconnection - the subtitle should show connecting then stabilize
    // With fresh channel, this should be fast because we skip event backlog
    await helpers.waitForSessionStability(zodPage);

    // Verify all messages appear
    // With fresh channel reconnect, the sync system should fetch these in batch
    // rather than processing individual SSE events
    const lastMessage = messagesWhileBackgrounded[messagesWhileBackgrounded.length - 1];
    await expect(zodPage.getByText(lastMessage)).toBeVisible({
      timeout: 10000, // Allow reasonable time for sync
    });

    const foregroundEndTime = Date.now();
    const foregroundDuration = foregroundEndTime - foregroundStartTime;

    // Log the performance metrics
    console.log(`Fresh channel foreground duration: ${foregroundDuration}ms`);
    console.log(`Messages synced: ${messagesWhileBackgrounded.length}`);

    // Verify all messages are visible (not just the last one)
    for (const message of messagesWhileBackgrounded) {
      await expect(zodPage.getByText(message)).toBeVisible({ timeout: 5000 });
    }

    // Performance assertion:
    // With fresh channel reconnect, foreground should be fast (<5s for this small backlog)
    // Without the feature, processing 5+ events sequentially could take longer
    // We use a generous threshold since network conditions vary in tests
    expect(foregroundDuration).toBeLessThan(10000);
  });

  test('should preserve all subscription types after fresh channel reset', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const zodContext = zodSetup.context;
    const tenPage = tenSetup.page;

    // Assert initial state
    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(tenPage.getByText('Home')).toBeVisible();

    // Enable the experimental feature flag
    await enableFreshChannelReconnect(zodPage);

    // Create a group for testing
    await helpers.createGroup(zodPage);
    const groupName = '~ten, ~zod';

    await helpers.inviteMembersToGroup(zodPage, ['ten']);
    await zodPage.waitForTimeout(2000);
    await helpers.acceptGroupInvite(tenPage, groupName);

    // Navigate to channels on both ships
    await helpers.navigateToChannel(tenPage, 'General');
    await zodPage.getByTestId('HomeNavIcon').click();
    await helpers.navigateToGroupByTestId(zodPage, {
      expectedDisplayName: groupName,
    });
    await helpers.navigateToChannel(zodPage, 'General');

    await helpers.waitForSessionStability(zodPage);
    await helpers.waitForSessionStability(tenPage);

    // --- SIMULATE BACKGROUND ---
    await simulateBackground(zodContext);
    await zodPage.waitForTimeout(1000);

    // Send a group message while backgrounded
    await tenPage.getByTestId('MessageInput').click();
    await tenPage.fill('[data-testid="MessageInput"]', 'Group message while away');
    await tenPage.getByTestId('MessageInputSendButton').click();
    await expect(tenPage.getByText('Group message while away')).toBeVisible({
      timeout: 5000,
    });

    // Wait to simulate being backgrounded
    await zodPage.waitForTimeout(2000);

    // --- SIMULATE FOREGROUND ---
    await simulateForeground(zodContext);

    // Wait for session to stabilize
    await helpers.waitForSessionStability(zodPage);

    // Verify group message synced correctly after fresh channel reset
    await expect(zodPage.getByText('Group message while away')).toBeVisible({
      timeout: 10000,
    });

    // Verify we can still send messages (subscriptions working)
    await helpers.sendMessage(zodPage, 'Reply after foreground');
    await expect(tenPage.getByText('Reply after foreground')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should handle rapid foreground/background cycling gracefully', async ({
    zodSetup,
  }) => {
    const zodPage = zodSetup.page;
    const zodContext = zodSetup.context;

    await expect(zodPage.getByText('Home')).toBeVisible();

    // Enable the experimental feature flag
    await enableFreshChannelReconnect(zodPage);

    // Create a group
    await helpers.createGroup(zodPage);
    await helpers.navigateToChannel(zodPage, 'General');
    await helpers.waitForSessionStability(zodPage);

    // Send initial message
    await helpers.sendMessage(zodPage, 'Message before cycling');

    // Rapidly cycle background/foreground 5 times
    for (let i = 0; i < 5; i++) {
      await simulateBackground(zodContext);
      await zodPage.waitForTimeout(500);
      await simulateForeground(zodContext);
      await zodPage.waitForTimeout(1000);
    }

    // Wait for final stabilization
    await helpers.waitForSessionStability(zodPage);

    // Verify the app is still functional after rapid cycling
    await helpers.sendMessage(zodPage, 'Message after rapid cycling');
    await expect(zodPage.getByText('Message after rapid cycling')).toBeVisible({
      timeout: 10000,
    });

    // Verify initial message is still visible (no data loss)
    await expect(zodPage.getByText('Message before cycling')).toBeVisible();
  });
});
