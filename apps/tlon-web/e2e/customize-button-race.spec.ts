import * as helpers from './helpers';
import { expect, test } from './test-fixtures';

test.describe('Customize button race condition', () => {
  test('should open customization immediately after group creation', async ({
    zodPage,
  }) => {
    const page = zodPage;

    // Create a new group - navigates to it
    await helpers.createGroup(page);

    // Verify we're in the welcome/empty state
    await expect(page.getByText('Welcome to your group!')).toBeVisible();

    // Open customization immediately (tests the race condition)
    await helpers.openGroupCustomization(page);

    // Verify we navigated to customization screen
    await expect(page.getByText('Edit group info')).toBeVisible();
  });
});
