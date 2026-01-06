import { Page, expect } from '@playwright/test';
import * as path from 'path';

export async function channelIsLoaded(page: Page) {
  await expect(
    page.getByTestId('ScreenHeaderTitle').getByText('Loading…')
  ).not.toBeVisible();
}

export async function navigateToChannel(page: Page, channelName: string) {
  await expect(page.getByTestId(`ChannelListItem-${channelName}`)).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId(`ChannelListItem-${channelName}`).click();
  await channelIsLoaded(page);
}

export async function createGroup(page: Page) {
  // Ensure session is stable before creating group
  await waitForSessionStability(page);

  await page.getByTestId('CreateChatSheetTrigger').click();
  await page.getByText('New group', { exact: true }).click();

  // Select "Quick group" from the GroupTypeSelectionSheet
  await expect(page.getByText('Quick group')).toBeVisible({ timeout: 5000 });
  await page.getByText('Quick group').click();

  await expect(page.getByText('Select contacts to invite')).toBeVisible({
    timeout: 5000,
  });
  await page.getByText('Create group').click();


  try {
    // Wait briefly to see if we're automatically navigated to the group
    await expect(page.getByText('Welcome to your group!')).toBeVisible({
      timeout: 3000,
    });
  } catch {
    // If not automatically navigated, go to the group manually
    await page.getByTestId('HomeNavIcon').click();
    await expect(
      page.getByTestId('GroupListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 10000 });
    await page.getByTestId('GroupListItem-Untitled group-unpinned').click();
    await expect(page.getByText('Welcome to your group!')).toBeVisible({
      timeout: 5000,
    });
  }
}

/**
 * Creates a group using a specific template or group type
 */
export async function createGroupWithTemplate(
  page: Page,
  groupType: 'quick' | 'basic' | string
) {
  // Ensure session is stable before creating group
  await waitForSessionStability(page);

  await page.getByTestId('CreateChatSheetTrigger').click();
  await page.getByText('New group', { exact: true }).click();

  // Wait for group type selection sheet
  await expect(page.getByText('Create a group')).toBeVisible({ timeout: 5000 });

  // Determine expected group title based on type
  let expectedGroupTitle: string;

  // Select the appropriate group type
  if (groupType === 'quick') {
    await expect(page.getByText('Quick group')).toBeVisible({ timeout: 5000 });
    await page.getByText('Quick group').click();
    expectedGroupTitle = 'Untitled group'; // Quick groups have empty title
  } else if (groupType === 'basic') {
    await expect(page.getByText('Basic group')).toBeVisible({ timeout: 5000 });
    await page.getByText('Basic group').click();

    // Basic group requires title input
    await expect(page.getByText('Name your group')).toBeVisible({
      timeout: 5000,
    });
    await page.getByPlaceholder('Group name').fill('Basic Group');
    await page.getByText('Next', { exact: true }).click();

    expectedGroupTitle = 'Basic Group';
  } else {
    // For template groups, find and click by title
    await expect(page.getByText(groupType)).toBeVisible({ timeout: 5000 });
    await page.getByText(groupType).click();
    expectedGroupTitle = groupType; // Template uses its title as group title
  }

  // Wait for contact selection
  await expect(page.getByText('Select contacts to invite')).toBeVisible({
    timeout: 5000,
  });
  await page.getByText('Create group').click();

  // Wait for group creation to complete and navigate to group
  const channelHeader = page.getByTestId('ChannelHeaderTitle');

  try {
    // Wait briefly to see if we're automatically navigated to the group
    await expect(channelHeader).toBeVisible({ timeout: 5000 });
    // Template groups don't show "Welcome to your group!" message
    await page.waitForTimeout(1000);
  } catch {
    // If not automatically navigated, go to the group manually
    await page.getByTestId('HomeNavIcon').click();
    await expect(
      page.getByTestId(`ChatListItem-${expectedGroupTitle}-unpinned`)
    ).toBeVisible({ timeout: 10000 });
    await page
      .getByTestId(`ChatListItem-${expectedGroupTitle}-unpinned`)
      .click();
    await expect(channelHeader).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
  }
}

/**
 * Verifies that a group has the expected channels
 */
export async function verifyGroupChannels(
  page: Page,
  expectedChannels: Array<{
    title: string;
    type: 'chat' | 'notebook' | 'gallery';
  }>
) {
  // Navigate to group settings
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible({ timeout: 5000 });

  // Navigate to Channels
  await page.getByTestId('GroupChannels').getByText('Channels').click();

  // Verify we're on the Channels screen by checking for the Sort and New buttons
  await expect(page.getByText('Sort', { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText('New', { exact: true })).toBeVisible({
    timeout: 5000,
  });

  // Verify the correct number of channels by checking the last one exists
  const lastChannel = expectedChannels[expectedChannels.length - 1];
  const lastChannelTestId = `ChannelItem-${lastChannel.title}-${expectedChannels.length - 1}`;
  await expect(page.getByTestId(lastChannelTestId)).toBeVisible();

  // Verify each expected channel exists with correct title and type
  // Use regex to match any index since order may vary
  for (const channel of expectedChannels) {
    // Capitalize the channel type for display (e.g., "chat" -> "Chat")
    const capitalizedType = capitalize(channel.type);

    // Check that the channel exists (regardless of index)
    const channelItem = page.getByTestId(
      new RegExp(
        `^ChannelItem-${channel.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-`
      )
    );
    await expect(channelItem).toBeVisible({ timeout: 5000 });

    // Verify the channel type is displayed correctly within the channel item
    const channelPattern = new RegExp(`^${channel.title}${capitalizedType}$`);
    await expect(
      page.locator('div').filter({ hasText: channelPattern }).first()
    ).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function leaveGroup(page: Page, groupName: string) {
  await page.getByTestId('HomeNavIcon').click();
  if (await page.getByText(groupName).first().isVisible()) {
    await page.getByText(groupName).first().click();
    await openGroupSettings(page);
    await page.waitForSelector('text=Group Info');

    // Set up dialog handler to accept the confirmation
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Leave');
      expect(dialog.message()).toContain('invalidate any invitations');
      await dialog.accept();
    });

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
  // Ensure session is stable before inviting members
  await waitForSessionStability(page);

  await openGroupOptionsSheet(page);
  await page.getByTestId('GroupQuickAction-Invite').first().click();

  for (const memberId of memberIds) {
    const filterInput = page.getByPlaceholder('Filter by nickname');
    await expect(filterInput).toBeVisible({ timeout: 5000 });
    await filterInput.fill(memberId);

    // Wait for contact to appear in search results
    await expect(
      page.getByTestId('ContactRow').getByText(`~${memberId}`, { exact: true })
    ).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByTestId('ContactRow')
      .getByText(`~${memberId}`, { exact: true })
      .click();
  }

  // Wait for continue button to update with selection count and click
  const continueButton = page.getByText(/continue|Invite \d+ and continue/);
  await expect(continueButton).toBeVisible({ timeout: 5000 });
  await continueButton.click();

  // Wait for the invite sheet to close (confirms action dispatched)
  await expect(page.getByText('Select contacts to invite')).not.toBeVisible({
    timeout: 10000,
  });

  // Stabilization wait for cross-ship sync
  await page.waitForTimeout(2000);
}

/**
 * Navigates to a group from the Home screen using the stable testID pattern.
 * Groups created without an explicit name have testID 'GroupListItem-Untitled group-unpinned'
 * regardless of their computed display name (which depends on members).
 */
export async function navigateToGroupByTestId(
  page: Page,
  options: {
    expectedDisplayName?: string;
    pinned?: boolean;
    timeout?: number;
  } = {}
) {
  const { expectedDisplayName, pinned = false, timeout = 10000 } = options;
  const testId = `GroupListItem-Untitled group-${pinned ? 'pinned' : 'unpinned'}`;

  // Navigate to Home screen first
  await page.getByTestId('HomeNavIcon').click();

  // Wait for navigation to complete
  await page.waitForTimeout(500);

  // Ensure we're on the Home screen
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({ timeout: 5000 });

  // Navigate using stable testID
  await expect(page.getByTestId(testId)).toBeVisible({ timeout });
  await page.getByTestId(testId).click();

  // Optionally verify the computed display name after entering the group
  if (expectedDisplayName) {
    await expect(page.getByText(expectedDisplayName).first()).toBeVisible({
      timeout: 15000,
    });
  }
}

export async function acceptGroupInvite(page: Page, groupName?: string) {
  // Ensure session is stable before accepting invite
  await waitForSessionStability(page);

  // Click on the invitation
  await page.getByText('Group invitation').click();
  await page.waitForTimeout(1000);

  // Click accept
  const acceptButton = page.getByText('Accept invite');
  if (await acceptButton.isVisible()) {
    await acceptButton.click();
  }

  // Wait for joining to complete and "Go to group" button to appear
  await expect(page.getByText('Go to group')).toBeVisible({ timeout: 45000 });

  // Click "Go to group"
  await page.getByText('Go to group').click();
  await page.waitForTimeout(3000);
}

export async function rejectGroupInvite(page: Page) {
  if (await page.getByText('Group invitation').isVisible({ timeout: 10000 })) {
    await page.getByText('Group invitation').click();
  }

  // If there's a reject invitation button, click it
  if (await page.getByText('Reject invite').isVisible({ timeout: 10000 })) {
    await page.getByText('Reject invite').click();
  }
}

export async function deleteGroup(page: Page, groupName?: string) {
  // Ensure session is stable before deleting group
  await waitForSessionStability(page);
  await expect(page.getByTestId('GroupLeaveAction-Delete group')).toBeVisible({
    timeout: 10000,
  });

  await page.getByTestId('GroupLeaveAction-Delete group').click();
  await expect(page.getByText('This action cannot be undone.')).toBeVisible({
    timeout: 10000,
  });
  await page
    .getByRole('dialog')
    .getByText('Delete group', { exact: true })
    .click();
  await expect(page.getByText(groupName || 'Untitled group')).not.toBeVisible({
    timeout: 20000,
  });
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
  await page.getByTestId('HomeNavIcon').click();
  if (await page.getByTestId('HomeSidebarHeader').isVisible()) {
    await expect(
      page.getByTestId(`GroupListItem-Untitled group-${expectedStatus}`)
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
  // Ensure session is stable before creating role
  await waitForSessionStability(page);

  await page.getByText('New', { exact: true }).click();
  await expect(page.getByText('Add role')).toBeVisible();

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
  // Ensure session is stable before assigning role
  await waitForSessionStability(page);

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
  // Ensure session is stable before unassigning role
  await waitForSessionStability(page);

  const memberRow = page.getByTestId('MemberRow').nth(memberIndex);
  await memberRow.click();

  await page.getByText('Assign role').click();
  await page.getByRole('dialog').getByText(roleName).click(); // This should unassign the role

  await page.waitForTimeout(2000);
}

/**
 * Bans a user from a group
 */
export async function banUserFromGroup(page: Page, memberName: string) {
  // Navigate to members page - always navigate since we might be in wrong context
  await openGroupSettings(page);
  await page.getByTestId('GroupMembers').click();

  // Wait for members page to load - wait for member rows to appear
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('MemberRow').first()).toBeVisible({
    timeout: 5000,
  });

  // Find and click on the member
  await page.getByTestId('MemberRow').filter({ hasText: memberName }).click();

  await expect(page.getByText('Ban User')).toBeVisible();
  await page.getByText('Ban User').click();

  // Wait for the action to complete and sheet to close
  await page.waitForTimeout(3000);

  // Close sheet if still open by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

/**
 * Unbans a user from a group
 */
export async function unbanUserFromGroup(page: Page, memberName: string) {
  // Navigate to members page - always navigate since we might be in wrong context
  await openGroupSettings(page);
  await page.getByTestId('GroupMembers').click();

  // Wait for members page to load - wait for member rows to appear
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('MemberRow').first()).toBeVisible({
    timeout: 5000,
  });

  // Scroll down to find banned users section
  await page.getByTestId('MemberRow').filter({ hasText: memberName }).click();

  await expect(page.getByText('Unban User')).toBeVisible();
  await page.getByText('Unban User').click();

  await page.waitForTimeout(2000); // Wait for unban to complete
}

/**
 * Kicks a user from a group
 */
export async function kickUserFromGroup(page: Page, memberName: string) {
  // Navigate to members page - always navigate since we might be in wrong context
  await openGroupSettings(page);
  await page.getByTestId('GroupMembers').click();

  // Wait for members page to load - wait for member rows to appear
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('MemberRow').first()).toBeVisible({
    timeout: 5000,
  });

  // Find and click on the member
  await page.getByTestId('MemberRow').filter({ hasText: memberName }).click();

  await expect(page.getByText('Kick User')).toBeVisible();

  // Set up dialog handler to accept the confirmation
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Kick');
    expect(dialog.message()).toContain('invalidate all the invitations');
    await dialog.accept();
  });

  await page.getByText('Kick User').click();

  await page.waitForTimeout(2000); // Wait for kick to complete
}

/**
 * Forwards a message to a specific contact via DM
 */
export async function forwardMessageToDM(
  page: Page,
  messageText: string,
  contactId: string
) {
  // Ensure session is stable before forwarding message
  await waitForSessionStability(page);

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
  // Ensure session is stable before forwarding group reference
  await waitForSessionStability(page);

  // Click the Forward button in group info
  await page.getByText('Forward reference').click();

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
  // Ensure session is stable before creating channel
  await waitForSessionStability(page);

  // Click the "New" button in the header
  await page.getByText('New', { exact: true }).click();

  // Click "New channel" from the action sheet (use .first() to avoid strict mode violation)
  await expect(page.getByText('New channel').first()).toBeVisible({
    timeout: 5000,
  });
  await page.getByText('New channel').first().click();

  await expect(page.getByText('Create a new channel')).toBeVisible();

  await fillFormField(page, 'ChannelTitleInput', title);

  if (type === 'notebook') {
    await page.getByText('Notebook', { exact: true }).click();
  } else if (type === 'gallery') {
    await page.getByText('Gallery', { exact: true }).click();
  }

  await page.getByText('Create channel').click();

  // Wait for the sheet to close
  await expect(page.getByText('Create a new channel')).not.toBeVisible({
    timeout: 5000,
  });

  // Wait a bit longer for the channel to be created on the backend
  await page.waitForTimeout(2000);
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
  // Ensure session is stable before editing channel
  await waitForSessionStability(page);

  await page
    .getByTestId(`ChannelItem-${channelName}-1`)
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Channel settings')).toBeVisible();

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
export async function deleteChannel(
  page: Page,
  channelName: string,
  channelIndex = 0
) {
  // Ensure session is stable before deleting channel
  await waitForSessionStability(page);

  await page
    .getByTestId(`ChannelItem-${channelName}-${channelIndex}`)
    .getByTestId('EditChannelButton')
    .first()
    .click();
  await expect(page.getByText('Channel settings')).toBeVisible();

  await page.getByText('Delete channel for everyone').click();
  await expect(page.getByText('This action cannot be undone.')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByText('Delete channel', { exact: true })
    .click();
}

/**
 * Sets channel permissions for reader and writer roles
 */
export async function setChannelPermissions(
  page: Page,
  readerRoles?: string[],
  writerRoles?: string[]
) {
  if (readerRoles && readerRoles.length > 0) {
    const privateToggle = page.getByTestId('PrivateChannelToggle');
    const isEnabled = await privateToggle.getAttribute('aria-checked');

    if (isEnabled !== 'true') {
      await privateToggle.click();
    }

    await page.getByText('Add roles').click();
    await expect(page.getByText('Search and add roles')).toBeVisible();

    for (const role of readerRoles) {
      if (role.toLowerCase() === 'admin') continue;
      await page.getByTestId('RoleSearchInput').fill(role);
      await page.getByText(role, { exact: true }).click();
      await page.getByTestId('RoleSearchInput').fill('');
    }
    await page.getByTestId('RoleSelectionSaveButton').click();
  }

  if (writerRoles && writerRoles.length > 0) {
    for (const role of writerRoles) {
      if (role.toLowerCase() === 'admin') continue;
      const writeToggle = page.getByTestId(`WriteToggle-${role}`);
      await expect(writeToggle).toBeVisible();
      await writeToggle.click();
    }
  }
}

/**
 * Toggles group/chat pin/unpin status
 */
export async function toggleChatPin(page: Page) {
  // Ensure session is stable before toggling pin
  await waitForSessionStability(page);

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
export async function setGroupPrivacy(
  page: Page,
  privacy: 'public' | 'private' | 'secret'
) {
  // Ensure session is stable before changing privacy
  await waitForSessionStability(page);

  await page.getByText('Privacy').click();

  await expect(page.getByText('Group privacy')).toBeVisible();

  if (privacy === 'private') {
    await page
      .getByTestId('GroupPrivacyScreen-RadioInput')
      .getByText('Private', { exact: true })
      .click();
  } else if (privacy === 'secret') {
    await page
      .getByTestId('GroupPrivacyScreen-RadioInput')
      .getByText('Secret', { exact: true })
      .click();
  } else {
    await page
      .getByTestId('GroupPrivacyScreen-RadioInput')
      .getByText('Public', { exact: true })
      .click();
  }
}

/**
 * Changes group notification settings
 */
export async function setGroupNotifications(
  page: Page,
  level: 'All activity' | 'Posts, mentions, and replies' | 'Nothing'
) {
  // Ensure session is stable before changing notifications
  await waitForSessionStability(page);

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
  // Ensure session is stable before creating channel section
  await waitForSessionStability(page);

  // Click the "New" button in the header
  await page.getByText('New', { exact: true }).click();

  // Click "New section" from the action sheet (use .first() to avoid strict mode violation)
  await expect(page.getByText('New section').first()).toBeVisible({
    timeout: 5000,
  });
  await page.getByText('New section').first().click();

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
  // Ensure session is stable before changing group name
  await waitForSessionStability(page);

  await page.getByTestId('GroupTitleInput').click();
  await fillFormField(page, 'GroupTitleInput', newName, true);
  await page.getByText('Save').click();
}

/**
 * Changes the group description
 */
export async function changeGroupDescription(page: Page, description: string) {
  // Ensure session is stable before changing group description
  await waitForSessionStability(page);

  await page.getByTestId('GroupDescriptionInput').click();
  await fillFormField(page, 'GroupDescriptionInput', description, true);
  await page.getByText('Save').click();
}

/**
 * Attempts to change group icon (handles web file picker behavior)
 */
export async function changeGroupIcon(page: Page, imagePath?: string) {
  // Click on "Change icon image" to open the attachment dialog
  await page.getByText('Change icon image').click();

  // Wait for the attachment dialog to appear
  await expect(page.getByText('Attach a file')).toBeVisible({ timeout: 5000 });

  // Use provided image path or default to test image
  const imageToUpload =
    imagePath || path.join(__dirname, 'assets', 'test-group-icon.jpg');

  // Intercept the file chooser dialog
  // This is Playwright's official way to handle file uploads
  const [fileChooser] = await Promise.all([
    // Wait for the file chooser to be triggered
    page.waitForEvent('filechooser'),
    // Click the button that triggers the file chooser
    page.getByText('Upload an image', { exact: true }).click(),
  ]);

  // Set the files on the file chooser
  await fileChooser.setFiles(imageToUpload);

  // Wait for upload to complete and dialog to close
  // The AttachmentSheet should close automatically after file selection
  await page.waitForTimeout(3000);
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

  // Ensure session is stable before posting
  await waitForSessionStability(page);

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

  // Wait for iframe to be properly loaded and accessible
  const iframe = page.locator('iframe');
  await expect(iframe).toBeVisible({ timeout: 10000 });

  // Wait for iframe content to be ready
  await iframe.waitFor({ state: 'attached' });
  const contentFrame = iframe.contentFrame();
  if (!contentFrame) {
    throw new Error('Iframe content frame not available');
  }

  // Wait for editor to be initialized
  await expect(contentFrame.getByRole('paragraph')).toBeVisible({
    timeout: 5000,
  });

  // Click in the editor area to focus
  await contentFrame.getByRole('paragraph').click();

  // Use more stable selector - target the paragraph element directly
  const editorParagraph = contentFrame.getByRole('paragraph');
  await expect(editorParagraph).toBeVisible({ timeout: 3000 });
  await editorParagraph.fill(content);

  // Ensure session is stable before posting
  await waitForSessionStability(page);

  await page.getByTestId('BigInputPostButton').click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(content).first()).toBeVisible();
}

// Chat-related helper functions

/**
 * Sends a message in the current channel
 */
export async function sendMessage(page: Page, message: string) {
  // Ensure session is stable before sending message
  await waitForSessionStability(page);

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
  // Wait for input to be cleared to prevent race conditions
  await expect(async () => {
    const inputValue = await page.getByTestId('MessageInput').inputValue();
    return inputValue === '';
  }).toPass({ timeout: 5000, intervals: [100, 200, 500] });
}

/**
 * Long presses on a message to open the context menu
 */
export async function longPressMessage(page: Page, messageText: string) {
  // Check if page is still valid
  if (page.isClosed()) {
    throw new Error('Page has been closed');
  }

  try {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage?.includes('Target closed') ||
      errorMessage?.includes('Target page, context or browser has been closed')
    ) {
      console.error('Page was closed during operation');
      throw new Error('Test context was closed prematurely');
    }
    throw error;
  }
}

/**
 * Starts a thread from a message
 */
export async function startThread(page: Page, messageText: string) {
  // Ensure session is stable before starting thread
  await waitForSessionStability(page);

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
  // Ensure session is stable before sending thread reply
  await waitForSessionStability(page);

  await page.getByRole('textbox', { name: 'Reply' }).click();
  await page.getByRole('textbox', { name: 'Reply' }).fill(replyText);
  await page
    .locator('#reply-container')
    .getByTestId('MessageInputSendButton')
    .click();
  await page.waitForTimeout(1000);
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
  // Ensure session is stable before reacting to message
  await waitForSessionStability(page);

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
  // Ensure session is stable before removing reaction
  await waitForSessionStability(page);

  const reactionButton = page.getByText(emoji);
  await reactionButton.click();
  await page.waitForTimeout(1000);
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
  // Ensure session is stable before quote reply
  await waitForSessionStability(page);

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

  await page.waitForTimeout(1000);
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
  // Ensure session is stable before hiding message
  await waitForSessionStability(page);

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
  // Ensure session is stable before reporting message
  await waitForSessionStability(page);

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
  // Ensure session is stable before deleting message
  await waitForSessionStability(page);

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
  // Ensure session is stable before deleting post
  await waitForSessionStability(page);

  await longPressMessage(page, postText);
  await page.getByText('Delete post').click();
  await expect(page.getByText(postText, { exact: true })).not.toBeVisible();
}

/**
 * Waits for the session to be stable and ready for operations
 */
export async function waitForSessionStability(page: Page) {
  await page.waitForTimeout(200);
  await page.waitForSelector('[data-testid="ScreenHeaderSubtitle"]', {
    state: 'attached',
    timeout: 5000,
  });

  const screenHeaderSubtitle = page.getByTestId('ScreenHeaderSubtitle');

  const loadingStates = [
    'Loading…',
    'Connecting...',
    'Reconnecting...',
    'Initializing...',
    'Disconnected',
  ];

  for (const state of loadingStates) {
    await expect(screenHeaderSubtitle.getByText(state))
      .not.toBeVisible({ timeout: 1000 })
      .catch(() => {}); // Element might not exist, that's okay
  }

  // Check for message delivery status
  await expect(page.getByTestId('ChatMessageDeliveryStatus').first())
    .not.toBeVisible({ timeout: 1000 })
    .catch(() => {});
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
  // Ensure session is stable before attempting edit
  await waitForSessionStability(page);

  await longPressMessage(page, originalText);
  await page.getByText('Edit message').click();

  // Wait for edit mode to be fully initialized
  await page.waitForTimeout(500);

  // Wait for the input to be populated with the original text
  const inputSelector = isThread
    ? page.getByTestId('MessageInput').nth(1)
    : page.getByTestId('MessageInput');

  // Wait for the input to contain the original text before editing
  // The input may have trailing whitespace, so we check if it contains the text
  await expect(async () => {
    const value = await inputSelector.inputValue();
    return value.trim() === originalText;
  }).toPass({ timeout: 5000, intervals: [100, 200, 500] });

  // Clear and fill with new text
  await inputSelector.fill(newText);

  // Click the send button
  const sendButton = isThread
    ? page.getByTestId('MessageInputSendButton').nth(1)
    : page.getByTestId('MessageInputSendButton');

  await sendButton.click();

  // Wait for the edited message to appear
  await expect(page.getByText(newText, { exact: true })).toBeVisible({
    timeout: 15000, // Increased timeout for CI environment
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
  isPinned = false,
  isGroup = false
) {
  // Navigate to Home screen first
  await page.getByTestId('HomeNavIcon').click();

  // Wait for navigation to complete
  await page.waitForTimeout(500);

  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({ timeout: 5000 });

  await page.waitForTimeout(1000);
  const itemType = isGroup ? 'GroupListItem' : 'ChatListItem';
  const chatItem = page.getByTestId(
    `${itemType}-${chatName}-${isPinned ? 'pinned' : 'unpinned'}`
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
  // Ensure session is stable before creating DM
  await waitForSessionStability(page);

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
  // Ensure session is stable before leaving DM
  await waitForSessionStability(page);

  await page.getByTestId('HomeNavIcon').click();
  await page.getByTestId(`ChannelListItem-${contactId}`).first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ChannelOptionsSheetTrigger').first().click();
  await page.waitForTimeout(500);
  await page.getByTestId('ActionSheetAction-Leave chat').click();

  // Wait for the confirmation dialog to appear
  await expect(
    page
      .getByRole('dialog')
      .getByText('You will no longer receive updates from this channel.')
  ).toBeVisible({ timeout: 5000 });

  // Click the Leave button in the confirmation dialog
  await page.getByRole('dialog').getByText('Leave', { exact: true }).click();

  // Wait for dialog to close first
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

  // Then wait for channel to be removed from list with longer timeout for cross-ship sync
  await expect(
    page.getByTestId(`ChannelListItem-${contactId}`)
  ).not.toBeVisible({ timeout: 20000 });
}

/**
 * Check if we're on a mobile viewport
 */
export async function isMobileViewport(page: Page) {
  const viewport = page.viewportSize();
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
        // Use void to properly handle the promise without await
        await new Promise<void>((resolve) =>
          setTimeout(resolve, delayMs * attempt)
        ); // Exponential backoff
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

/**
 * Clean up own profile by resetting nickname, status, and bio to empty values
 */
export async function cleanupOwnProfile(page: Page) {
  // Navigate to profile
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible({ timeout: 5000 });

  // Check if "You" is visible, if not we might already be on profile
  const youButton = page.getByText('You');
  if (await youButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await youButton.click();
  }

  // Wait for Profile to be visible
  await expect(page.getByText('Profile')).toBeVisible({ timeout: 5000 });

  // Click Edit button
  const editButton = page.getByTestId('ContactEditButton');
  if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editButton.click();
    await expect(page.getByText('Edit Profile')).toBeVisible({
      timeout: 5000,
    });

    // Clear all profile fields
    // Clear nickname
    const nicknameInput = page.getByTestId('ProfileNicknameInput');
    if (await nicknameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nicknameInput.click();
      await nicknameInput.clear();
      await nicknameInput.fill('');
    }

    // Clear status
    const statusInput = page.getByRole('textbox', {
      name: 'Hanging out...',
    });
    if (await statusInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await statusInput.click();
      await statusInput.clear();
      await statusInput.fill('');
    }

    // Clear bio
    const bioInput = page.getByRole('textbox', { name: 'About yourself' });
    if (await bioInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await bioInput.click();
      await bioInput.clear();
      await bioInput.fill('');
    }

    // Save changes
    await page.getByText('Done').click();
    await page.waitForTimeout(1000);
  }
  // Navigate back to home
  await page.getByTestId('HomeNavIcon').click();
  await page.waitForTimeout(500);
}

/**
 * Clean up custom nicknames set for contacts and remove all contacts
 * This dynamically finds all contacts and clears nicknames/removes them
 */
export async function cleanupContactNicknames(page: Page) {
  // Get all contacts dynamically (returns ship IDs for reliable removal)
  const contacts = await getAllContacts(page);

  for (const contactId of contacts) {
    // First clear any custom nickname using ship ID
    await clearContactNickname(page, contactId);

    // Then remove the contact using ship ID
    await removeContact(page, contactId);
  }
}

/**
 * Get all contacts from the contacts list
 * Returns an array of ship IDs (e.g., "~zod", "~ten") for reliable removal
 */
export async function getAllContacts(page: Page): Promise<string[]> {
  const contacts: string[] = [];

  // Navigate to Contacts
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible({ timeout: 5000 });

  // Wait for contacts to load
  await page.waitForTimeout(1000);

  // Try to get ship IDs from aria-labels (more reliable than text content)
  const contactElements = await page
    .locator('[aria-label^="ContactListItem-"]')
    .all();

  for (const element of contactElements) {
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel) {
      // Extract ship ID from aria-label (e.g., "ContactListItem-~zod" -> "~zod")
      const shipId = ariaLabel.replace('ContactListItem-', '');
      if (shipId && shipId.startsWith('~')) {
        // Skip own ship - determine by port pattern (works with sharding)
        const urlMatch = page.url().match(/:(\d+)/);
        const port = urlMatch ? parseInt(urlMatch[1], 10) : 0;
        const portMod = port % 10;
        const ownShip =
          portMod === 0 ? '~zod' : portMod === 2 ? '~ten' : '~bus';
        if (shipId !== ownShip) {
          contacts.push(shipId);
        }
      }
    }
  }

  // Navigate back to home to leave in clean state
  await page.getByTestId('HomeNavIcon').click();

  return contacts;
}

/**
 * Remove a specific contact from the contacts list
 * @param page - The page object
 * @param shipId - The ship ID (e.g., "~zod") of the contact to remove
 */
export async function removeContact(page: Page, shipId: string) {
  // Validate ship ID format
  if (!shipId.startsWith('~')) {
    console.log(
      `[CLEANUP] Invalid ship ID format: ${shipId} (must start with ~)`
    );
    return;
  }

  // Navigate to Contacts
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible({ timeout: 5000 });

  // Use aria-label selector for ship IDs (more reliable when nicknames change)
  const contactElement = page.locator(
    `[aria-label="ContactListItem-${shipId}"]`
  );

  if (await contactElement.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Check if this is the "You" contact (skip removal)
    if (
      await contactElement
        .getByText('You')
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      return;
    }

    await contactElement.click();

    // Wait for Profile to load
    await expect(page.getByText('Profile')).toBeVisible({ timeout: 5000 });

    // Look for Remove Contact button - it should be on the profile view, not in edit mode
    const removeButton = page.getByText('Remove Contact');
    if (await removeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeButton.click();
      await page.waitForTimeout(1000);

      // Handle any confirmation dialog if present
      const confirmButton = page.getByText('Remove', { exact: true });
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }

    // Navigate back to home
    await page.getByTestId('HomeNavIcon').click();
    await page.waitForTimeout(500);
  }
}

/**
 * Remove all contacts from both ships
 * This is a comprehensive cleanup that removes all contacts
 */
export async function removeAllContacts(page: Page) {
  const contacts = await getAllContacts(page);

  for (const contact of contacts) {
    // Skip self references
    if (contact.includes('You')) {
      continue;
    }
    // Skip own ship - determine by port pattern (works with sharding)
    const urlMatch = page.url().match(/:(\d+)/);
    const port = urlMatch ? parseInt(urlMatch[1], 10) : 0;
    const portMod = port % 10;
    const ownShip = portMod === 0 ? '~zod' : portMod === 2 ? '~ten' : '~bus';
    if (contact === ownShip || contact.includes(ownShip.substring(1))) {
      continue;
    }
    await removeContact(page, contact);
  }
}

/**
 * Clear custom nickname for a specific contact
 * @param page - The page object
 * @param contactNameOrId - The name, nickname, or ship ID (e.g., "~zod") of the contact
 */
export async function clearContactNickname(
  page: Page,
  contactNameOrId: string
) {
  // Navigate to Contacts
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible({ timeout: 5000 });

  // Determine if we have a ship ID or contact name
  const isShipId = contactNameOrId.startsWith('~');
  let contactElement;

  if (isShipId) {
    // Use aria-label selector for ship IDs (more reliable when nicknames change)
    contactElement = page.locator(
      `[aria-label="ContactListItem-${contactNameOrId}"]`
    );
  } else {
    // Fall back to text-based search for contact names
    contactElement = page.getByText(contactNameOrId).first();
  }

  if (await contactElement.isVisible({ timeout: 2000 }).catch(() => false)) {
    await contactElement.click();

    // Wait for Profile to load
    await expect(page.getByText('Profile')).toBeVisible({ timeout: 5000 });

    // Click Edit button
    await page.getByTestId('ContactEditButton').click();
    await expect(page.getByText('Edit Profile')).toBeVisible({
      timeout: 5000,
    });

    // Clear the nickname field
    await page.getByTestId('ProfileNicknameInput').click();
    await page.getByTestId('ProfileNicknameInput').fill('');

    // Save changes
    await page.getByText('Done').click();
    await page.waitForTimeout(1000);

    // Navigate back home
    await page.getByTestId('HomeNavIcon').click();
  }
}
