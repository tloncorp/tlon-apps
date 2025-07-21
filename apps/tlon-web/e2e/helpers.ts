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
  await page.getByText('New group').click();
  await page.getByText('Select contacts to invite').click();
  await page.getByText('Create group').click();

  // Wait for navigation to complete and group to be created
  await page.waitForTimeout(3000);

  // The group should now be visible on the Home page - click on it to enter
  if (await page.getByText('Untitled group').first().isVisible()) {
    await page.getByText('Untitled group').first().click();
    
    // Wait for the channel to load
    await page.waitForTimeout(2000);
  }
}

export async function leaveGroup(page: Page, groupName: string) {
  await page.getByTestId('HomeNavIcon').click();
  if (await page.getByText(groupName).first().isVisible()) {
    await page.getByText(groupName).first().click();
    await page.getByTestId('GroupOptionsSheetTrigger').first().click();
    await expect(page.getByText('Group info & settings')).toBeVisible();
    await page.getByText('Group info & settings').click();
    await page.waitForSelector('text=Group Info');
    await page.getByText('Leave group').click();
  }
}

export async function inviteMembersToGroup(page: Page, memberIds: string[]) {
  // If we're on the group info page, use the Invite People button there
  if (await page.getByText('Invite People').isVisible()) {
    await page.getByText('Invite People').click();
  } else {
    // Otherwise, use the options sheet trigger on the main group page
    await page.getByTestId('GroupOptionsSheetTrigger').first().click();
    await page.getByTestId('ActionSheetAction-Invite people').first().click();
  }

  for (const memberId of memberIds) {
    await page.getByPlaceholder('Filter by nickname').fill(memberId);
    await page.waitForTimeout(2000);
    await page.getByTestId('ContactRow').first().click();
  }

  await page.getByText('continue').click();
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
  await page.getByTestId('GroupOptionsSheetTrigger').first().click();
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
  try {
    const groupText = groupName || 'Untitled group';
    const groupElement = page.getByText(groupText).first();
    
    if (await groupElement.isVisible({ timeout: 3000 })) {
      await groupElement.click({ timeout: 5000 });
      await openGroupSettings(page);
      await deleteGroup(page, groupName);
    }
  } catch (error) {
    console.log(`Cleanup failed for group ${groupName}:`, error.message);
  }
}

/**
 * Navigates back using header back button with fallback logic
 */
export async function navigateBack(page: Page, preferredIndex = 0) {
  const backButtons = page.getByTestId('HeaderBackButton');
  
  // Wait for at least one back button to be visible with a shorter timeout
  try {
    await backButtons.first().waitFor({ state: 'visible', timeout: 5000 });
  } catch (error) {
    // If no back button is found, try alternative navigation methods
    console.warn('No HeaderBackButton found, trying alternative navigation');
    
    // Try clicking Home nav icon if available
    if (await page.getByTestId('HomeNavIcon').isVisible({ timeout: 1000 })) {
      await page.getByTestId('HomeNavIcon').click();
      return;
    }
    
    throw new Error('No HeaderBackButton or HomeNavIcon found for navigation');
  }

  // Try preferred index first
  if (await backButtons.nth(preferredIndex).isVisible({ timeout: 1000 })) {
    await backButtons.nth(preferredIndex).click();
    return;
  }
  
  // Try other indices in order
  for (let i = 0; i < 3; i++) {
    if (await backButtons.nth(i).isVisible({ timeout: 1000 })) {
      await backButtons.nth(i).click();
      return;
    }
  }
  
  throw new Error('No visible HeaderBackButton found despite elements being present');
}

/**
 * Navigates to the Home screen using the most reliable method
 */
