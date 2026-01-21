import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should manage contacts and edit contact nicknames', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Part 1: ~zod adds ~ten as a contact and edits their profile
  // Navigate to Contacts screen
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // Click the "+" button to add a new contact
  await zodPage.getByTestId('ContactsAddButton').click();
  await expect(zodPage.getByText('Add Contacts')).toBeVisible();

  // Search for ~ten
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);

  // Select ~ten from the search results
  await zodPage.getByTestId('ContactRow').getByText('~ten').click();

  // Add ~ten as a contact
  await zodPage.getByText('Add 1 contact').click();

  // Wait for the contact to be added
  await zodPage.waitForTimeout(3000);

  // Navigate back to Contacts screen
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // Click on ~ten in the contacts list
  await zodPage.getByText('~ten').click();
  await expect(zodPage.getByText('Profile')).toBeVisible();

  // Edit ~ten's profile (setting a custom nickname)
  await zodPage.getByTestId('ContactEditButton').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();

  // Set custom nickname for ~ten
  await zodPage.getByTestId('ProfileNicknameInput').click();
  await zodPage.getByTestId('ProfileNicknameInput').fill('Ten Custom Nickname');

  // Note: Status and bio fields are not available when editing another user's profile
  // Only nickname is editable for other users

  await zodPage.getByText('Done').click();

  // Verify the nickname was saved
  await zodPage.waitForTimeout(2000);
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();

  // The custom nickname should appear in the contacts list
  await expect(zodPage.getByText('Ten Custom Nickname')).toBeVisible();

  // Part 2: ~ten adds ~zod as a contact and edits their profile
  // Set up ~zod's profile first so ~ten has something to see
  await zodPage.getByTestId('AvatarNavIcon').click();
  await zodPage.getByText('You').click();
  await expect(zodPage.getByText('Profile')).toBeVisible();
  await zodPage.getByTestId('ContactEditButton').click();
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

  // Now ~ten adds ~zod as a contact
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();

  // Click the "+" button to add a new contact
  await tenPage.getByTestId('ContactsAddButton').click();
  await expect(tenPage.getByText('Add Contacts')).toBeVisible();

  // Search for ~zod
  await tenPage.getByPlaceholder('Filter by nickname, @p').fill('~zod');
  await tenPage.waitForTimeout(1000);

  // Select ~zod from the search results
  await tenPage.getByTestId('ContactRow').getByText('~zod').click();

  // Add ~zod as a contact
  await tenPage.getByText('Add 1 contact').click();
  await tenPage.waitForTimeout(3000);

  // Navigate back to Contacts screen
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();

  // Click on ~zod in the contacts list - should show with their nickname
  await tenPage.getByText('Zod Testing nickname').first().click();
  await expect(tenPage.getByText('Profile')).toBeVisible();

  // ~ten edits ~zod's profile (sets a custom nickname for ~zod)
  await tenPage.getByTestId('ContactEditButton').click();
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

  // Clean up profiles and contacts
  await helpers.cleanupOwnProfile(zodPage);
  await helpers.cleanupContactNicknames(zodPage);
  await helpers.cleanupContactNicknames(tenPage);
  
  // Add a longer wait to ensure profile changes propagate
  await zodPage.waitForTimeout(3000);
  await tenPage.waitForTimeout(3000);
});