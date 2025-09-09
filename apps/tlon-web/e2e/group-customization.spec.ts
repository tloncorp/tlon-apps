import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should customize group name, icon, and description', async ({
  zodPage,
}) => {
  const page = zodPage;

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Verify we're in the blank channel state (Welcome to your group! message)
  await expect(page.getByText('Welcome to your group!')).toBeVisible();

  // Open the Customize group screen from the blank channel
  await helpers.openGroupCustomization(page);

  // Verify we're on the group customization screen
  await expect(page.getByText('Edit group info')).toBeVisible();

  // Click Cancel to verify navigation back to blank channel
  await page.getByText('Cancel').click();

  // Verify we're back to the blank channel state
  await expect(page.getByText('Welcome to your group!')).toBeVisible();

  // Open the Customize group screen again to continue with the test
  await helpers.openGroupCustomization(page);

  // Change the group name
  await helpers.changeGroupName(page, 'My Group');

  // Navigate back and verify name change on Home screen
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('My Group')).toBeVisible();
    await page.getByText('My Group').click();
  }

  // Change the group icon/picture. TODO: Implement image upload functionality in e2e tests. e2e ships don't have a storage config.
  await helpers.openGroupCustomization(page);
  // await helpers.changeGroupIcon(page); // No image path provided, so it will just test the interface

  // close the modal
  // not clear why we need to click the first one, but it works
  // await page.getByTestId('AttachmentSheetCloseButton').first().click();

  // Change the group description
  await helpers.changeGroupDescription(page, 'This is a test group');

  // Verify the description was saved (optional check)
  await helpers.openGroupCustomization(page);
  const descriptionField = page.getByTestId('GroupDescriptionInput');
  if (await descriptionField.isVisible()) {
    await expect(descriptionField).toHaveValue('This is a test group');
  }
  await page.getByText('Cancel').click();
});
