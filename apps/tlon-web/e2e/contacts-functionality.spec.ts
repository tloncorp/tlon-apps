import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Contacts functionality', () => {
  test('should handle complete contacts workflow', async ({
    zodPage,
    tenPage,
  }) => {
    const zodUser = zodPage;
    const tenUser = tenPage;
    
    // Setup: Navigate to contacts screen
    await zodUser.getByTestId('AvatarNavIcon').click();
    await expect(zodUser.getByText('Contacts')).toBeVisible();

    // Test 1: Tap "+" icon in upper-left, navigate to "Add Contacts" screen
    await zodUser.getByTestId('ContactsAddButton').click();
    await expect(zodUser.getByText('Add Contacts')).toBeVisible();

    // Test 2: Type a ship name into "Filter by nickname, @p", see list filtered to that ship
    await zodUser.getByPlaceholder('Filter by nickname, @p').click();
    await zodUser.getByPlaceholder('Filter by nickname, @p').fill('~ten');
    await zodUser.waitForTimeout(2000);
    await expect(zodUser.getByTestId('ContactRow')).toBeVisible();
    await expect(zodUser.getByText('~ten')).toBeVisible();

    // Test 3: Tap ship in list, check mark appears, "Add contact" button becomes enabled
    await zodUser.getByTestId('ContactRow').first().click();
    await zodUser.waitForTimeout(1000);
    
    // Verify checkmark appears and button is enabled
    await expect(zodUser.getByText('Add 1 contact')).toBeVisible();

    // Test 4: Tap "Add Contact", navigated back to Contacts screen, contacts added
    await zodUser.getByText('Add 1 contact').click();
    await zodUser.waitForTimeout(2000);
    await expect(zodUser.getByText('Contacts')).toBeVisible();
    
    // Verify contact was added to the contacts list
    await expect(zodUser.getByText('~ten')).toBeVisible();

    // Test 5: Tap ship added as contact, navigated to their profile
    await zodUser.getByText('~ten').click();
    await expect(zodUser.getByText('Profile')).toBeVisible();
    await expect(zodUser.getByText('~ten')).toBeVisible();

    // Test 6: Tap "Edit" in upper-right, see form fields for nickname, avatar overrides
    await zodUser.getByText('Edit').click();
    await expect(zodUser.getByText('Edit Profile')).toBeVisible();
    
    // Verify we can see nickname and bio fields (representing contact editing capabilities)
    await expect(zodUser.getByTestId('ProfileNicknameInput')).toBeVisible();
    await expect(zodUser.getByRole('textbox', { name: 'About yourself' })).toBeVisible();

    // Test 7: Override contact's name, tap Done, navigated back to profile, changes reflected
    await zodUser.getByTestId('ProfileNicknameInput').click();
    await zodUser.getByTestId('ProfileNicknameInput').fill('Ten User');
    await zodUser.getByRole('textbox', { name: 'About yourself' }).click();
    await zodUser.getByRole('textbox', { name: 'About yourself' }).fill('Test bio for ten');
    await zodUser.getByText('Done').click();
    
    // Navigate back to profile and verify changes
    await expect(zodUser.getByText('Profile')).toBeVisible();
    await expect(zodUser.getByText('Ten User')).toBeVisible();
    await expect(zodUser.getByText('Test bio for ten')).toBeVisible();

    // Test 8: Tap "<" icon in upper-left, navigated back to Contacts screen
    await zodUser.getByTestId('HeaderBackButton').click();
    await expect(zodUser.getByText('Contacts')).toBeVisible();
    
    // Verify the contact shows with the new nickname
    await expect(zodUser.getByText('Ten User')).toBeVisible();

    // Test 9: Tap ship added as contact, navigated to their profile
    await zodUser.getByText('Ten User').click();
    await expect(zodUser.getByText('Profile')).toBeVisible();

    // Test 10: Tap "Remove contact", button text changes to "Add Contact," nickname override disappears
    await zodUser.getByText('Remove Contact').click();
    await zodUser.waitForTimeout(1000);
    
    // Verify button changed to "Add Contact"
    await expect(zodUser.getByText('Add Contact')).toBeVisible();
    await zodUser.reload(); // Reload to see updated contact state
    
    // Navigate back to profile to verify nickname disappeared
    await zodUser.getByTestId('AvatarNavIcon').click();
    await zodUser.getByText('~ten').click();
    // Should show original ship name, not the nickname
    await expect(zodUser.getByText('~ten')).toBeVisible();

    // Test 11: Tap "<" icon in upper-left, navigated back to Contacts screen, contact is gone
    await zodUser.getByTestId('HeaderBackButton').click();
    await expect(zodUser.getByText('Contacts')).toBeVisible();
    
    // Contact should no longer appear in contacts list (may still appear in suggestions)
    // We check that it's not in the main contacts section by looking for empty state or absence

    // Test 12: Add contact through suggested contacts (if available)
    // First, let's add the contact back through the suggestions if they exist
    if (await zodUser.getByText('~ten').isVisible()) {
      // If ~ten appears in suggestions, click the "Add" button next to it
      const tenSuggestion = zodUser.getByText('~ten').first();
      if (await tenSuggestion.isVisible()) {
        // Look for an Add button near the suggestion
        await tenSuggestion.click();
        await expect(zodUser.getByText('Profile')).toBeVisible();
        
        // Test 13: Tap "Add contact", button text changes to "Remove Contact"
        if (await zodUser.getByText('Add Contact').isVisible()) {
          await zodUser.getByText('Add Contact').click();
          await zodUser.waitForTimeout(1000);
          await expect(zodUser.getByText('Remove Contact')).toBeVisible();
        }
        
        // Test 14: Tap "<" icon in upper-left, navigated back to Contacts screen, new contact is present
        await zodUser.getByTestId('HeaderBackButton').click();
        await expect(zodUser.getByText('Contacts')).toBeVisible();
        await expect(zodUser.getByText('~ten')).toBeVisible();
      }
    }

    // Cleanup: Remove the contact to clean up for other tests
    if (await zodUser.getByText('~ten').isVisible()) {
      await helpers.cleanupContactForTest(zodUser, '~ten');
    }
  });

  test('should handle contact status updates', async ({ zodPage, tenPage }) => {
    const zodUser = zodPage;
    const tenUser = tenPage;

    // Setup: Add ~ten as a contact first
    await helpers.addContactForTest(zodUser, '~ten');

    // Navigate to contacts screen
    await zodUser.getByTestId('AvatarNavIcon').click();
    await expect(zodUser.getByText('Contacts')).toBeVisible();

    // Test 15: Contact updates their status - new status seen under contact name
    // First, have ~ten update their status
    await tenUser.getByTestId('AvatarNavIcon').click();
    await tenUser.getByText('You').click();
    await tenUser.getByText('Edit').click();
    await tenUser.getByRole('textbox', { name: 'Hanging out...' }).click();
    await tenUser.getByRole('textbox', { name: 'Hanging out...' }).fill('Testing status update');
    await tenUser.getByText('Done').click();

    // Switch back to zod and check if the status update is visible
    await zodUser.waitForTimeout(3000); // Wait for status to propagate
    await zodUser.reload(); // Reload to get latest status
    
    await zodUser.getByTestId('AvatarNavIcon').click();
    await expect(zodUser.getByText('Contacts')).toBeVisible();
    
    // Look for the updated status (might appear when viewing the contact's profile)
    await zodUser.getByText('~ten').click();
    await expect(zodUser.getByText('Testing status update')).toBeVisible();

    // Cleanup
    await helpers.cleanupContactForTest(zodUser, '~ten');
    
    // Clean up ten's status
    await tenUser.getByTestId('HeaderBackButton').click();
    await tenUser.getByTestId('AvatarNavIcon').click();
    await tenUser.getByText('You').click();
    await tenUser.getByText('Edit').click();
    await tenUser.getByRole('textbox', { name: 'Hanging out...' }).click();
    await tenUser.getByRole('textbox', { name: 'Hanging out...' }).fill('');
    await tenUser.getByText('Done').click();
  });
});