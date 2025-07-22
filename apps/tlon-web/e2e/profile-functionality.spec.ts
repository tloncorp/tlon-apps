import { expect } from '@playwright/test';

import { test } from './test-fixtures';

test('should test profile functionality', async ({ zodPage }) => {
  const page = zodPage;

  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Contacts')).toBeVisible();
  await page.getByText('You').click();
  await expect(page.getByText('Profile')).toBeVisible();
  await page.getByText('Edit').click();
  await expect(page.getByText('Edit Profile')).toBeVisible();
  await page.getByTestId('ProfileNicknameInput').click();
  await page.getByTestId('ProfileNicknameInput').fill('Testing nickname');
  await page.getByRole('textbox', { name: 'Hanging out...' }).click();
  await page
    .getByRole('textbox', { name: 'Hanging out...' })
    .fill('Testing status');
  await page.getByRole('textbox', { name: 'About yourself' }).click();
  await page
    .getByRole('textbox', { name: 'About yourself' })
    .fill('Testing bio');
  await page.getByText('Add a group').click();
  // This is a fake ship, so we don't have any groups to add. We could add a group to this test, though
  await page.getByTestId('CloseFavoriteGroupSelectorSheet').click();
  await page.getByText('Done').click();
  // TODO: figure out why we need to reload here. This should be fixed.
  await page.reload();
  await page.getByTestId('AvatarNavIcon').click();
  await expect(page.getByText('Testing nickname').first()).toBeVisible();
  await expect(page.getByText('Testing status').first()).toBeVisible();
  await expect(page.getByText('Testing bio')).toBeVisible();

  // now we clean up
  await page.getByTestId('AvatarNavIcon').click();
  await page.getByText('You').click();
  await page.getByText('Edit').click();
  await page.getByTestId('ProfileNicknameInput').click();
  await page.getByTestId('ProfileNicknameInput').fill('');
  await page.getByRole('textbox', { name: 'Hanging out...' }).click();
  await page.getByRole('textbox', { name: 'Hanging out...' }).fill('');
  await page.getByRole('textbox', { name: 'About yourself' }).click();
  await page.getByRole('textbox', { name: 'About yourself' }).fill('');

  await page.getByText('Done').click();
  await page.getByTestId('AvatarNavIcon').click();
  await page.getByText('You').click();
  await expect(page.getByText('Testing nickname')).not.toBeVisible();
  await expect(page.getByText('Testing status')).not.toBeVisible();
  await expect(page.getByText('Testing bio')).not.toBeVisible();
});
