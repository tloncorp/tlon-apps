import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test comprehensive profile functionality including editing other users profiles', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Test 1: Edit own profile (~zod edits their own profile)
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  await zodPage.getByText('You').click();
  await expect(zodPage.getByText('Profile')).toBeVisible();
  await zodPage.getByText('Edit').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();
  await zodPage.getByTestId('ProfileNicknameInput').click();
  await zodPage
    .getByTestId('ProfileNicknameInput')
    .fill('Zod Testing nickname');
  await zodPage.getByRole('textbox', { name: 'Hanging out...' }).click();
  await zodPage
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Zod Testing status');
  await zodPage.getByRole('textbox', { name: 'About yourself' }).click();
  await zodPage
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Zod Testing bio');
  await zodPage.getByText('Add a group').click();
  // This is a fake ship, so we don't have any groups to add. We could add a group to this test, though
  await zodPage.getByTestId('CloseFavoriteGroupSelectorSheet').click();
  await zodPage.getByText('Done').click();
  // TODO: figure out why we need to reload here. This should be fixed.
  await zodPage.reload();
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Zod Testing nickname').first()).toBeVisible();
  await expect(zodPage.getByText('Zod Testing status').first()).toBeVisible();
  await expect(zodPage.getByText('Zod Testing bio')).toBeVisible();

  // Test 2: Edit another user's profile (~zod edits ~ten's profile)
  // Navigate to Contacts screen
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // Click the "+" button to add a new contact (wrapped in a View with testID)
  await zodPage.getByTestId('ContactsAddButton').click();
  await expect(zodPage.getByText('Add Contacts')).toBeVisible();

  // Search for ~ten
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);

  // Select ~ten from the search results (in Add Contacts screen)
  await zodPage.getByTestId('ContactRow').getByText('~ten').click();

  // Add ~ten as a contact
  await zodPage.getByText('Add 1 contact').click();

  // Wait for the contact to be added and navigate back to Contacts
  await zodPage.waitForTimeout(3000);

  // Navigate back to Contacts screen explicitly
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // Now click on ~ten in the contacts list
  await zodPage.getByText('~ten').click();

  await expect(zodPage.getByText('Profile')).toBeVisible();

  // Edit ~ten's profile (setting a custom nickname)
  await zodPage.getByText('Edit').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();

  // Set custom nickname for ~ten
  await zodPage.getByTestId('ProfileNicknameInput').click();
  await zodPage.getByTestId('ProfileNicknameInput').fill('Ten Custom Nickname');

  // Note: Status and bio fields might not be available when editing another user's profile
  // Only nickname is typically editable for other users

  await zodPage.getByText('Done').click();

  // After saving, we're redirected to Home. Navigate back to verify the nickname was saved
  await zodPage.waitForTimeout(2000);
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // The custom nickname should appear in the contacts list
  await expect(zodPage.getByText('Ten Custom Nickname')).toBeVisible();

  // Test 3: Verify profile data doesn't persist (the bug fix for TLON-4641)
  // After editing ~ten's profile, now edit own profile again to verify no data persistence
  await zodPage.getByTestId('AvatarNavIcon').click();
  await zodPage.waitForTimeout(500);
  // The avatar icon already navigates to own profile
  await expect(zodPage.getByText('Profile')).toBeVisible();
  await zodPage.getByText('Edit').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();

  // Verify that ~zod's own data appears, not ~ten's data
  const nicknameInput = zodPage.getByTestId('ProfileNicknameInput');
  await expect(nicknameInput).toHaveValue('Zod Testing nickname');
  // Ensure it doesn't have ~ten's custom nickname
  await expect(nicknameInput).not.toHaveValue('Ten Custom Nickname');

  const statusInput = zodPage.getByRole('textbox', { name: 'Hanging out...' });
  await expect(statusInput).toHaveValue('Zod Testing status');

  const bioInput = zodPage.getByRole('textbox', { name: 'About yourself' });
  await expect(bioInput).toHaveValue('Zod Testing bio');

  // Cancel without making changes to verify we maintained correct data
  await zodPage.getByText('Cancel').click();

  // Test 4: ~ten verifies they can see ~zod's custom profile from their side
  // First, ~ten needs to add ~zod as a contact
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();

  // Click the "+" button to add a new contact (wrapped in a View with testID)
  await tenPage.getByTestId('ContactsAddButton').click();
  await expect(tenPage.getByText('Add Contacts')).toBeVisible();

  // Search for ~zod
  await tenPage.getByPlaceholder('Filter by nickname, @p').fill('~zod');
  await tenPage.waitForTimeout(1000);

  // Select ~zod from the search results (in Add Contacts screen)
  await tenPage.getByTestId('ContactRow').getByText('~zod').click();

  // Click "Add 1 contact" button (note the button text is different)
  await tenPage.getByText('Add 1 contact').click();
  await tenPage.waitForTimeout(3000); // Wait for contact to be added

  // Navigate back to Contacts screen explicitly
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();

  // Now click on ~zod in the contacts list - should show with their nickname
  // The contact will appear with "Zod Testing nickname" once synced
  await tenPage.getByText('Zod Testing nickname').first().click();
  await expect(tenPage.getByText('Profile')).toBeVisible();
  await expect(tenPage.getByText('Zod Testing nickname').first()).toBeVisible();
  await expect(tenPage.getByText('Zod Testing status').first()).toBeVisible();
  await expect(tenPage.getByText('Zod Testing bio')).toBeVisible();

  // Test 5: ~ten edits ~zod's profile (sets a custom nickname for ~zod)
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();
  await tenPage.getByTestId('ProfileNicknameInput').click();
  await tenPage
    .getByTestId('ProfileNicknameInput')
    .fill('Zod from Ten perspective');
  await tenPage.getByText('Done').click();

  // Verify ~ten sees their custom nickname for ~zod
  await tenPage.waitForTimeout(2000);
  await expect(
    tenPage.getByText('Zod from Ten perspective').first()
  ).toBeVisible();

  // Test 6: Verify ~ten can edit their own profile without data persistence issues
  await tenPage.getByTestId('AvatarNavIcon').click();
  await tenPage.getByText('You').click();
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();

  // Set ~ten's own profile data
  await tenPage.getByTestId('ProfileNicknameInput').click();
  await tenPage.getByTestId('ProfileNicknameInput').fill('Ten Own Nickname');
  await tenPage.getByRole('textbox', { name: 'Hanging out...' }).click();
  await tenPage
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Ten Status');
  await tenPage.getByRole('textbox', { name: 'About yourself' }).click();
  await tenPage
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Ten Bio');
  await tenPage.getByText('Done').click();

  // Verify ~ten's profile was saved correctly
  await tenPage.reload();
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Ten Own Nickname').first()).toBeVisible();
  await expect(tenPage.getByText('Ten Status').first()).toBeVisible();
  await tenPage.getByText('You').click();
  await expect(tenPage.getByText('Ten Bio')).toBeVisible();

  // Clean up ~ten's profile and contacts
  await helpers.cleanupOwnProfile(tenPage);
  await helpers.cleanupContactNicknames(tenPage);

  // Clean up ~zod's profile and contacts
  await helpers.cleanupOwnProfile(zodPage);
  await helpers.cleanupContactNicknames(zodPage);

  // Add a longer wait to ensure profile changes propagate
  await zodPage.waitForTimeout(3000);
  await tenPage.waitForTimeout(3000);
});
