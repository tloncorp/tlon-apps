import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Increase timeout for these comprehensive tests
test.setTimeout(90000);

test('should test comprehensive chat functionality', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and navigate to group using stable testID
  await zodPage.getByTestId('HomeNavIcon').click();
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  // Send a message in the General channel
  await helpers.sendMessage(zodPage, 'Hello, world!');

  // Verify message preview is visible
  await helpers.verifyMessagePreview(
    zodPage,
    'Hello, world!',
    false,
    'General'
  );

  // Start a thread from the message
  await helpers.startThread(zodPage, 'Hello, world!');

  // Send a reply in the thread
  await helpers.sendThreadReply(zodPage, 'Thread reply');

  // Navigate back to the channel and verify thread reply count
  await helpers.navigateBack(zodPage);
  await expect(zodPage.getByText('1 reply')).toBeVisible();

  // React to the original message with thumb emoji
  await helpers.reactToMessage(zodPage, 'Hello, world!', 'thumb');

  // Remove the reaction
  await helpers.removeReaction(zodPage, '👍');

  // Quote reply to the message
  await helpers.quoteReply(zodPage, 'Hello, world!', 'Quote reply');

  // Send a message as ~zod
  await helpers.sendMessage(zodPage, 'Hide this message');

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Open the General channel
  await helpers.navigateToChannel(tenPage, 'General');

  // Hide the message that ~zod sent
  await helpers.hideMessage(tenPage, 'Hide this message');

  // Send a message and report it
  await helpers.sendMessage(zodPage, 'Report this message');

  // Navigate away and back to work around potential bug mentioned in Maestro test
  await zodPage.getByTestId('HomeNavIcon').click();
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  // Report the message
  await helpers.reportMessage(zodPage, 'Report this message');

  // Send a message and delete it
  await helpers.sendMessage(zodPage, 'Delete this message');
  await helpers.deleteMessage(zodPage, 'Delete this message');

  // Send a message and edit it
  await helpers.sendMessage(zodPage, 'Edit this message');
  await helpers.editMessage(zodPage, 'Edit this message', 'Edited message');

  // Mention a user in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @ten');
  await expect(zodPage.getByTestId('~ten-contact')).toBeVisible();
  await zodPage.getByTestId('~ten-contact').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(
    zodPage.getByTestId('Post').getByText('mentioning ~ten')
  ).toBeVisible();

  // Mention all in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @all');
  await expect(zodPage.getByTestId('-all--group')).toBeVisible();
  await zodPage.getByTestId('-all--group').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(
    zodPage.getByTestId('Post').getByText('mentioning @all')
  ).toBeVisible();

  // Mention a role in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @admin');
  await expect(zodPage.getByTestId('admin-group')).toBeVisible();
  await zodPage.getByTestId('admin-group').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(
    zodPage.getByTestId('Post').getByText('mentioning @admin')
  ).toBeVisible();
});

test('should require confirmation before deleting a message (cancel prevents deletion)', async ({
  zodSetup,
}) => {
  const zodPage = zodSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);

  // Navigate back to Home and navigate to group
  await helpers.navigateToGroupByTestId(zodPage);

  // Send a message
  await helpers.sendMessage(zodPage, 'Cancel delete test message');

  // Open action menu and click delete
  await helpers.longPressMessage(zodPage, 'Cancel delete test message');
  await zodPage.getByText('Delete message').click();

  // Confirmation dialog should appear — click Cancel
  await expect(zodPage.getByRole('dialog')).toBeVisible();
  await zodPage
    .getByRole('dialog')
    .getByText('Cancel', { exact: true })
    .click();

  // Message should still be present
  await expect(
    zodPage.getByText('Cancel delete test message', { exact: true })
  ).toBeVisible();
});

test('should require confirmation before deleting a message (escape prevents deletion)', async ({
  zodSetup,
}) => {
  const zodPage = zodSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);

  // Navigate back to Home and navigate to group
  await helpers.navigateToGroupByTestId(zodPage);

  // Send a message
  await helpers.sendMessage(zodPage, 'Escape delete test message');

  // Open action menu and click delete
  await helpers.longPressMessage(zodPage, 'Escape delete test message');
  await zodPage.getByText('Delete message').click();

  // Confirmation dialog should appear — press Escape
  await expect(zodPage.getByRole('dialog')).toBeVisible();
  await zodPage.keyboard.press('Escape');

  // Message should still be present
  await expect(
    zodPage.getByText('Escape delete test message', { exact: true })
  ).toBeVisible();
});

test('should require confirmation before deleting a message (overlay click prevents deletion)', async ({
  zodSetup,
}) => {
  const zodPage = zodSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);

  // Navigate back to Home and navigate to group
  await helpers.navigateToGroupByTestId(zodPage);

  // Send a message
  await helpers.sendMessage(zodPage, 'Overlay delete test message');

  // Open action menu and click delete
  await helpers.longPressMessage(zodPage, 'Overlay delete test message');
  await zodPage.getByText('Delete message').click();

  // Confirmation dialog should appear — click the overlay (top-left corner)
  await expect(zodPage.getByRole('dialog')).toBeVisible();
  await zodPage.mouse.click(10, 10);

  // Message should still be present
  await expect(
    zodPage.getByText('Overlay delete test message', { exact: true })
  ).toBeVisible();
});

test('should allow admin to delete another user message with confirmation', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and navigate to group
  await zodPage.getByTestId('HomeNavIcon').click();
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  // ~ten accepts group invite and sends a message
  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.acceptGroupInvite(tenPage, groupName);
  await helpers.navigateToChannel(tenPage, 'General');
  await helpers.sendMessage(tenPage, 'Admin delete target message');

  // Wait for message to sync to ~zod
  await expect(
    zodPage.getByText('Admin delete target message', { exact: true })
  ).toBeVisible({ timeout: 15000 });

  // ~zod (admin) opens action menu on ~ten's message
  await helpers.longPressMessage(zodPage, 'Admin delete target message');

  // Verify admin delete label appears
  await expect(zodPage.getByText('Admin: Delete message')).toBeVisible();

  // Click admin delete
  await zodPage.getByText('Admin: Delete message').click();

  // Confirmation dialog should appear — confirm deletion using real mouse
  // coordinates to exercise the Popover outside-click dismissal guard
  await expect(zodPage.getByRole('dialog')).toBeVisible();
  const confirmBtn = zodPage
    .getByRole('dialog')
    .getByText('Delete message', { exact: true });
  const box = await confirmBtn.boundingBox();
  if (!box) throw new Error('Confirm button has no bounding box');
  await zodPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // Message should be deleted
  await expect(
    zodPage.getByText('Admin delete target message', { exact: true })
  ).not.toBeVisible();
});
