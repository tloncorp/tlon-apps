import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should allow viewing and syncing profiles across ships', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // First, ~zod sets up their profile with custom data
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
  
  // Wait for profile to sync
  await zodPage.reload();
  await zodPage.waitForTimeout(2000);

  // Now ~ten adds ~zod as a contact to view their profile
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
  await tenPage.waitForTimeout(3000); // Wait for contact to be added

  // Navigate back to Contacts screen
  await tenPage.getByTestId('AvatarNavIcon').click();
  await expect(tenPage.getByText('Contacts')).toBeVisible();

  // Click on ~zod in the contacts list - should show with their nickname once synced
  // The contact will appear with "Zod Testing nickname" after sync
  await tenPage.getByText('Zod Testing nickname').first().click();
  await expect(tenPage.getByText('Profile')).toBeVisible();
  
  // Verify ~ten can see all of ~zod's custom profile data
  await expect(tenPage.getByText('Zod Testing nickname').first()).toBeVisible();
  await expect(tenPage.getByText('Zod Testing status').first()).toBeVisible();
  await expect(tenPage.getByText('Zod Testing bio')).toBeVisible();

  // Now test the reverse - ~zod adds ~ten and views their profile
  // First, ~ten sets up their profile
  await tenPage.getByTestId('AvatarNavIcon').click();
  await tenPage.getByText('You').click();
  await tenPage.getByText('Edit').click();
  await expect(tenPage.getByText('Edit Profile')).toBeVisible();
  
  await tenPage.getByTestId('ProfileNicknameInput').click();
  await tenPage.getByTestId('ProfileNicknameInput').fill('Ten Own Nickname');
  await tenPage.getByRole('textbox', { name: 'Hanging out...' }).click();
  await tenPage
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Ten Status Message');
  await tenPage.getByRole('textbox', { name: 'About yourself' }).click();
  await tenPage
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Ten Bio Information');
  await tenPage.getByText('Done').click();
  
  // Wait for profile to sync
  await tenPage.reload();
  await tenPage.waitForTimeout(2000);

  // ~zod adds ~ten as a contact
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  await zodPage.getByTestId('ContactsAddButton').click();
  await expect(zodPage.getByText('Add Contacts')).toBeVisible();
  await zodPage.getByPlaceholder('Filter by nickname, @p').fill('~ten');
  await zodPage.waitForTimeout(1000);
  await zodPage.getByTestId('ContactRow').getByText('~ten').click();
  await zodPage.getByText('Add 1 contact').click();
  await zodPage.waitForTimeout(3000);

  // Navigate to ~ten's profile
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  
  // ~ten should appear with their nickname
  await zodPage.getByText('Ten Own Nickname').first().click();
  await expect(zodPage.getByText('Profile')).toBeVisible();
  
  // Verify ~zod can see all of ~ten's custom profile data
  await expect(zodPage.getByText('Ten Own Nickname').first()).toBeVisible();
  await expect(zodPage.getByText('Ten Status Message').first()).toBeVisible();
  await expect(zodPage.getByText('Ten Bio Information')).toBeVisible();

  // Clean up
  await helpers.cleanupOwnProfile(tenPage);
  await helpers.cleanupContactNicknames(tenPage);
  await helpers.cleanupOwnProfile(zodPage);
  await helpers.cleanupContactNicknames(zodPage);
  
  await zodPage.waitForTimeout(3000);
  await tenPage.waitForTimeout(3000);
});