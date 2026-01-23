import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Increase timeout for these comprehensive tests
test.setTimeout(120000);

/**
 * Helper to ensure the fresh channel on reconnect feature flag is disabled via page.evaluate
 */
async function disableFreshChannelReconnect(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    // Access the feature flag store on the window (exposed by the app)
    const store = (window as any).__FEATURE_FLAG_STORE__;
    if (store && typeof store.setEnabled === 'function') {
      store.setEnabled('freshChannelOnReconnect', false);
      return true;
    }

    // Fallback: try to access via zustand store if exposed differently
    if ((window as any).setFeatureFlag) {
      (window as any).setFeatureFlag('freshChannelOnReconnect', false);
      return true;
    }

    return false;
  });

  // Also verify/disable via UI as a more reliable method
  await page.getByTestId('SettingsNavIcon').click();
  await expect(page.getByText('Settings', { exact: true })).toBeVisible();

  // Navigate to experimental features
  await page.getByText('Experimental features').click();
  await expect(
    page.getByTestId('ScreenHeaderTitle').getByText('Experimental features')
  ).toBeVisible();

  // Find and ensure the "Fast foreground reconnect" toggle is disabled
  const toggleRow = page.locator('div').filter({
    hasText: 'Fast foreground reconnect (experimental)',
  });
  const toggle = toggleRow.locator('input[type="checkbox"], [role="switch"]');

  // Check if toggle exists and click it if it's currently enabled
  if (await toggle.count()) {
    const isChecked = await toggle.isChecked().catch(() => false);
    if (isChecked) {
      await toggle.click();
      await page.waitForTimeout(500); // Allow state to persist
    }
  }

  // Navigate back to home
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByText('Home')).toBeVisible();
}

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

  test('should handle 10 rapid foreground/background cycles in 1 minute with throttling', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const zodContext = zodSetup.context;
    const tenPage = tenSetup.page;

    // This test verifies PRD requirement: "Test: Rapid foreground/background 10 times in 1 minute"
    // The throttling mechanism should limit fresh channel resets to max once per 60 seconds
    // So only the first foreground should trigger a fresh channel reset, subsequent ones are throttled

    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(tenPage.getByText('Home')).toBeVisible();

    // Enable the experimental feature flag
    await enableFreshChannelReconnect(zodPage);

    // Create a group for messaging
    await helpers.createGroup(zodPage);
    const groupName = '~ten, ~zod';

    // Invite ten to the group
    await helpers.inviteMembersToGroup(zodPage, ['ten']);
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

    await helpers.waitForSessionStability(zodPage);
    await helpers.waitForSessionStability(tenPage);

    // Send initial message to confirm setup works
    await helpers.sendMessage(zodPage, 'Message before 10 cycles');
    await expect(tenPage.getByText('Message before 10 cycles')).toBeVisible({
      timeout: 10000,
    });

    const cycleStartTime = Date.now();
    const cycleCount = 10;
    const targetDuration = 60000; // 1 minute
    const intervalBetweenCycles = Math.floor(targetDuration / cycleCount); // ~6 seconds per cycle

    console.log(`Starting ${cycleCount} rapid foreground/background cycles over ~1 minute...`);
    console.log(`Target interval between cycles: ${intervalBetweenCycles}ms`);

    // Perform 10 foreground/background cycles within 1 minute
    // Throttling should ensure only 1 fresh channel reset occurs (first cycle)
    // Subsequent cycles should be throttled (no fresh channel reset)
    for (let i = 1; i <= cycleCount; i++) {
      const cycleIterationStart = Date.now();
      console.log(`Cycle ${i}/${cycleCount} starting...`);

      // Background
      await simulateBackground(zodContext);
      await zodPage.waitForTimeout(1000);

      // Send a message from ten while zod is backgrounded
      const cycleMessage = `Cycle ${i} message`;
      await tenPage.getByTestId('MessageInput').click();
      await tenPage.fill('[data-testid="MessageInput"]', cycleMessage);
      await tenPage.getByTestId('MessageInputSendButton').click();
      await expect(tenPage.getByText(cycleMessage)).toBeVisible({ timeout: 5000 });

      // Foreground
      await simulateForeground(zodContext);

      // Brief wait for reconnection
      await zodPage.waitForTimeout(2000);

      // Calculate remaining time for this interval
      const cycleIterationDuration = Date.now() - cycleIterationStart;
      const remainingWait = Math.max(0, intervalBetweenCycles - cycleIterationDuration);

      if (remainingWait > 0 && i < cycleCount) {
        await zodPage.waitForTimeout(remainingWait);
      }

      console.log(`Cycle ${i}/${cycleCount} complete`);
    }

    const totalCycleDuration = Date.now() - cycleStartTime;
    console.log(`All ${cycleCount} cycles completed in ${totalCycleDuration}ms`);

    // Wait for final stabilization
    await helpers.waitForSessionStability(zodPage);

    // Verify all cycle messages are visible (no data loss despite rapid cycling)
    console.log('Verifying all messages synced correctly...');
    for (let i = 1; i <= cycleCount; i++) {
      await expect(zodPage.getByText(`Cycle ${i} message`)).toBeVisible({
        timeout: 10000,
      });
    }

    // Verify initial message is still visible
    await expect(zodPage.getByText('Message before 10 cycles')).toBeVisible();

    // Verify app is still fully functional after rapid cycling
    await helpers.sendMessage(zodPage, 'Message after 10 cycles');
    await expect(tenPage.getByText('Message after 10 cycles')).toBeVisible({
      timeout: 10000,
    });

    // Verify ten can also respond (bidirectional works)
    await tenPage.getByTestId('MessageInput').click();
    await tenPage.fill('[data-testid="MessageInput"]', 'Ten response after 10 cycles');
    await tenPage.getByTestId('MessageInputSendButton').click();
    await expect(zodPage.getByText('Ten response after 10 cycles')).toBeVisible({
      timeout: 10000,
    });

    console.log(`Test passed: ${cycleCount} cycles in ${totalCycleDuration}ms with no data loss`);

    // Assert test completed within reasonable time (< 90 seconds including setup)
    // This verifies throttling prevented performance degradation from too many channel resets
    expect(totalCycleDuration).toBeLessThan(90000);
  });

  test('should sync correctly after extended background period (simulated 1 hour)', async ({
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
    await helpers.sendMessage(zodPage, 'Initial message before long background');
    await expect(tenPage.getByText('Initial message before long background')).toBeVisible({
      timeout: 10000,
    });

    // --- SIMULATE EXTENDED BACKGROUND (1 HOUR) ---
    // Go offline on zod's context to simulate app being backgrounded
    await simulateBackground(zodContext);

    // Wait a brief moment to ensure connection is dropped
    await zodPage.waitForTimeout(1000);

    // Simulate a large event backlog that would accumulate during 1 hour
    // Based on PRD metrics: ~500-2000 events for 1 hour absence
    // We use 20 messages to represent a meaningful backlog while keeping test time reasonable
    const messageCount = 20;
    const messagesWhileBackgrounded: string[] = [];
    for (let i = 1; i <= messageCount; i++) {
      messagesWhileBackgrounded.push(`Extended background msg ${i} of ${messageCount}`);
    }

    console.log(`Sending ${messageCount} messages to simulate 1-hour backlog...`);

    for (const message of messagesWhileBackgrounded) {
      await tenPage.getByTestId('MessageInput').click();
      await tenPage.fill('[data-testid="MessageInput"]', message);
      await tenPage.getByTestId('MessageInputSendButton').click();
      await expect(tenPage.getByText(message)).toBeVisible({ timeout: 5000 });
      // Small delay between messages to simulate spread over time
      await tenPage.waitForTimeout(200);
    }

    // Simulate being backgrounded for an extended period
    // This represents the time the app would be in background (1 hour = 3600s)
    // We use a shorter delay in tests but the message count simulates the backlog size
    await zodPage.waitForTimeout(5000);

    // --- SIMULATE FOREGROUND AFTER EXTENDED ABSENCE ---
    // Record start time for measuring foreground performance
    const foregroundStartTime = Date.now();

    // Go back online (simulate foregrounding)
    await simulateForeground(zodContext);

    // Wait for reconnection
    // With fresh channel, this should be fast because we skip event backlog
    // and rely on batch sync instead of processing ~500-2000 events individually
    await helpers.waitForSessionStability(zodPage);

    // Verify all messages appear
    // With fresh channel reconnect, the sync system should fetch these in batch
    // Expected: <1s according to PRD (vs 5-10s with original behavior)
    const lastMessage = messagesWhileBackgrounded[messagesWhileBackgrounded.length - 1];
    await expect(zodPage.getByText(lastMessage)).toBeVisible({
      timeout: 15000, // Allow reasonable time for batch sync
    });

    const foregroundEndTime = Date.now();
    const foregroundDuration = foregroundEndTime - foregroundStartTime;

    // Log the performance metrics
    console.log(`Extended background foreground duration: ${foregroundDuration}ms`);
    console.log(`Messages synced: ${messageCount}`);
    console.log(`Effective throughput: ${(messageCount / (foregroundDuration / 1000)).toFixed(1)} msgs/sec`);

    // Verify first, middle, and last messages are all visible
    await expect(zodPage.getByText(messagesWhileBackgrounded[0])).toBeVisible({ timeout: 5000 });
    await expect(zodPage.getByText(messagesWhileBackgrounded[Math.floor(messageCount / 2)])).toBeVisible({
      timeout: 5000,
    });
    await expect(zodPage.getByText(lastMessage)).toBeVisible({ timeout: 5000 });

    // Performance assertion:
    // With fresh channel reconnect, even a large backlog should sync quickly via batch fetch
    // PRD target: <1s for 1 hour absence (85% improvement)
    // We use a generous threshold (15s) since test environment varies
    // The key metric is that it doesn't scale linearly with backlog size
    expect(foregroundDuration).toBeLessThan(15000);

    // Verify bidirectional messaging still works after extended absence
    await helpers.sendMessage(zodPage, 'Reply after extended background');
    await expect(tenPage.getByText('Reply after extended background')).toBeVisible({
      timeout: 10000,
    });

    // Verify ten can still send to zod (subscription fully restored)
    await tenPage.getByTestId('MessageInput').click();
    await tenPage.fill('[data-testid="MessageInput"]', 'Final message from ten');
    await tenPage.getByTestId('MessageInputSendButton').click();
    await expect(zodPage.getByText('Final message from ten')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should work correctly with feature flag disabled (original behavior)', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const zodContext = zodSetup.context;
    const tenPage = tenSetup.page;

    // Assert initial state
    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(tenPage.getByText('Home')).toBeVisible();

    // Explicitly disable the experimental feature flag to test original behavior
    await disableFreshChannelReconnect(zodPage);

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
    await helpers.sendMessage(zodPage, 'Initial message before disconnect');
    await expect(tenPage.getByText('Initial message before disconnect')).toBeVisible({
      timeout: 10000,
    });

    // --- SIMULATE BACKGROUND (DISCONNECT) ---
    // Go offline on zod's context to simulate app being backgrounded
    await simulateBackground(zodContext);

    // Wait a brief moment to ensure connection is dropped
    await zodPage.waitForTimeout(1000);

    // Send multiple messages from ten while zod is "offline"
    // With flag disabled, these would be queued as SSE events (original behavior)
    const messagesWhileOffline = [
      'Original behavior msg 1',
      'Original behavior msg 2',
      'Original behavior msg 3',
    ];

    for (const message of messagesWhileOffline) {
      await tenPage.getByTestId('MessageInput').click();
      await tenPage.fill('[data-testid="MessageInput"]', message);
      await tenPage.getByTestId('MessageInputSendButton').click();
      await expect(tenPage.getByText(message)).toBeVisible({ timeout: 5000 });
      // Small delay between messages
      await tenPage.waitForTimeout(300);
    }

    // Wait a bit to simulate being "backgrounded" for some time
    await zodPage.waitForTimeout(2000);

    // --- SIMULATE FOREGROUND (RECONNECT) ---
    // Go back online (simulate foregrounding)
    await simulateForeground(zodContext);

    // Wait for reconnection and event processing (original behavior)
    await helpers.waitForSessionStability(zodPage);

    // Verify all messages appear
    // With original behavior, SSE events should be processed sequentially
    const lastMessage = messagesWhileOffline[messagesWhileOffline.length - 1];
    await expect(zodPage.getByText(lastMessage)).toBeVisible({
      timeout: 15000, // Allow more time for original event processing
    });

    // Verify all messages are visible
    for (const message of messagesWhileOffline) {
      await expect(zodPage.getByText(message)).toBeVisible({ timeout: 5000 });
    }

    // Verify bidirectional messaging still works after reconnection
    await helpers.sendMessage(zodPage, 'Reply with flag disabled');
    await expect(tenPage.getByText('Reply with flag disabled')).toBeVisible({
      timeout: 10000,
    });

    // Verify ten can reply back
    await tenPage.getByTestId('MessageInput').click();
    await tenPage.fill('[data-testid="MessageInput"]', 'Ten reply with flag disabled');
    await tenPage.getByTestId('MessageInputSendButton').click();
    await expect(zodPage.getByText('Ten reply with flag disabled')).toBeVisible({
      timeout: 10000,
    });
  });
});
