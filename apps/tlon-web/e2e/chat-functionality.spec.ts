import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test comprehensive chat functionality', async ({ browser }) => {
  const zodContext = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  const tenContext = await browser.newContext({
    storageState: shipManifest['~ten'].authFile,
  });
  const zodPage = await zodContext.newPage();
  const tenPage = await tenContext.newPage();
  // Launch and login
  await zodPage.goto(zodUrl);
  await zodPage.waitForSelector('text=Home', { state: 'visible' });
  await zodPage.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing group
  await helpers.cleanupExistingGroup(zodPage);
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
    await zodPage.getByText(groupName).first().click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

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

  // Switch to ~ten to navigate to chat and hide the message
  await tenPage.goto(tenUrl);
  await tenPage.waitForSelector('text=Home', { state: 'visible' });

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Wait for the group invitation and accept it
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Group invitation')).toBeVisible();
  await tenPage.getByText('Group invitation').click();

  // Accept the invitation
  if (await tenPage.getByText('Accept invite').isVisible()) {
    await tenPage.getByText('Accept invite').click();
  }

  // Wait for joining process and go to group
  await tenPage.waitForSelector('text=Joining, please wait...');
  await tenPage.waitForSelector('text=Go to group', { state: 'visible' });

  if (await tenPage.getByText('Go to group').isVisible()) {
    await tenPage.getByText('Go to group').click();
  } else {
    await tenPage.getByText(groupName).first().click();
  }

  await expect(tenPage.getByText(groupName).first()).toBeVisible();

  // Open the General channel
  await helpers.navigateToChannel(tenPage, 'General');

  // Hide the message that ~zod sent
  await helpers.hideMessage(tenPage, 'Hide this message');

  // Clean up ~ten context
  await tenContext.close();

  // Send a message and report it
  await helpers.sendMessage(zodPage, 'Report this message');

  // Navigate away and back to work around potential bug mentioned in Maestro test
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
    await zodPage.getByText(groupName).first().click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Report the message
  if (
    await zodPage.getByText('Report this message', { exact: true }).isVisible()
  ) {
    await helpers.reportMessage(zodPage, 'Report this message');
  }

  // Send a message and delete it
  await helpers.sendMessage(zodPage, 'Delete this message');
  await helpers.deleteMessage(zodPage, 'Delete this message');

  // Send a message and edit it
  await helpers.sendMessage(zodPage, 'Edit this message');
  await helpers.editMessage(zodPage, 'Edit this message', 'Edited message');

  // Mention a user in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @ten');
  await zodPage.getByTestId('~ten-contact').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(zodPage.getByText('mentioning ~ten')).toBeVisible();

  // Mention all in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @all');
  await zodPage.getByTestId('-all--group').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(zodPage.getByText('mentioning @all')).toBeVisible();

  // Mention a role in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @admin');
  await zodPage.getByTestId('admin-group').click();
  await zodPage.getByTestId('MessageInputSendButton').click();
  // Wait for message to appear
  await expect(zodPage.getByText('mentioning @admin')).toBeVisible();

  // Delete the group and clean up
  await helpers.openGroupSettings(zodPage);
  await helpers.deleteGroup(zodPage, groupName);

  // Verify we're back at Home and group is deleted
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(zodPage.getByText(groupName)).not.toBeVisible();
});
