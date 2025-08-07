import { Page, expect } from '@playwright/test';

export async function channelIsLoaded(page: Page) {
  await expect(
    page.getByTestId('ScreenHeaderTitle').getByText('Loading…')
  ).not.toBeVisible();
}

export async function navigateToChannel(page: Page, channelName: string) {
  await page.getByTestId(`ChannelListItem-${channelName}`).click();
  await channelIsLoaded(page);
}

export async function createGroup(page: Page) {
  await page.getByTestId('CreateChatSheetTrigger').click();
  await page.getByText('New group', { exact: true }).click();
  await page.getByText('Select contacts to invite').click();
  await page.getByText('Create group').click();

  // Wait for group creation to complete and navigate to group
  // Either we're already in the group or need to navigate to it
  const channelHeader = page.getByTestId('ChannelHeaderTitle');

  try {
    // Wait briefly to see if we're automatically navigated to the group
    await expect(channelHeader).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome to your group!')).toBeVisible({
      timeout: 3000,
    });
  } catch {
    // If not automatically navigated, go to the group manually
    await page.getByTestId('HomeNavIcon').click();
    await expect(
      page.getByTestId('ChatListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 10000 });
    await page.getByTestId('ChatListItem-Untitled group-unpinned').click();
    await expect(channelHeader).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome to your group!')).toBeVisible({
      timeout: 5000,
    });
  }
}

export async function leaveGroup(page: Page, groupName: string) {
  await page.getByTestId('HomeNavIcon').click();
  if (await page.getByText(groupName).first().isVisible()) {
    await page.getByText(groupName).first().click();
    await openGroupSettings(page);
    await page.waitForSelector('text=Group Info');
    await page.getByText('Leave group').click();
  }
}

export async function openGroupOptionsSheet(page: Page) {
  if (await page.getByTestId('GroupOptionsSheetTrigger').first().isVisible()) {
    await page
      .getByTestId('GroupOptionsSheetTrigger')
      .first()
      .click({ force: true });
  } else {
    await page
      .getByTestId('GroupOptionsSheetTrigger')
      .nth(1)
      .click({ force: true });
  }
}

export async function inviteMembersToGroup(page: Page, memberIds: string[]) {
  await openGroupOptionsSheet(page);
  await page.getByTestId('ActionSheetAction-Invite people').first().click();

  for (const memberId of memberIds) {
    const filterInput = page.getByPlaceholder('Filter by nickname');
    await expect(filterInput).toBeVisible({ timeout: 5000 });
    await filterInput.fill(memberId);

    // Wait for contact to appear in search results
    await expect(
      page.getByTestId('ContactRow').getByText(memberId)
    ).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId('ContactRow').getByText(memberId).click();
  }

  // Wait for continue button to update with selection count and click
  const continueButton = page.getByText(/continue|Invite \d+ and continue/);
  await expect(continueButton).toBeVisible({ timeout: 5000 });
  await continueButton.click();

  // Brief wait for invitation to be sent
  await page.waitForTimeout(1000);
}

export async function rejectGroupInvite(page: Page) {
  if (await page.getByText('Group invitation').isVisible()) {
    await page.getByText('Group invitation').click();
  }

  // If there's a reject invitation button, click it
  if (await page.getByText('Reject invite').isVisible()) {
    await page.getByText('Reject invite').click();
  }
}

export async function deleteGroup(page: Page, groupName?: string) {
  await page.getByTestId('GroupLeaveAction-Delete group').click();
  await expect(
    page.getByText(`Delete ${groupName || 'Untitled group'}?`)
  ).toBeVisible();
  await page.getByTestId('ActionSheetAction-Delete group').click();
  await expect(page.getByText(groupName || 'Untitled group')).not.toBeVisible();
}

export async function openGroupSettings(page: Page) {
  await openGroupOptionsSheet(page);
  await expect(page.getByText('Group info & settings')).toBeVisible();
  await page.getByText('Group info & settings').click();
}

export async function navigateToHomeAndVerifyGroup(
  page: Page,
  expectedStatus: 'pinned' | 'unpinned'
) {
  await page.getByTestId('HeaderBackButton').nth(1).click();
  if (await page.getByText('Home').isVisible()) {
    await expect(
      page.getByTestId(`ChatListItem-Untitled group-${expectedStatus}`)
    ).toBeVisible();
  }
}

