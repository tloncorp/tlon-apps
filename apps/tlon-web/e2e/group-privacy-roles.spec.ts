import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should handle group privacy and role management', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test privacy settings
  await helpers.setGroupPrivacy(page, 'private');
  await helpers.navigateBack(page);
  await expect(page.getByText('Private group with 1 member')).toBeVisible();
  await expect(
    page.getByTestId('GroupPrivacy').getByText('Private')
  ).toBeVisible();

  // Test role management
  await page.getByTestId('GroupRoles').click();
  await expect(page.getByText('Group Roles')).toBeVisible();
  await expect(page.getByTestId('GroupRole-Admin')).toBeVisible();

  // Create new role
  await helpers.createRole(page, 'Testing role', 'Description for test role');

  await helpers.navigateBack(page);
  await helpers.verifyElementCount(page, 'GroupRoles', 2);

  // Edit existing role
  await page.getByTestId('GroupRoles').click();
  await page.getByTestId('GroupRole-Testing role').click();
  await expect(page.getByText(/.*Description for test role.*/)).toBeVisible();
  await helpers.fillFormField(
    page,
    'RoleDescriptionInput',
    'Updated description'
  );
  await page.getByText('Save').click();
  await expect(page.getByText('Updated description')).toBeVisible();
});
