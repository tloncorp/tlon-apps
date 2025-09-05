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

  // Change the group icon/picture if storage is configured
  // Check if storage is configured by looking for environment variables
  const isStorageConfigured =
    process.env.E2E_S3_ENDPOINT &&
    process.env.E2E_S3_ACCESS_KEY_ID &&
    process.env.E2E_S3_SECRET_ACCESS_KEY &&
    process.env.E2E_S3_BUCKET_NAME;

  if (isStorageConfigured) {
    await helpers.openGroupCustomization(page);
    // Test image upload functionality
    await helpers.changeGroupIcon(page); // This will test the upload interface
    // Close the attachment sheet after testing
    // await page.getByTestId('AttachmentSheetCloseButton').first().click();
    // wait for upload to complete
    await page.waitForTimeout(10000);
    // press the save button
    await page.getByText('Save').click();

    // Verify the group icon was uploaded to S3 (not base64)

    // navigate to group settings
    await helpers.openGroupSettings(page);

    // Wait for the group icon to be visible
    const groupIcon = page.getByTestId('GroupIcon').first().getByRole('img');
    await expect(groupIcon).toBeVisible({ timeout: 10000 });

    // Get the src attribute and verify it's a URL, not base64
    const iconSrc = await groupIcon.getAttribute('src');
    expect(iconSrc).toBeTruthy();

    // Check that it's NOT a base64 data URI
    expect(iconSrc).not.toMatch(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/);

    // Check that it IS an HTTP(S) URL (likely from S3)
    expect(iconSrc).toMatch(/^https?:\/\//);

    console.log('✅ Group icon uploaded to S3 successfully:', iconSrc);
    await helpers.navigateBack(page);
  } else {
    console.log('Skipping image upload test - S3 storage not configured');
  }

  // Open group settings to edit the description
  await helpers.openGroupSettings(page);

  await page.getByText('Edit').click();

  // Change the group description
  await helpers.changeGroupDescription(page, 'This is a test group');

  // Navigate back to verify the changes
  await helpers.navigateBack(page);

  // Optionally verify the description was saved by opening customization again
  await helpers.openGroupSettings(page);
  await page.getByText('Edit').click();
  const descriptionField = page.getByTestId('GroupDescriptionInput');
  if (await descriptionField.isVisible()) {
    await expect(descriptionField).toHaveValue('This is a test group');
  }
  await page.getByText('Cancel').click();
});