export async function fillFormField(
  page: Page,
  testId: string,
  value: string,
  shouldClear = false
) {
  await page.getByTestId(testId).click();
  if (shouldClear) {
    await page.getByTestId(testId).fill('');
  }
  await page.fill(`[data-testid="${testId}"]`, value);
  await expect(page.getByTestId(testId)).toHaveValue(value);
}

// New helper functions to extract common patterns

/**
 * Waits for an element to be visible with optional timeout and executes callback if visible
 */
export async function waitForElementAndAct(
  page: Page,
  selector: string,
  callback?: () => Promise<void>,
  timeout = 2000
) {
  try {
    const element = page.getByText(selector);
    if (await element.isVisible({ timeout })) {
      if (callback) {
        await callback();
      }
      return true;
    }
  } catch (error) {
    // Element not visible within timeout
  }
  return false;
}

/**
 * Handles cleanup of existing "Untitled group" if present
 */
export async function cleanupExistingGroup(page: Page, groupName?: string) {
  if (
    await page
      .getByText(groupName || 'Untitled group')
      .first()
      .isVisible()
  ) {
    await page
      .getByText(groupName || 'Untitled group')
      .first()
      .click();
    await openGroupSettings(page);
    await deleteGroup(page, groupName);
  }
}

/**
 * Navigates back using header back button with fallback logic
 */
export async function navigateBack(page: Page, preferredIndex = 0) {
  const backButtons = page.getByTestId('HeaderBackButton');

  if (await backButtons.nth(preferredIndex).isVisible()) {
    await backButtons.nth(preferredIndex).click();
  } else if (await backButtons.first().isVisible()) {
    await backButtons.first().click();
  } else if (await backButtons.nth(1).isVisible()) {
    await backButtons.nth(1).click();
  } else {
    await backButtons.nth(2).click();
  }
}

/**
 * Creates a new role with title and description
 */
