import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should prevent Admin role from being edited', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your workspace!').isVisible()) {
    await expect(page.getByText('Welcome to your workspace!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HomeNavIcon').isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
    await page.getByText('Untitled workspace').first().click();
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Verify Admin role is visible
  await expect(page.getByTestId('GroupRole-Admin')).toBeVisible();

  // Click on Admin role - it should now open the edit screen (but fields are read-only)
  await page.getByTestId('GroupRole-Admin').click();

  // Verify the edit screen opened
  await expect(page.getByText('Edit Admin')).toBeVisible();

  // Verify that title and description inputs are read-only for Admin role
  const titleInput = page.getByTestId('RoleTitleInput');
  const descriptionInput = page.getByTestId('RoleDescriptionInput');

  await expect(titleInput).not.toBeEditable();
  await expect(descriptionInput).not.toBeEditable();

  // Verify Delete button is not visible for Admin role
  await expect(page.getByText('Delete role')).not.toBeVisible();

  // Navigate back to roles list
  await helpers.navigateBack(page);

  // Create a regular role to verify that other roles still work
  await helpers.createRole(page, 'Regular role', 'This role can be edited');

  // Verify the regular role can be clicked and edited
  await page.getByText('Regular role').click();
  await expect(page.getByText('Edit Regular role')).toBeVisible();

  // Navigate back to roles list
  await helpers.navigateBack(page);
});

test('should manage roles lifecycle: create, assign, modify permissions, rename, and delete', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your workspace!').isVisible()) {
    await expect(page.getByText('Welcome to your workspace!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HomeNavIcon').isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
    await page.getByText('Untitled workspace').first().click();
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Create a new role and check that the count label updates
  await helpers.createRole(page, 'Testing role', 'Description for test role');

  await helpers.navigateBack(page);

  // Navigate back to Group Settings
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();

  // Assign role to a user (member)
  await page.waitForTimeout(2000);
  await page.getByTestId('GroupMembers').click();
  await expect(page.getByText('Members', { exact: true })).toBeVisible();

  // Find and click on the first member row (should be under Admin)
  await helpers.assignRoleToMember(page, 'Testing role');

  // Verify the member is now under "Testing role" section
  await expect(page.getByText('Testing role')).toBeVisible();
  await expect(page.getByTestId('MemberRow').nth(1)).toBeVisible();

  await helpers.navigateBack(page);

  // Change channel permissions to use the role
  await page.getByTestId('GroupChannels').click();

  // Verify we're on the Channels screen by checking for the Sort and New buttons
  await expect(page.getByText('Sort', { exact: true })).toBeVisible();
  await expect(page.getByText('New', { exact: true })).toBeVisible();

  // Edit the first channel (General) - find it by name using regex
  const generalChannel = page.getByTestId(/^ChannelItem-General-/);
  await expect(generalChannel).toBeVisible({ timeout: 5000 });
  await generalChannel.getByTestId('EditChannelButton').first().click();
  await expect(page.getByText('Channel info')).toBeVisible();

  // Navigate to Privacy settings to set channel permissions
  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible();

  // Set channel permissions
  await helpers.setChannelPermissions(page, ['Testing role'], ['Testing role']);

  // "Testing role" can see and post
  await expect(page.getByTestId('ReadToggle-Testing role')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.getByTestId('WriteToggle-Testing role')).toHaveAttribute(
    'aria-checked',
    'true'
  );

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);

  // After clicking Save on Channel privacy, navigate back to exit any settings screens
  // The exact navigation state varies, so we navigate back until we can open group settings
  // In React Navigation v7, all stacked screens are in the DOM, so use .last() to target
  // the topmost screen's back button
  for (let i = 0; i < 3; i++) {
    try {
      const backButton = page.getByTestId('HeaderBackButton').last();
      if (await backButton.isVisible({ timeout: 500 })) {
        await backButton.click();
        await page.waitForTimeout(300);
      }
    } catch {
      break;
    }
  }

  // Open group settings to get to Group Info
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();

  // Attempt to delete role that still has members/channels assigned
  await page.getByTestId('GroupRoles').click();
  await page.getByText('Testing role').click();
  await expect(page.getByText('Edit Testing role')).toBeVisible();

  // Verify the role cannot be deleted (should show warning message and disabled button)
  const deleteButton = page.getByTestId('DeleteRoleButton');
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/This role cannot be deleted.*/)).toBeVisible();

  await helpers.navigateBack(page);

  // Rename the role
  await page.getByText('Testing role').click();
  await expect(page.getByText('Edit Testing role')).toBeVisible();

  // Clear and rename the role
  await helpers.fillFormField(page, 'RoleTitleInput', 'Renamed role', true);

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Renamed role')).toBeVisible();

  await helpers.navigateBack(page);

  // Remove role from user
  await page.getByTestId('GroupMembers').click();

  // Find member under "Renamed role" and remove the role
  await helpers.unassignRoleFromMember(page, 'Renamed role', 1);

  // Verify member is back under Admin section
  await expect(page.getByTestId('MemberRow').nth(0)).toBeVisible();

  await helpers.navigateBack(page);

  // Remove role from channel permissions
  await page.getByTestId('GroupChannels').click();
  await page.getByTestId('EditChannelButton').first().click();
  await expect(page.getByText('Channel info')).toBeVisible();

  // Navigate to Privacy settings to modify channel permissions
  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible();

  // Take "Renamed role" off the roles that can see the channel
  const renamedRoleRead = page.getByTestId('ReadToggle-Renamed role');
  await expect(renamedRoleRead).toHaveAttribute('aria-checked', 'true');
  await renamedRoleRead.click();
  await expect(renamedRoleRead).toHaveAttribute('aria-checked', 'false');

  // A role that can't see the channel can't post in it either
  await expect(page.getByTestId('WriteToggle-Renamed role')).not.toBeVisible();

  await page.getByTestId('ChannelPrivacySaveButton').click();
  await page.waitForTimeout(2000);

  // After clicking Save on Channel privacy, navigate back to exit any settings screens
  // The exact navigation state varies, so we navigate back until we can open group settings
  // In React Navigation v7, all stacked screens are in the DOM, so use .last() to target
  // the topmost screen's back button
  for (let i = 0; i < 3; i++) {
    try {
      const backButton = page.getByTestId('HeaderBackButton').last();
      if (await backButton.isVisible({ timeout: 500 })) {
        await backButton.click();
        await page.waitForTimeout(300);
      }
    } catch {
      break;
    }
  }

  // Delete the role (should now be possible)
  await page.waitForTimeout(300);
  await helpers.openGroupSettings(page);
  await page.waitForTimeout(300);
  // Use testID selector instead of text to avoid matching multiple "Roles" elements
  await expect(page.getByTestId('GroupRoles')).toBeVisible();
  await page.getByTestId('GroupRoles').click();
  await expect(page.getByText('Renamed role')).toBeVisible();
  await page.getByText('Renamed role').click();
  await expect(page.getByText('Edit Renamed role')).toBeVisible();

  // Now the role should be deletable
  await expect(page.getByText('Delete role', { exact: true })).toBeVisible();
  await page.getByText('Delete role', { exact: true }).click();

  // Verify role is deleted
  await expect(page.getByText('Renamed role')).not.toBeVisible();

  await helpers.navigateBack(page);

  // Verify role count is back to 2 (Admin + virtual Members role)
  await helpers.verifyElementCount(page, 'GroupRoles', 2);
});

