import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should prevent Admin role from being edited', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your group!').isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HeaderBackButton').first().isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Verify Admin role is visible
  await expect(page.getByTestId('GroupRole-Admin')).toBeVisible();

  // Try to click on Admin role - it should not open the edit sheet
  await page.getByTestId('GroupRole-Admin').click();

  // Verify the edit sheet did not open (Edit role text should not be visible)
  await expect(page.getByText('Edit role')).not.toBeVisible();

  // Verify that Admin role doesn't have a chevron icon (indicating it's not clickable)
  const adminRoleElement = page.getByTestId('GroupRole-Admin');
  const chevronIcon = adminRoleElement.locator('[data-icon="ChevronRight"]');
  await expect(chevronIcon).not.toBeVisible();

  // Create a regular role to verify that other roles still work
  await helpers.createRole(page, 'Regular role', 'This role can be edited');

  // Verify the regular role can be clicked and edited
  await page.getByText('Regular role').click();
  await expect(page.getByText('Edit role')).toBeVisible();

  // Close the edit sheet by clicking Save button
  await page.getByText('Save').click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Edit role')).not.toBeVisible();
});

test('should manage roles lifecycle: create, assign, modify permissions, rename, and delete', async ({
  zodPage,
}) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your group!').isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HeaderBackButton').first().isVisible()) {
    await helpers.navigateBack(page);
  } else {
    await helpers.navigateBack(page, 1);
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Create a new role and check that the count label updates
  await helpers.createRole(page, 'Testing role', 'Description for test role');

  await helpers.navigateBack(page);
  // Verify role count is now 2 (Admin + Testing role)
  await helpers.verifyElementCount(page, 'GroupRoles', 2);

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
  await expect(page.getByText('Manage channels')).toBeVisible();

  // Edit the first channel (General)
  await page.getByTestId('EditChannelButton').first().click();
  await expect(page.getByText('Channel settings')).toBeVisible();

  // Set channel permissions
  await helpers.setChannelPermissions(page, ['Testing role'], ['Testing role']);

  // Verify "Testing role" appears in the Roles section (as a chip)
  await expect(page.getByText('Testing role').first()).toBeVisible();

  // Verify "Testing role" has read permissions in the permission table
  await expect(page.getByTestId('ReadToggle-Testing role')).toBeVisible();

  // Verify "Testing role" has write permissions enabled
  // The write toggle was clicked by setChannelPermissions helper
  // We can verify the checkmark icon is visible inside the write toggle
  const writeToggle = page.getByTestId('WriteToggle-Testing role');
  await expect(writeToggle).toBeVisible();
  await expect(writeToggle.getByRole('img')).toBeVisible(); // Checkmark icon

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);

  // Navigate back to group settings
  await helpers.navigateBack(page);
  await expect(page.getByText('Group Info')).toBeVisible();

  // Attempt to delete role that still has members/channels assigned
  await page.getByTestId('GroupRoles').click();
  await page.getByText('Testing role').click();
  await expect(page.getByText('Edit role')).toBeVisible();

  // Verify the role cannot be deleted (should show warning message)
  const deleteButton = page.getByText('Delete role');
  if (await deleteButton.isVisible()) {
    // If delete button is visible, there should be a warning about not being able to delete
    await expect(page.getByText(/This role cannot be deleted.*/)).toBeVisible();
  } else {
    // Or the delete button might not be visible at all when role is in use
    await expect(deleteButton).not.toBeVisible();
  }

  await page.getByText('Save').click();

  // Rename the role
  await page.getByText('Testing role').click();
  await expect(page.getByText('Edit role')).toBeVisible();

  // Clear and rename the role
  await helpers.fillFormField(page, 'RoleTitleInput', 'Renamed role', true);

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Renamed role')).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();

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

  // Remove "Renamed role" from readers by clicking the X on the role chip
  await expect(page.getByText('Renamed role').first()).toBeVisible();
  await page.getByTestId('RemoveRole-Renamed role').click();
  await page.waitForTimeout(500);

  // Verify "Renamed role" is no longer visible in the Roles section
  await expect(page.getByText('Renamed role')).not.toBeVisible();

  // Verify it's also not in the permission table
  await expect(page.getByTestId('ReadToggle-Renamed role')).not.toBeVisible();
  await expect(page.getByTestId('WriteToggle-Renamed role')).not.toBeVisible();

  await page.getByTestId('ChannelSettingsSaveButton').click();
  await page.waitForTimeout(2000);

  // Navigate back with complex fallback logic
  await helpers.navigateBack(page);

  // Delete the role (should now be possible)
  await page.waitForTimeout(300);
  await helpers.openGroupSettings(page);
  await page.waitForTimeout(300);
  await expect(page.getByText('Roles')).toBeVisible();
  await page.getByTestId('GroupRoles').click();
  await expect(page.getByText('Renamed role')).toBeVisible();
  await page.getByText('Renamed role').click();
  await expect(page.getByText('Edit role')).toBeVisible();

  // Now the role should be deletable
  await expect(page.getByText('Delete role', { exact: true })).toBeVisible();
  await page.getByText('Delete role', { exact: true }).click();

  // Verify role is deleted
  await expect(page.getByText('Renamed role')).not.toBeVisible();

  await helpers.navigateBack(page);

  // Verify role count is back to 1
  await helpers.verifyElementCount(page, 'GroupRoles', 1);
});
