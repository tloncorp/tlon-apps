import { type Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Increase timeout for these comprehensive tests
test.setTimeout(90000);

async function expectMentionSelected(
  page: Page,
  expectedText: RegExp,
  selectedMentionTestId: string
) {
  const messageInput = page.getByTestId('MessageInput');
  await expect
    .poll(async () => (await messageInput.inputValue()).trim())
    .toMatch(expectedText);
  await expect(page.getByTestId(selectedMentionTestId)).toBeVisible();
}

async function expectMessageInputReady(page: Page) {
  const messageInput = page.getByTestId('MessageInput');
  const selectedMentions = page.locator('[data-testid^="SelectedMention-"]');
  let readySince = 0;

  await expect
    .poll(
      async () => {
        const [value, selectedMentionCount] = await Promise.all([
          messageInput.inputValue(),
          selectedMentions.count(),
        ]);

        if (value.trim() !== '' || selectedMentionCount > 0) {
          readySince = 0;
          return 'busy';
        }

        readySince ||= Date.now();
        return Date.now() - readySince >= 250 ? 'ready' : 'settling';
      },
      { timeout: 10000, intervals: [50, 100, 100, 250] }
    )
    .toBe('ready');
}

function waitForChannelPost(page: Page) {
  return page.waitForResponse(
    (response) => {
      const request = response.request();
      const postData = request.postData();

      return (
        request.method() === 'PUT' &&
        response.status() === 204 &&
        response.url().includes('/~/channel/') &&
        (!postData ||
          (postData.includes('"post"') && postData.includes('"add"')))
      );
    },
    { timeout: 10000 }
  );
}

function getPostAddFromChannelAction(postData: string | null) {
  expect(postData).toBeTruthy();

  const events = JSON.parse(postData ?? '[]') as {
    json?: {
      channel?: {
        action?: {
          post?: {
            add?: {
              content?: unknown;
            };
          };
        };
      };
    };
  }[];
  const postAdd = events.find((event) => event.json?.channel?.action?.post?.add)
    ?.json?.channel?.action?.post?.add;

  expect(postAdd).toBeTruthy();
  return postAdd;
}

async function sendCurrentMessage(
  page: Page,
  expectedText: string | RegExp,
  expectedInline: string,
  postMentionTestId: string
) {
  const postResponse = waitForChannelPost(page);
  await page.getByTestId('MessageInputSendButton').click({ force: true });
  const response = await postResponse;
  const postAdd = getPostAddFromChannelAction(response.request().postData());
  expect(JSON.stringify(postAdd?.content)).toContain(expectedInline);

  const post = page
    .getByTestId('Post')
    .filter({
      has: page.getByTestId(postMentionTestId),
      hasText: expectedText,
    })
    .first();
  await expect(post).toBeVisible({ timeout: 10000 });
  await expect(post.getByTestId(postMentionTestId)).toBeVisible();
  await expectMessageInputReady(page);
}

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
  await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });

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
  await expectMessageInputReady(zodPage);
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @ten');
  await expect(zodPage.getByTestId('~ten-contact')).toBeVisible();
  await zodPage.getByTestId('~ten-contact').click();
  await expectMentionSelected(
    zodPage,
    /^mentioning [@~]ten$/,
    'SelectedMention-~ten'
  );
  await sendCurrentMessage(
    zodPage,
    /mentioning\s+~ten/i,
    '{"ship":"~ten"}',
    'PostMention-~ten'
  );

  // Mention all in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @all');
  await expect(zodPage.getByTestId('-all--group')).toBeVisible();
  await zodPage.getByTestId('-all--group').click();
  await expectMentionSelected(
    zodPage,
    /^mentioning @all$/i,
    'SelectedMention--all-'
  );
  await sendCurrentMessage(
    zodPage,
    /mentioning\s+@all/i,
    '{"sect":null}',
    'PostMention--all-'
  );

  // Mention a role in a message
  await zodPage.getByTestId('MessageInput').click();
  await zodPage.fill('[data-testid="MessageInput"]', 'mentioning @admin');
  await expect(zodPage.getByTestId('admin-group')).toBeVisible();
  await zodPage.getByTestId('admin-group').click();
  await expectMentionSelected(
    zodPage,
    /^mentioning @admin$/i,
    'SelectedMention-admin'
  );
  await sendCurrentMessage(
    zodPage,
    /mentioning\s+@admin/i,
    '{"sect":"admin"}',
    'PostMention-admin'
  );
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
  helpers.dismissDeleteConfirmation(zodPage, 'message');
  await zodPage.getByText('Delete message').click();

  // Action menu should still be visible (Cancel leaves menu open)
  await expect(zodPage.getByTestId('ChatMessageActions')).toBeVisible();

  // Message should still be present
  await expect(
    zodPage.getByText('Cancel delete test message', { exact: true })
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
  helpers.acceptDeleteConfirmation(zodPage, 'message');
  await zodPage.getByText('Admin: Delete message').click();

  // Message should be deleted
  await expect(
    zodPage.getByText('Admin delete target message', { exact: true })
  ).not.toBeVisible();
});