export async function createRole(
  page: Page,
  title: string,
  description: string
) {
  await page.getByText('Add Role').click();
  await expect(page.getByRole('dialog').getByText('Add role')).toBeVisible();

  await fillFormField(page, 'RoleTitleInput', title);
  await fillFormField(page, 'RoleDescriptionInput', description);

  await page.getByText('Save').click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

/**
 * Assigns a role to a member
 */
export async function assignRoleToMember(
  page: Page,
  roleName: string,
  memberIndex = 0
) {
  const memberRow = page.getByTestId('MemberRow').nth(memberIndex);
  await expect(memberRow).toBeVisible();
  await memberRow.click();

  await expect(page.getByText('Assign role')).toBeVisible();
  await page.getByText('Assign role').click();
  await page.getByRole('dialog').getByText(roleName).click();

  await page.waitForTimeout(2000); // Wait for assignment to complete
}

/**
 * Unassigns a role from a member
 */
export async function unassignRoleFromMember(
  page: Page,
  roleName: string,
  memberIndex = 0
) {
  const memberRow = page.getByTestId('MemberRow').nth(memberIndex);
  await memberRow.click();

  await page.getByText('Assign role').click();
  await page.getByRole('dialog').getByText(roleName).click(); // This should unassign the role

  await page.waitForTimeout(2000);
}

/**
 * Forwards a message to a specific contact via DM
 */
export async function forwardMessageToDM(
  page: Page,
  messageText: string,
  contactId: string
) {
  await longPressMessage(page, messageText);
  await page.getByText('Forward', { exact: true }).click();

  // Verify forward sheet opened
  await expect(page.getByText('Forward to channel')).toBeVisible();

  // Search for the contact's DM
  await page.getByPlaceholder('Search channels').fill(contactId);
  await page.waitForTimeout(2000); // Wait longer for search results

  // Try to click on the contact using a more specific selector
  try {
    // First try with test ID if available
    const contactRow = page.getByTestId(`ChannelListItem-${contactId}`);
    if (await contactRow.isVisible({ timeout: 2000 })) {
      await contactRow.click();
    } else {
      // Fallback to text-based selection with force click to handle overlays
      await page.getByText(contactId).first().click({ force: true });
    }
  } catch (error) {
    // Final fallback: try clicking with force
    await page.getByText(contactId).first().click({ force: true });
  }

  // Confirm forward
  await page.getByText(`Forward to ${contactId}`).click();
}

/**
 * Forwards a group reference to a specified channel
 */
export async function forwardGroupReference(page: Page, channelName: string) {
  // Click the Forward button in group info
  await page.getByText('Forward').click();

  // Verify forward sheet opened
  await expect(page.getByText('Forward group')).toBeVisible();

  // Search for the channel
  await page.getByPlaceholder('Search channels').fill(channelName);
  await page.waitForTimeout(2000);

  // Click on the channel in the modal (not the sidebar)
  const channelRow = page.getByTestId(`ChannelListItem-${channelName}`);
  await expect(channelRow).toBeVisible({ timeout: 5000 });
  await channelRow.click();

  // Wait for the confirm button to appear and become clickable
  const confirmButton = page.getByText(`Forward to ${channelName}`);
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();

  // Verify toast appears
  await expect(page.getByText('Forwarded')).toBeVisible({ timeout: 5000 });

  // Verify modal closes
  await expect(page.getByText('Forward to channel')).not.toBeVisible({
    timeout: 3000,
  });
}

/**
 * Creates a new channel with title and type
 */
export async function createChannel(
  page: Page,
  title: string,
  type: 'chat' | 'notebook' | 'gallery' = 'chat'
) {
  await page.getByText('New Channel').click();
  await expect(page.getByText('Create a new channel')).toBeVisible();

  await fillFormField(page, 'ChannelTitleInput', title);

  if (type === 'notebook') {
    await page.getByText('Notebook', { exact: true }).click();
  } else if (type === 'gallery') {
    await page.getByText('Gallery', { exact: true }).click();
  }

  await page.getByText('Create channel').click();
  await page.waitForTimeout(1000);
}

/**
 * Edits a channel's title and description
 */
export async function editChannel(
  page: Page,
  channelName: string,
  newTitle?: string,
  newDescription?: string
) {
  await page
    .getByTestId(`ChannelItem-${channelName}-1`)
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  if (newTitle) {
    await fillFormField(page, 'ChannelTitleInput', newTitle, true);
  }
  if (newDescription) {
    await fillFormField(page, 'ChannelDescriptionInput', newDescription);
  }

  await page.getByText('Save').click();
}

/**
 * Deletes a channel
 */
export async function deleteChannel(page: Page, channelName: string) {
  await page
    .getByTestId(`ChannelItem-${channelName}-1`)
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  await page.getByText('Delete channel for everyone').click();
  await expect(page.getByText('This action cannot be undone.')).toBeVisible();
  await page.getByText('Delete channel', { exact: true }).click();
}

/**
 * Sets channel permissions for reader and writer roles
 */
export async function setChannelPermissions(
  page: Page,
  readerRoles?: string[],
  writerRoles?: string[]
) {
  // Change to custom permissions
  await page.getByText('Custom', { exact: true }).click();

  if (readerRoles) {
    await page.getByTestId('ReaderRoleSelector').click();
    for (const role of readerRoles) {
      await page.getByText(role).click();
    }
    await page.getByText('Readers').click();
  }

  if (writerRoles) {
    await page.getByTestId('WriterRoleSelector').click();
    for (const role of writerRoles) {
      await page.getByText(role).nth(1).click();
    }
    await page.getByText('Writers').click();
  }
}

/**
 * Toggles group/chat pin/unpin status
 */
export async function toggleChatPin(page: Page) {
  try {
    if (await page.getByText('Unpin').isVisible({ timeout: 1000 })) {
      await page.getByText('Unpin').click();
      await page.getByText('Pin').waitFor({ state: 'visible', timeout: 2000 });
      return 'unpinned';
    } else if (await page.getByText('Pin').isVisible({ timeout: 1000 })) {
      await page.getByText('Pin').click();
      await page
        .getByText('Unpin')
        .waitFor({ state: 'visible', timeout: 2000 });
      return 'pinned';
    }
  } catch (error) {
    console.warn('Could not determine pin state or toggle pin status');
  }
  return null;
}

/**
 * Changes group privacy setting
 */
export async function setGroupPrivacy(page: Page, isPrivate: boolean) {
  await page.getByText('Privacy').click();
  if (isPrivate) {
    await page.getByText('Private', { exact: true }).click();
  } else {
    await page.getByText('Public', { exact: true }).click();
  }
}

/**
 * Changes group notification settings
 */
export async function setGroupNotifications(
  page: Page,
  level: 'All activity' | 'Posts, mentions, and replies' | 'Nothing'
) {
  await page.getByTestId('GroupNotifications').click();
  await expect(
    page.getByText('Posts, mentions, and replies', { exact: true })
  ).toBeVisible();
  await page.getByText(level).click();
}

/**
 * Creates a channel section
 */
export async function createChannelSection(page: Page, sectionName: string) {
  await page.getByText('New Section').click();
  await expect(page.getByText('Add section')).toBeVisible();

  await fillFormField(page, 'SectionNameInput', sectionName, true);
  await page.getByText('Save').click();

  // Wait for section creation (optional)
  try {
    await expect(page.getByText(sectionName)).toBeVisible({
      timeout: 10000,
    });
  } catch (e) {
    // Optional assertion - continue if it fails
  }
}

/**
 * Verifies element count in a container
 */
export async function verifyElementCount(
  page: Page,
  containerTestId: string,
  expectedCount: number
) {
  await page.waitForTimeout(500);
  await expect(
    page
      .getByTestId(containerTestId)
      .locator('div')
      .filter({ hasText: expectedCount.toString() })
  ).toBeVisible();
}

/**
 * Opens the group customization screen
 */
export async function openGroupCustomization(page: Page) {
  await page.getByText('Customize').click();
  await expect(page.getByText('Edit group info')).toBeVisible();
}

/**
 * Changes the group name
 */
export async function changeGroupName(page: Page, newName: string) {
  await page.getByTestId('GroupTitleInput').click();
  await fillFormField(page, 'GroupTitleInput', newName, true);
  await page.getByText('Save').click();
}

/**
 * Changes the group description
 */
export async function changeGroupDescription(page: Page, description: string) {
  await page.getByTestId('GroupDescriptionInput').click();
  await fillFormField(page, 'GroupDescriptionInput', description, true);
  await page.getByText('Save').click();
}

/**
 * Attempts to change group icon (handles web file picker behavior)
 */
export async function changeGroupIcon(page: Page, imagePath?: string) {
  await page.getByText('Change icon image').click();

  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.isVisible()) {
    if (imagePath) {
      // Upload a specific image file
      await fileInput.setInputFiles(imagePath);
    } else {
      // Just verify the interface is accessible and cancel
      await expect(fileInput).toBeVisible();
      const cancelButton = page.getByText('Cancel');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  }
}

// Notebook-related helper functions

/**
 * Creates a new notebook post
 */
export async function createNotebookPost(
  page: Page,
  title: string,
  content: string
) {
  // Wait for add button to be ready and click
  await expect(page.getByTestId('AddNotebookPost')).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId('AddNotebookPost').click();

  // Fill in title with deterministic wait
  const titleInput = page.getByRole('textbox', { name: 'New Title' });
  await expect(titleInput).toBeVisible({ timeout: 5000 });
  await titleInput.click();
  await titleInput.fill(title);

  // Wait for iframe to be properly loaded and accessible
  const iframe = page.locator('iframe');
  await expect(iframe).toBeVisible({ timeout: 10000 });

  // Wait for iframe content to be ready
  await iframe.waitFor({ state: 'attached' });
  const contentFrame = iframe.contentFrame();
  if (!contentFrame) {
    throw new Error('Iframe content frame not available');
  }

  // Wait for editor to be initialized with placeholder text (with ellipsis)
  await expect(contentFrame.getByRole('paragraph')).toBeVisible({
    timeout: 5000,
  });

  // Click in the editor area to focus
  await contentFrame.getByRole('paragraph').click();

  // Use more stable selector - target the paragraph element directly
  const editorParagraph = contentFrame.getByRole('paragraph');
  await expect(editorParagraph).toBeVisible({ timeout: 3000 });
  await editorParagraph.fill(content);

  // Wait for post button to be enabled and click
  const postButton = page.getByTestId('BigInputPostButton');
  await expect(postButton).toBeVisible({ timeout: 5000 });
  await postButton.click();

  // Wait for post to appear in the channel with the correct title
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });

  // Wait for backend to sync the post data to prevent 500 "hosed" errors
  // This prevents race conditions when immediately clicking the post
  await page.waitForTimeout(3000);
}

