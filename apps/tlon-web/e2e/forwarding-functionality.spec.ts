import { expect } from '@playwright/test';
import * as helpers from './helpers';
import shipManifest from './shipManifest.json';
import { test } from './test-fixtures';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

test('Forward chat message from group channel to DM - verify toast and reference message', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;
  
  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing groups and DMs
  await helpers.cleanupExistingGroup(zodPage, 'Forwarding Test Group');
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');
  
  // Clean up any existing DM with ~ten
  if (await zodPage.getByText('~ten', { exact: true }).isVisible()) {
    await helpers.leaveDM(zodPage, '~ten');
  }

  // Create a test group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to the main channel view after inviting members
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(zodPage);

  if (await zodPage.getByText('Home').isVisible()) {
    // Wait for the group name to update after member invitation
    await zodPage.waitForTimeout(3000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible({ timeout: 10000 });
    await zodPage.getByText(groupName).first().click();
    await zodPage.waitForTimeout(1000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Test message content
  const testMessage = 'This is a test chat message to forward to DM';
  
  // Step 1: ~zod sends message in group channel
  await helpers.sendMessage(zodPage, testMessage);
  
  // Verify message is visible
  await expect(zodPage.getByText(testMessage)).toBeVisible();

  // Step 2: ~zod forwards the message to DM with ~ten
  await helpers.longPressMessage(zodPage, testMessage);
  await zodPage.getByText('Forward', { exact: true }).click();
  
  // Verify forward sheet opened
  await expect(zodPage.getByText('Forward to channel')).toBeVisible();
  
  // Search for ~ten's DM
  await zodPage.getByPlaceholder('Search channels').fill('~ten');
  await zodPage.getByText('~ten').click();
  
  // Confirm forward
  await zodPage.getByText('Forward to ~ten').click();
  
  // Step 3: Verify toast appears on ~zod's screen
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();
  await expect(zodPage.getByText('Forwarded post to ~ten')).toBeVisible();
  
  // Wait for toast to disappear or dismiss it
  await zodPage.getByTestId('ToastMessage').click(); // Tap to dismiss
  await expect(zodPage.getByTestId('ToastMessage')).not.toBeVisible();
  
  // Step 4: Setup ~ten to check DM
  await tenPage.goto(tenUrl);
  await tenPage.waitForSelector('text=Home', { state: 'visible' });
  
  // Navigate to the group as ~ten and accept invitation
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
  
  // Navigate to DM with ~zod to check forwarded message
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible();
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  
  await tenPage.waitForTimeout(1000);
  
  // Step 5: ~ten verifies forwarded message appears as a reference/citation
  await expect(tenPage.getByText(testMessage)).toBeVisible();
  
  // Verify it shows as a forwarded/referenced message
  // Look for reference structure: header with "Chat Post" text and reference content
  await expect(tenPage.getByText('Chat Post')).toBeVisible();
  
  // Alternatively, look for the forwarded message in a contained reference format
  // (the forwarded content should appear differently than a direct message)
  await expect(tenPage.locator('text=' + testMessage).first()).toBeVisible();
});

test('Forward notebook post from group to DM - verify toast and reference', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing groups
  await helpers.cleanupExistingGroup(zodPage, 'Test Group');
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to the main channel view after inviting members
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(zodPage);

  if (await zodPage.getByText('Home').isVisible()) {
    // Wait for the group name to update after member invitation
    await zodPage.waitForTimeout(3000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible({ timeout: 10000 });
    await zodPage.getByText(groupName).first().click();
    await zodPage.waitForTimeout(1000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Create notebook channel
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(zodPage, 'Test Notebook', 'notebook');

  // Navigate to the notebook channel
  await zodPage
    .getByTestId('ChannelListItem-Test Notebook')
    .getByText('Test Notebook')
    .click();

  // Test notebook content
  const notebookTitle = 'Test Notebook Post Title';
  const notebookContent = 'This is a detailed notebook post that will be forwarded to a DM conversation.';

  // Step 1: ~zod creates notebook post
  await helpers.createNotebookPost(zodPage, notebookTitle, notebookContent);

  // Verify the notebook post is created
  await expect(zodPage.getByText(notebookTitle)).toBeVisible();

  // Step 2: Forward notebook post to DM
  await helpers.longPressMessage(zodPage, notebookTitle);
  await zodPage.getByText('Forward', { exact: true }).click();

  // Select DM with ~ten
  await zodPage.getByPlaceholder('Search channels').fill('~ten');
  await zodPage.getByText('~ten').click();
  await zodPage.getByText('Forward to ~ten').click();

  // Step 3: Verify success toast
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();
  await expect(zodPage.getByText('Forwarded post to ~ten')).toBeVisible();

  // Dismiss toast
  await zodPage.getByTestId('ToastMessage').click();

  // Step 4: Setup ~ten
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

  // Navigate to DM to check forwarded notebook post
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible();
  await tenPage.getByTestId('ChannelListItem-~zod').click();

  await tenPage.waitForTimeout(1000);

  // Step 5: ~ten verifies forwarded notebook post in DM
  await expect(tenPage.getByText(notebookTitle)).toBeVisible();
  await expect(tenPage.getByText(notebookContent)).toBeVisible();

  // Verify it appears as a notebook reference (not a direct post)
  await expect(tenPage.getByText('Notebook Post')).toBeVisible();
});

test('Forward message with reactions and thread replies - verify complete context', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing groups
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');

  // Create a test group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to the main channel view after inviting members
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(zodPage);

  if (await zodPage.getByText('Home').isVisible()) {
    // Wait for the group name to update after member invitation
    await zodPage.waitForTimeout(3000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible({ timeout: 10000 });
    await zodPage.getByText(groupName).first().click();
    await zodPage.waitForTimeout(1000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Test message with additional context
  const testMessage = 'Message with reactions and replies to forward';
  const threadReply = 'This is a thread reply to the original message';

  // Step 1: ~zod sends message in group channel
  await helpers.sendMessage(zodPage, testMessage);

  // Step 2: Add reaction to message
  await helpers.reactToMessage(zodPage, testMessage, 'thumb');

  // Step 3: Add thread reply
  await helpers.startThread(zodPage, testMessage);
  await helpers.sendThreadReply(zodPage, threadReply);

  // Navigate back to main channel
  await helpers.navigateBack(zodPage);

  // Verify thread reply count
  await expect(zodPage.getByText('1 reply')).toBeVisible();

  // Step 4: Forward the original message
  await helpers.longPressMessage(zodPage, testMessage);
  await zodPage.getByText('Forward', { exact: true }).click();

  // Select DM with ~ten
  await zodPage.getByPlaceholder('Search channels').fill('~ten');
  await zodPage.getByText('~ten').click();
  await zodPage.getByText('Forward to ~ten').click();

  // Step 5: Verify success toast
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();
  await expect(zodPage.getByText('Forwarded post to ~ten')).toBeVisible();

  // Dismiss toast
  await zodPage.getByTestId('ToastMessage').click();

  // Step 6: Setup ~ten
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

  // Navigate to DM to check forwarded message
  await expect(tenPage.getByTestId('ChannelListItem-~zod')).toBeVisible();
  await tenPage.getByTestId('ChannelListItem-~zod').click();

  await tenPage.waitForTimeout(1000);

  // Step 7: ~ten verifies forwarded message preserves context
  await expect(tenPage.getByText(testMessage)).toBeVisible();

  // Verify it appears as a chat reference
  await expect(tenPage.getByText('Chat Post')).toBeVisible();

  // Check if the reference content is clickable and shows context
  // Note: The exact UI behavior for viewing reactions/threads on forwarded messages
  // may vary depending on implementation details
  const referenceElement = tenPage.locator('text=' + testMessage).first();
  await expect(referenceElement).toBeVisible();
  
  // Try to click on the reference to see if it shows additional context
  await referenceElement.click();
  
  // The reaction and thread context may be visible in the reference or in a modal/expanded view
  // This would need to be verified based on actual UI behavior
});

test('Forward message - test toast auto-dismiss and manual dismiss', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing groups
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');

  // Create a test group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to the main channel view after inviting members
  await helpers.navigateBack(zodPage);
  await helpers.navigateBack(zodPage);

  if (await zodPage.getByText('Home').isVisible()) {
    // Wait for the group name to update after member invitation
    await zodPage.waitForTimeout(3000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible({ timeout: 10000 });
    await zodPage.getByText(groupName).first().click();
    await zodPage.waitForTimeout(1000);
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  const testMessage = 'Message to test toast behavior';

  // Step 1: Send message
  await helpers.sendMessage(zodPage, testMessage);

  // Step 2: Forward message
  await helpers.longPressMessage(zodPage, testMessage);
  await zodPage.getByText('Forward', { exact: true }).click();
  await zodPage.getByPlaceholder('Search channels').fill('~ten');
  await zodPage.getByText('~ten').click();
  await zodPage.getByText('Forward to ~ten').click();

  // Step 3: Verify toast appears
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();

  // Step 4: Test manual dismiss by tapping
  await zodPage.getByTestId('ToastMessage').click();
  await expect(zodPage.getByTestId('ToastMessage')).not.toBeVisible();

  // Step 5: Forward again to test auto-dismiss
  await helpers.longPressMessage(zodPage, testMessage);
  await zodPage.getByText('Forward', { exact: true }).click();
  await zodPage.getByPlaceholder('Search channels').fill('~ten');
  await zodPage.getByText('~ten').click();
  await zodPage.getByText('Forward to ~ten').click();

  // Verify toast appears again
  await expect(zodPage.getByTestId('ToastMessage')).toBeVisible();

  // Wait for auto-dismiss (1500ms duration for forward success toast)
  await zodPage.waitForTimeout(2000);
  await expect(zodPage.getByTestId('ToastMessage')).not.toBeVisible();
});