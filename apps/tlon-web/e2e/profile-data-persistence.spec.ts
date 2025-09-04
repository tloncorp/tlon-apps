import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should verify profile data does not persist between users (TLON-4641)', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Part 1: Setup - ~zod edits their own profile
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
  await zodPage.getByText('Done').click();
  
  // TODO: figure out why we need to reload here. This should be fixed.
  await zodPage.reload();

  // Part 2: ~zod adds ~ten as a contact and edits their profile
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  await zodPage.getByTestId('ContactsAddButton').click();
  await expect(zodPage.getByText('Add Contacts')).toBeVisible();
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);
  await zodPage.getByTestId('ContactRow').getByText('~ten').click();
  await zodPage.getByText('Add 1 contact').click();
  await zodPage.waitForTimeout(3000);

  // Navigate to ~ten's profile and edit it
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  await zodPage.getByText('~ten').click();
  await expect(zodPage.getByText('Profile')).toBeVisible();
  await zodPage.getByText('Edit').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();
  await zodPage.getByTestId('ProfileNicknameInput').click();
  await zodPage.getByTestId('ProfileNicknameInput').fill('Ten Custom Nickname');
  await zodPage.getByText('Done').click();

  // Part 3: Critical test - Verify profile data doesn't persist
  // After editing ~ten's profile, now edit own profile again to verify no data persistence
  await zodPage.waitForTimeout(2000);
  await zodPage.getByTestId('AvatarNavIcon').click();
  await zodPage.waitForTimeout(500);
  // Navigate to own profile
  await zodPage.getByText('You').click();
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

  // Part 4: ~ten also verifies no data persistence when editing profiles
  // First ~ten sets their own profile
  await tenPage.getByTestId('AvatarNavIcon').click();
  await tenPage.getByText('You').click();
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();
  
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

  // Now ~ten adds ~zod as a contact
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();
  await tenPage.getByTestId('ContactsAddButton').click();
  await expect(tenPage.getByText('Add Contacts')).toBeVisible();
  await tenPage.getByPlaceholder('Filter by nickname, @p').fill('~zod');
  await tenPage.waitForTimeout(1000);
  await tenPage.getByTestId('ContactRow').getByText('~zod').click();
  await tenPage.getByText('Add 1 contact').click();
  await tenPage.waitForTimeout(3000);

  // Navigate to ~zod's profile and edit it
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();
  await tenPage.getByText('Zod Testing nickname').first().click();
  await expect(tenPage.getByText('Profile')).toBeVisible();
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();
  await tenPage.getByTestId('ProfileNicknameInput').click();
  await tenPage
    .getByTestId('ProfileNicknameInput')
    .fill('Zod from Ten perspective');
  await tenPage.getByText('Done').click();

  // Part 5: Critical test for ~ten - Verify no data persistence
  // After editing ~zod's profile, edit own profile again
  await tenPage.waitForTimeout(2000);
  await tenPage.getByTestId('AvatarNavIcon').click();
  await tenPage.getByText('You').click();
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();

  // Verify that ~ten's own data appears, not ~zod's data
  const tenNicknameInput = tenPage.getByTestId('ProfileNicknameInput');
  await expect(tenNicknameInput).toHaveValue('Ten Own Nickname');
  // Ensure it doesn't have ~zod's custom nickname
  await expect(tenNicknameInput).not.toHaveValue('Zod from Ten perspective');

  const tenStatusInput = tenPage.getByRole('textbox', { name: 'Hanging out...' });
  await expect(tenStatusInput).toHaveValue('Ten Status');

  const tenBioInput = tenPage.getByRole('textbox', { name: 'About yourself' });
  await expect(tenBioInput).toHaveValue('Ten Bio');

  // Cancel without changes
  await tenPage.getByText('Cancel').click();

  // Clean up
  await helpers.cleanupOwnProfile(tenPage);
  await helpers.cleanupContactNicknames(tenPage);
  await helpers.cleanupOwnProfile(zodPage);
  await helpers.cleanupContactNicknames(zodPage);
  
  await zodPage.waitForTimeout(3000);
  await tenPage.waitForTimeout(3000);
});