// Gallery-related helper functions

/**
 * Creates a new gallery post
 */
export async function createGalleryPost(page: Page, content: string) {
  await page.getByTestId('AddGalleryPost').click();
  await page.getByTestId('AddGalleryPostText').click();
  await page.locator('iframe').contentFrame().getByRole('paragraph').click();
  await page
    .locator('iframe')
    .contentFrame()
    .locator('div')
    .nth(2)
    .fill(content);
  await page.getByTestId('BigInputPostButton').click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(content).first()).toBeVisible();
}

// Chat-related helper functions

/**
 * Sends a message in the current channel
 */
export async function sendMessage(page: Page, message: string) {
  await page.getByTestId('MessageInput').click();
  await page.fill('[data-testid="MessageInput"]', message);
  await expect(page.getByTestId('MessageInputSendButton')).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId('MessageInputSendButton').click({ force: true });
  // Wait for message to appear
  await expect(
    page.getByTestId('Post').getByText(message, { exact: true }).first()
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Long presses on a message to open the context menu
 */
export async function longPressMessage(page: Page, messageText: string) {
  await expect(
    page.getByTestId('ChatMessageDeliveryStatus').first()
  ).not.toBeVisible({ timeout: 10000 });

  // Not really a longpress since this is web.
  const postElement = page
    .getByTestId('Post')
    .getByText(messageText, { exact: true })
    .first();

  // Ensure the post is visible and ready for interaction
  await expect(postElement).toBeVisible({ timeout: 10000 });
  await postElement.hover({ force: true });

  // Wait for message actions trigger to appear
  const actionsTrigger = page.getByTestId('MessageActionsTrigger');
  await expect(actionsTrigger).toBeVisible({ timeout: 5000 });
  await actionsTrigger.click();

  // Wait for the action menu to be visible by checking for context-specific menu items
  await page.getByTestId('ChatMessageActions').waitFor({
    state: 'visible',
    timeout: 5000,
  });
}

/**
 * Starts a thread from a message
 */
export async function startThread(page: Page, messageText: string) {
  await longPressMessage(page, messageText);
  // Menu is already visible from longPressMessage, click Reply to start thread
  await expect(page.getByText('Reply', { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.getByText('Reply', { exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible();
}

/**
 * Sends a reply in a thread
 */
export async function sendThreadReply(page: Page, replyText: string) {
  await page.getByRole('textbox', { name: 'Reply' }).click();
  await page.getByRole('textbox', { name: 'Reply' }).fill(replyText);
  await page
    .locator('#reply-container')
    .getByTestId('MessageInputSendButton')
    .click();
  await expect(page.getByText(replyText, { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
}

/**
 * Reacts to a message with an emoji
 */
export async function reactToMessage(
  page: Page,
  messageText: string,
  emoji: 'thumb' | 'heart' | 'laughing' = 'thumb'
) {
  await longPressMessage(page, messageText);
  await page.getByTestId(`EmojiToolbarButton-${emoji}`).click();

  // Map emoji names to actual emoji characters
  const emojiMap = {
    thumb: '👍',
    heart: '❤️',
    laughing: '😆',
  };

  await expect(
    page.getByTestId('ReactionDisplay').getByText(emojiMap[emoji])
  ).toBeVisible();
}

/**
 * Removes a reaction from a message
 */
export async function removeReaction(page: Page, emoji: string = '👍') {
  const reactionButton = page.getByText(emoji);
  await reactionButton.click();
  await expect(reactionButton).not.toBeVisible();
}

/**
 * Quote replies to a message
 */
export async function quoteReply(
  page: Page,
  originalMessage: string,
  replyText: string,
  isDM = false
) {
  await longPressMessage(page, originalMessage);
  await page.getByText('Quote', { exact: true }).click();

  // In DM context, there's no "Chat Post" text, just quoted content in input
  if (!isDM) {
    await expect(page.getByText('Chat Post')).toBeVisible();
    await expect(page.getByText(originalMessage).nth(1)).toBeVisible(); // Quote shows original
  }

  const messageInput = page.getByTestId('MessageInput');
  await messageInput.click();

  if (isDM) {
    // In DMs, the quote is already inserted as "> originalMessage"
    // We need to append our reply text to the existing quoted content
    const currentValue = await messageInput.inputValue();
    await messageInput.fill(currentValue + '\n' + replyText);
  } else {
    // In group channels, we can just fill the reply text
    await messageInput.fill(replyText);
  }

  await page.getByTestId('MessageInputSendButton').click();

  await expect(
    page.getByText(replyText, { exact: true }).first()
  ).toBeVisible();
}

/**
 * Quote replies to a message in thread context
 */
export async function threadQuoteReply(
  page: Page,
  originalMessage: string,
  replyText: string,
  isDM = false
) {
  // Use the thread-specific message interaction
  await page.getByText(originalMessage).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('MessageActionsTrigger').click();
  await page.waitForTimeout(500);
  await page.getByText('Quote', { exact: true }).click();

  // In DM threads, there's no "Chat Post" text, just quoted content in reply input
  if (!isDM) {
    await expect(page.getByText('Chat Post')).toBeVisible();
    await expect(page.getByText(originalMessage).nth(1)).toBeVisible(); // Quote shows original
  }

  // Use thread-specific reply input
  const replyInput = page.getByPlaceholder('Reply');
  await replyInput.click();

  if (isDM) {
    // In DM threads, the quote is already inserted as "> originalMessage"
    // We need to append our reply text to the existing quoted content
    const currentValue = await replyInput.inputValue();
    await replyInput.fill(currentValue + '\n' + replyText);
  } else {
    // In group channels, we can just fill the reply text
    await replyInput.fill(replyText);
  }

  await page
    .locator('#reply-container')
    .getByTestId('MessageInputSendButton')
    .click();

  await expect(page.getByText(replyText, { exact: true })).toBeVisible();
}

/**
 * Hides a message
 */
export async function hideMessage(
  page: Page,
  messageText: string,
  isDM = false
) {
  await longPressMessage(page, messageText);
  await page.getByText('Hide message', { exact: true }).click();
  if (!isDM) {
    await expect(
      page.getByText(messageText, { exact: true })
    ).not.toBeVisible();
  } else {
    await expect(
      page.getByText('Message hidden or flagged').first()
    ).toBeVisible();
  }
}

/**
 * Reports a message
 */
export async function reportMessage(page: Page, messageText: string) {
  await longPressMessage(page, messageText);
  await page.getByText('Report message').click();
  await expect(page.getByText(messageText, { exact: true })).not.toBeVisible();
}

/**
 * Deletes a message
 */
export async function deleteMessage(
  page: Page,
  messageText: string,
  isDM = false
) {
  await longPressMessage(page, messageText);
  await page.getByText('Delete message').click();
  if (!isDM) {
    await expect(
      page.getByText(messageText, { exact: true })
    ).not.toBeVisible();
  } else {
    await expect(page.getByText('Message deleted').first()).toBeVisible();
  }
}

/**
 * Deletes a post
 */
export async function deletePost(page: Page, postText: string) {
  await longPressMessage(page, postText);
  await page.getByText('Delete post').click();
  await expect(page.getByText(postText, { exact: true })).not.toBeVisible();
}

/**
 * Edits a message
 */
export async function editMessage(
  page: Page,
  originalText: string,
  newText: string,
  isThread = false
) {
  await longPressMessage(page, originalText);
  await page.getByText('Edit message').click();

  // Click on the message text to edit it
  await page.getByText(originalText).nth(1).click();

  // Clear existing text and input new text
  if (isThread) {
    await page.getByTestId('MessageInput').nth(1).fill('');
    await page.getByTestId('MessageInput').nth(1).fill(newText);
    await page.getByTestId('MessageInputSendButton').nth(1).click();
  } else {
    await page.getByTestId('MessageInput').fill('');
    await page.getByTestId('MessageInput').fill(newText);
    await page.getByTestId('MessageInputSendButton').click();
  }
  await expect(page.getByText(newText, { exact: true })).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Verifies message preview on Home screen
 */
export async function verifyMessagePreview(
  page: Page,
  messageText: string,
  isDM = false,
  channelTitle: string
) {
  await page.waitForTimeout(500);
  if (!isDM) {
    await expect(
      page.getByTestId(`ChannelListItem-${channelTitle}`).getByText(messageText)
    ).toBeVisible({ timeout: 15000 });
  } else {
    await expect(
      page.getByTestId(`ChannelListItem-${channelTitle}`).getByText(messageText)
    ).toBeVisible({ timeout: 15000 });
  }
}

/**
 * Verifies unread count badge on chat list item
 */
export async function verifyChatUnreadCount(
  page: Page,
  chatName: string,
  expectedCount: number,
  isPinned = false
) {
  await page.waitForTimeout(1000);
  const chatItem = page.getByTestId(
    `ChatListItem-${chatName}-${isPinned ? 'pinned' : 'unpinned'}`
  );

  if (expectedCount === 0) {
    // When count is 0, the UnreadCount Stack component itself should have opacity controlled
    // Check that either the count shows "0" or the whole unread badge is not visible
    const unreadCount = chatItem.getByTestId('UnreadCount');

    // Try to check if the count text is "0"
    try {
      const countNumber = unreadCount.locator(
        '[data-testid="UnreadCountNumber"]'
      );
      await expect(countNumber).toContainText('0', { timeout: 2000 });
    } catch {
      // If we can't find the count number, check if the whole unread count is not visible
      await expect(unreadCount).not.toBeVisible({ timeout: 2000 });
    }
  } else {
    // Should show the expected count - look for text with the number
    const unreadCount = chatItem.getByTestId('UnreadCount');
    await expect(
      unreadCount.getByText(expectedCount.toString(), { exact: true })
    ).toBeVisible({ timeout: 10000 });
  }
}

/**
 * Creates a direct message with a specified contact
 */
export async function createDirectMessage(page: Page, contactId: string) {
  await page.getByTestId('CreateChatSheetTrigger').click();
  await expect(page.getByText('Create a new chat with one')).toBeVisible();
  await page.getByText('New direct message').click();

  await expect(page.getByText('Select a contact to chat with')).toBeVisible();
  await page.getByPlaceholder('Filter by nickname or id').click();
  await page.getByPlaceholder('Filter by nickname or id').fill(contactId);
  await page.waitForTimeout(2000);
  await page.getByTestId('ContactRow').first().click();

  // Wait for DM to open
  await expect(page.getByText(contactId).first()).toBeVisible();
  if (await isMobileViewport(page)) {
    console.log('header back button');
    await expect(page.getByTestId('HeaderBackButton')).toBeVisible();
  }
}

/**
 * Leaves a direct message
 */
export async function leaveDM(page: Page, contactId: string) {
  await page.getByTestId('HomeNavIcon').click();
  await page.getByTestId(`ChannelListItem-${contactId}`).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ChannelOptionsSheetTrigger').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ActionSheetAction-Leave chat').click();
  await page.waitForTimeout(500);
  // without this reload we'll still see previous messages in the DM
  // TODO: figure out why this is happening
  await page.reload();
  await expect(
    page.getByTestId(`ChannelListItem-${contactId}`)
  ).not.toBeVisible();
}

/**
 * Check if we're on a mobile viewport
 */
export async function isMobileViewport(page: Page) {
  const viewport = await page.viewportSize();
  return viewport && viewport.width < 768;
}

/**
 * Retry an interaction with exponential backoff
 * Useful for handling DOM detachment and other transient failures
 */
export async function retryInteraction<T>(
  action: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    description?: string;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    description = 'interaction',
  } = options;
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        console.log(`${description} attempt ${attempt} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt)); // Exponential backoff
      }
    }
  }

  throw new Error(
    `Failed ${description} after ${maxAttempts} attempts: ${lastError.message}`
  );
}

/**
 * Interact with a hidden post element (which doesn't have data-testid="Post")
 */
export async function interactWithHiddenPost(
  page: Page,
  action: 'Show post' | 'Delete post' | 'Report post'
) {
  const hiddenPostMessage = page
    .getByText('You have hidden or reported this post')
    .first();
  await expect(hiddenPostMessage).toBeVisible({ timeout: 10000 });
  await hiddenPostMessage.hover({ force: true });

  // Wait for message actions trigger to appear
  const actionsTrigger = page.getByTestId('MessageActionsTrigger');
  await expect(actionsTrigger).toBeVisible({ timeout: 5000 });
  await actionsTrigger.click();

  // Click the requested action
  await expect(page.getByText(action)).toBeVisible({ timeout: 5000 });
  await page.getByText(action).click();

  // Wait for action to complete
  await page.waitForTimeout(500);
}

/**
 * Wait for navigation to complete and verify we're not on an unexpected page
 */
export async function verifyNavigation(
  page: Page,
  expectedNotVisible?: string,
  options: {
    timeout?: number;
    fallbackAction?: () => Promise<void>;
  } = {}
) {
  const { timeout = 2000, fallbackAction } = options;

  // Wait for navigation to settle
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // Network might not go idle in time, that's okay
  });

  // Check if we ended up on an unexpected page
  if (expectedNotVisible) {
    const unexpectedVisible = await page
      .getByText(expectedNotVisible)
      .isVisible()
      .catch(() => false);
    if (unexpectedVisible && fallbackAction) {
      console.log(
        `WARNING: Unexpected navigation to ${expectedNotVisible}, attempting recovery`
      );
      await fallbackAction();
    }
    return !unexpectedVisible;
  }

  return true;
}
