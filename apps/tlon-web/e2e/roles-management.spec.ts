import { expect, test } from '@playwright/test';

import {
  clickThroughWelcome,
  createGroup,
  deleteGroup,
  fillFormField,
  openGroupSettings,
} from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should manage roles lifecycle: create, assign, modify permissions, rename, and delete', async ({
  page,
}) => {
  await page.goto(zodUrl);
  await clickThroughWelcome(page);

  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing "Untitled group"
  if (await page.getByText('Untitled group').first().isVisible()) {
    await page.getByText('Untitled group').first().click();
    await openGroupSettings(page);
    await deleteGroup(page);
  }

  // Create a new group
  await createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Welcome to your group!').isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  if (await page.getByTestId('HeaderBackButton').first().isVisible()) {
    await page.getByTestId('HeaderBackButton').first().click();
  } else {
    await page.getByTestId('HeaderBackButton').nth(1).click();
  }

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings and navigate to Roles
  await openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();
  await page.getByTestId('GroupRoles').click();

  // Create a new role and check that the count label updates
  await page.getByText('Add Role').click();
  await expect(page.getByRole('dialog').getByText('Add role')).toBeVisible();

  await fillFormField(page, 'RoleTitleInput', 'Testing role');
  await fillFormField(
    page,
    'RoleDescriptionInput',
    'Description for test role'
  );

  await page.getByText('Save').click();
  await expect(page.getByText('Testing role')).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();
  // Verify role count is now 2 (Admin + Testing role)
  await expect(
    page.getByTestId('GroupRoles').locator('div').filter({ hasText: '2' })
  ).toBeVisible();

  // Assign role to a user (member)
  await page.waitForTimeout(2000);
  await page.getByTestId('GroupMembers').click();
  await expect(page.getByText('Members', { exact: true })).toBeVisible();

  // Find and click on the first member row (should be under Admin)
  const memberRow = page.getByTestId('MemberRow').first();
  await expect(memberRow).toBeVisible();
  await memberRow.click();

  await expect(page.getByText('Send message')).toBeVisible();
  await expect(page.getByText('Copy user ID')).toBeVisible();
  await page.getByText('Assign role').click();
  await page.getByText('Testing role').click();

  await page.waitForTimeout(2000); // Wait for assignment to complete

  // Verify the member is now under "Testing role" section
  await expect(page.getByText('Testing role')).toBeVisible();
  await expect(page.getByTestId('MemberRow').nth(1)).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();

  // Change channel permissions to use the role
  await page.getByTestId('GroupChannels').click();
  await expect(page.getByText('Manage channels')).toBeVisible();

  // Edit the first channel (General)
  await page.getByTestId('EditChannelButton').first().click();
  await expect(page.getByText('Edit channel')).toBeVisible();

  // Change to custom permissions
  await page.getByText('Custom', { exact: true }).click();

  // Set reader role to "Testing role"
  await page.getByTestId('ReaderRoleSelector').click();
  await page.getByText('Testing role').click();
  await page.getByText('Readers').click();

  // Verify "Testing role" appears under Readers
  await expect(
    page
      .getByTestId('ReaderRoleSelector')
      .locator('div')
      .filter({ hasText: 'AdminTesting role' })
      .first()
  ).toBeVisible();

  // Set writer role to "Testing role"
  await page.getByTestId('WriterRoleSelector').click();
  await page.getByText('Testing role').nth(1).click();
  await page.getByText('Writers').click();

  // Verify "Testing role" appears under Writers
  await expect(
    page
      .getByTestId('WriterRoleSelector')
      .locator('div')
      .filter({ hasText: 'AdminTesting role' })
      .first()
  ).toBeVisible();

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);

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
  await fillFormField(page, 'RoleTitleInput', 'Renamed role', true);

  await page.getByText('Save').click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Renamed role')).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();

  // Remove role from user
  await page.getByTestId('GroupMembers').click();

  // Find member under "Renamed role" and remove the role
  const renamedRoleMember = page.getByTestId('MemberRow').nth(1);
  await renamedRoleMember.click();

  await page.getByText('Assign role').click();
  await page.getByRole('dialog').getByText('Renamed role').click(); // This should unassign the role

  await page.waitForTimeout(2000);

  // Verify member is back under Admin section
  await expect(page.getByTestId('MemberRow').nth(0)).toBeVisible();

  await page.getByTestId('HeaderBackButton').first().click();

  // Remove role from channel permissions
  await page.getByTestId('GroupChannels').click();
  await page.getByTestId('EditChannelButton').first().click();

  // Remove "Renamed role" from readers
  await page.getByTestId('ReaderRoleSelector').click();
  await page.getByRole('dialog').getByText('Renamed role').click(); // This should unselect it

  // Verify "Renamed role" is no longer under Readers or Writers
  await expect(
    page
      .getByTestId('ReaderRoleSelector')
      .locator('div')
      .filter({ hasText: 'AdminRenamed role' })
      .first()
  ).not.toBeVisible();
  await expect(
    page
      .getByTestId('WriterRoleSelector')
      .locator('div')
      .filter({ hasText: 'AdminRenamed role' })
      .first()
  ).not.toBeVisible();

  await page.getByText('Save').click();

  if (await page.getByTestId('HeaderBackButton').first().isVisible()) {
    await page.getByTestId('HeaderBackButton').first().click();
  } else if (await page.getByTestId('HeaderBackButton').nth(2).isVisible()) {
    // TODO: figure out why we have some extra visible HeaderBackButtons (which the user can't actually see)
    await page.getByTestId('HeaderBackButton').nth(2).click();
    // Appears to have something to do with the fact that when we press this back button
    // we return to the channel view?
  } else {
    await page.getByTestId('HeaderBackButton').nth(1).click();
  }

  // Delete the role (should now be possible)
  await page.waitForTimeout(300);
  await openGroupSettings(page);
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

  if (await page.getByTestId('HeaderBackButton').first().isVisible()) {
    await page.getByTestId('HeaderBackButton').first().click();
  } else {
    await page.getByTestId('HeaderBackButton').nth(1).click();
  }

  // Verify role count is back to 1
  await expect(
    page.getByTestId('GroupRoles').locator('div').filter({ hasText: '1' })
  ).toBeVisible();

  // Delete the group
  await deleteGroup(page);

  // Verify we're back at Home and group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
});