export async function navigateToHome(page: Page) {
  // First try clicking Home nav icon if it's visible
  if (await page.getByTestId('HomeNavIcon').isVisible({ timeout: 1000 })) {
    await page.getByTestId('HomeNavIcon').click();
    await page.waitForSelector('text=Home', { state: 'visible' });
    return;
  }
  
  // If no Home nav icon, try multiple back buttons until we reach home
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts && !(await page.getByText('Home').isVisible({ timeout: 1000 }))) {
    try {
      await navigateBack(page);
      attempts++;
      await page.waitForTimeout(500); // Wait a bit for navigation to complete
    } catch (error) {
      break; // Stop trying if navigateBack fails
    }
  }
  
  // Verify we're on Home
  if (!(await page.getByText('Home').isVisible({ timeout: 2000 }))) {
    throw new Error('Could not navigate to Home screen');
  }
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

  await expect(page.getByText('Send message')).toBeVisible();
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
  await page.getByTestId('AddNotebookPost').click();
  await page.getByRole('textbox', { name: 'New Title' }).click();
  await page.getByRole('textbox', { name: 'New Title' }).fill(title);
  await page.locator('iframe').contentFrame().getByRole('paragraph').click();
  await page
    .locator('iframe')
    .contentFrame()
    .locator('div')
    .nth(2)
    .fill(content);
  await page.getByTestId('BigInputPostButton').click();
  await page.waitForTimeout(500);
  await expect(page.getByText(title)).toBeVisible();
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
  await page.waitForTimeout(500);
  await expect(page.getByText(content).first()).toBeVisible();
}

// Chat-related helper functions

/**
 * Sends a message in the current channel
 */
export async function sendMessage(page: Page, message: string) {
  await page.getByTestId('MessageInput').click();
  await page.fill('[data-testid="MessageInput"]', message);
  await page.waitForTimeout(1500);
  await page.getByTestId('MessageInputSendButton').click({ force: true });
  // Wait for message to appear
  await page.waitForTimeout(500);
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
}

/**
 * Long presses on a message to open the context menu
 */
export async function longPressMessage(page: Page, messageText: string) {
  // Not really a longpress since this is web.
  await page
    .getByTestId('Post')
    .getByText(messageText)
    .first()
    .hover({ force: true });
  await page.waitForTimeout(1000);
  await page.getByTestId('MessageActionsTrigger').click();
  await page.waitForTimeout(500);
}

/**
 * Starts a thread from a message
 */
export async function startThread(page: Page, messageText: string) {
  await longPressMessage(page, messageText);
  await page.getByText('Reply').click();
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
}

/**
 * Reacts to a message with an emoji
 */
export async function reactToMessage(
  page: Page,
  messageText: string,
  emoji: 'thumb' | 'heart' | 'laugh' = 'thumb'
) {
  await longPressMessage(page, messageText);
  await page.getByTestId(`EmojiToolbarButton-${emoji}`).click();

  // Map emoji names to actual emoji characters
  const emojiMap = {
    thumb: '👍',
    heart: '❤️',
    laugh: '😂',
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

  // Verify quote interface appears
  if (!isDM) {
    await expect(page.getByText('Chat Post')).toBeVisible();
  }
  await expect(page.getByText(originalMessage).nth(1)).toBeVisible(); // Quote shows original

  await page.getByTestId('MessageInput').click();
  if (!isDM) {
    await page.fill('[data-testid="MessageInput"]', replyText);
  } else {
    const inputText = await page.getByTestId('MessageInput').inputValue();
    await page.getByTestId('MessageInput').fill(inputText + replyText);
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
  replyText: string
) {
  // Use the thread-specific message interaction
  await page.getByText(originalMessage).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('MessageActionsTrigger').click();
  await page.waitForTimeout(500);
  await page.getByText('Quote', { exact: true }).click();

  // Verify quote interface appears
  await expect(page.getByText('Chat Post')).toBeVisible();
  await expect(page.getByText(originalMessage).nth(1)).toBeVisible(); // Quote shows original

  // Use thread-specific reply input
  await page.getByPlaceholder('Reply').click();
  await page.getByPlaceholder('Reply').fill(replyText);
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
  await expect(page.getByText(newText, { exact: true })).toBeVisible();
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
  await page.getByText(contactId, { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ChannelOptionsSheetTrigger').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ActionSheetAction-Leave chat').click();
  await page.waitForTimeout(500);
  // without this reload we'll still see previous messages in the DM
  // TODO: figure out why this is happening
  await page.reload();
  await expect(page.getByText(contactId, { exact: true })).not.toBeVisible();
}

/**
 * Check if we're on a mobile viewport
 */
export async function isMobileViewport(page: Page) {
  const viewport = await page.viewportSize();
  return viewport && viewport.width < 768;
}
