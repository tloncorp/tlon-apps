import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should customize group name, icon, and description', async ({
  zodPage,
}) => {
  const page = zodPage;

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing group
  await helpers.cleanupExistingGroup(page);
  await helpers.cleanupExistingGroup(page, '~ten, ~zod');

  // Create a new group
  await helpers.createGroup(page);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open the Customize group screen
  await helpers.openGroupCustomization(page);

  // Change the group name
  await helpers.changeGroupName(page, 'My Group');

  // Navigate back and verify name change on Home screen
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('My Group')).toBeVisible();
    await page.getByText('My Group').click();
  }

  // Change the group icon/picture
  await helpers.openGroupCustomization(page);
  await helpers.changeGroupIcon(page); // No image path provided, so it will just test the interface

  // close the modal
  // not clear why we need to click the first one, but it works
  await page.getByTestId('AttachmentSheetCloseButton').first().click();

  // Change the group description
  await helpers.changeGroupDescription(page, 'This is a test group');

  // Verify the description was saved (optional check)
  await helpers.openGroupCustomization(page);
  const descriptionField = page.getByTestId('GroupDescriptionInput');
  if (await descriptionField.isVisible()) {
    await expect(descriptionField).toHaveValue('This is a test group');
  }
  await page.getByText('Cancel').click();

  // Delete the group and clean up
  await helpers.deleteGroup(page, 'My Group');

  // Verify we're back at Home and the renamed group is deleted
  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText('My Group')).not.toBeVisible();
});