test('should persist role permissions after save and reopen', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your workspace!').isVisible()) {
    await expect(page.getByText('Welcome to your workspace!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HomeNavIcon').isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
    await page.getByText('Untitled workspace').first().click();
    await expect(page.getByText('Untitled workspace').first()).toBeVisible();
  }

  // Open group settings and create a role
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  await helpers.createRole(page, 'Writer role', 'Role with write access');

  await helpers.navigateBack(page);

  // Navigate to Channels and open the General channel's info screen
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();
  await page.getByTestId('GroupChannels').click();

  await expect(page.getByText('Sort', { exact: true })).toBeVisible();
  const generalChannel = page.getByTestId(/^ChannelItem-General-/);
  await expect(generalChannel).toBeVisible({ timeout: 5000 });
  await generalChannel.getByTestId('EditChannelButton').first().click();
  await expect(
    page
      .getByTestId('ChatDetailsHeader')
      .getByText('Channel info', { exact: true })
      .first()
  ).toBeVisible();

  // Navigate to channel permissions screen
  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible();

  // Set permissions: keep Members selected, add "Writer role" with read+write
  await helpers.setChannelPermissions(
    page,
    ['Writer role'],
    ['Writer role'],
    true // keepMembers — exercises the Members + specific role code path
  );

  // Members still see the channel
  await expect(page.getByTestId('ReadToggle-Members')).toHaveAttribute(
    'aria-checked',
    'true'
  );

  // Uncheck write for Members (so Members = read-only, Writer role = read+write)
  const membersWriteToggle = page.getByTestId('WriteToggle-Members');
  await expect(membersWriteToggle).toHaveAttribute('aria-checked', 'true');
  await membersWriteToggle.click();
  await expect(membersWriteToggle).toHaveAttribute('aria-checked', 'false');

  // Verify Writer role has write enabled
  await expect(page.getByTestId('WriteToggle-Writer role')).toHaveAttribute(
    'aria-checked',
    'true'
  );

  // Save
  await page.getByTestId('ChannelPrivacySaveButton').click();
  await page.waitForTimeout(2000);

  // Navigate to channel info to re-open permissions and verify persistence
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Workspace info')).toBeVisible();
  await page.getByTestId('GroupChannels').click();
  await expect(page.getByText('Sort', { exact: true })).toBeVisible();
  const generalChannelReopen = page.getByTestId(/^ChannelItem-General-/);
  await expect(generalChannelReopen).toBeVisible({ timeout: 5000 });
  await generalChannelReopen.getByTestId('EditChannelButton').first().click();
  await expect(
    page
      .getByTestId('ChatDetailsHeader')
      .getByText('Channel info', { exact: true })
      .first()
  ).toBeVisible();
  await page.getByTestId('ChannelPrivacy').click();
  await expect(page.getByText('Channel permissions')).toBeVisible();

  // Writer role still sees and posts; Members still see but don't post
  await expect(page.getByTestId('ReadToggle-Writer role')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.getByTestId('WriteToggle-Writer role')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.getByTestId('ReadToggle-Members')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.getByTestId('WriteToggle-Members')).toHaveAttribute(
    'aria-checked',
    'false'
  );

  // Unchecking write leaves the role able to see the channel
  await page.getByTestId('WriteToggle-Writer role').click();
  await expect(page.getByTestId('WriteToggle-Writer role')).toHaveAttribute(
    'aria-checked',
    'false'
  );
  await expect(page.getByTestId('ReadToggle-Writer role')).toHaveAttribute(
    'aria-checked',
    'true'
  );
});
