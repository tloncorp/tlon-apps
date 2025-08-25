import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should allow users to edit their own profile', async ({ zodSetup }) => {
  const zodPage = zodSetup.page;

  // Navigate to own profile
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Contacts')).toBeVisible();
  await zodPage.getByText('You').click();
  await expect(zodPage.getByText('Profile')).toBeVisible();
  
  // Edit profile
  await zodPage.getByText('Edit').click();
  await expect(zodPage.getByText('Edit Profile')).toBeVisible();
  
  // Update nickname
  await zodPage.getByTestId('ProfileNicknameInput').click();
  await zodPage
    .getByTestId('ProfileNicknameInput')
    .fill('Zod Testing nickname');
  
  // Update status
  await zodPage.getByRole('textbox', { name: 'Hanging out...' }).click();
  await zodPage
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Zod Testing status');
  
  // Update bio
  await zodPage.getByRole('textbox', { name: 'About yourself' }).click();
  await zodPage
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Zod Testing bio');
  
  // Try to add a group (but close since we don't have any groups in test)
  await zodPage.getByText('Add a group').click();
  await zodPage.getByTestId('CloseFavoriteGroupSelectorSheet').click();
  
  // Save changes
  await zodPage.getByText('Done').click();
  
  // TODO: figure out why we need to reload here. This should be fixed.
  await zodPage.reload();
  
  // Verify changes were saved
  await zodPage.getByTestId('AvatarNavIcon').click();
  await expect(zodPage.getByText('Zod Testing nickname').first()).toBeVisible();
  await expect(zodPage.getByText('Zod Testing status').first()).toBeVisible();
  await expect(zodPage.getByText('Zod Testing bio')).toBeVisible();

  // Clean up own profile
  await helpers.cleanupOwnProfile(zodPage);
  await zodPage.waitForTimeout(3000);
});