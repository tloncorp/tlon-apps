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

  await zodPage.getByText('Save').click();

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
  await zodPage.getByTestId('ProfileStatusInput').click();
  await zodPage.getByTestId('ProfileStatusInput').fill('Zod Testing status');
  await zodPage.getByTestId('ProfileBioInput').click();
  await zodPage.getByTestId('ProfileBioInput').fill('Zod Testing bio');
  await zodPage.getByText('Save').click();

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
  await tenPage.getByText('Save').click();

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

test('removed address book matches require an explicit Add to save again', async ({
  zodSetup,
}) => {
  const page = zodSetup.page;
  const contactId = '~nec';
  const readShipContactState = async () => {
    const [contactsResponse, suggestionsResponse] = await Promise.all([
      page.request.get(
        new URL('/~/scry/contacts/v2/init.json', page.url()).href
      ),
      page.request.get(
        new URL('/~/scry/groups-ui/suggested-contacts.json', page.url()).href
      ),
    ]);
    expect(contactsResponse.ok()).toBeTruthy();
    expect(suggestionsResponse.ok()).toBeTruthy();
    const contacts = (await contactsResponse.json()) as {
      book: Record<string, unknown>;
      removed: string[];
    };
    const suggestions = (await suggestionsResponse.json()) as string[];
    return {
      saved: contactId in contacts.book,
      removed: contacts.removed.includes(contactId),
      suggested: suggestions.includes(contactId),
    };
  };
  const removedSuggestion = { saved: false, removed: true, suggested: true };
  const savedContact = { saved: true, removed: false, suggested: false };

  // Web cannot read a device address book. Seed the authoritative removal that
  // the native address-book flow sends, then exercise the shared contacts UI.
  const status = await page.evaluate(async (kip) => {
    const ship = (window as unknown as { ship: string }).ship;
    const response = await fetch(`/~/channel/contact-removal-${Date.now()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify([
        {
          id: 1,
          action: 'poke',
          ship,
          app: 'contacts',
          mark: 'contact-action-1',
          json: { page: { kip, contact: {} } },
        },
        {
          id: 2,
          action: 'poke',
          ship,
          app: 'contacts',
          mark: 'contact-remove',
          json: { kip, suggest: true },
        },
      ]),
    });
    return response.status;
  }, contactId);
  expect(status).toBe(204);
  await expect.poll(readShipContactState).toEqual(removedSuggestion);

  await page.getByTestId('AvatarNavIcon').click();
  await expect(
    page.getByText('Suggested contacts', { exact: true })
  ).toBeVisible();
  const row = page.locator(`[aria-label="ContactListItem-${contactId}"]`);
  await expect(row.getByText('Add', { exact: true })).toBeVisible();

  // Opening a suggestion only views its profile, including after a fresh sync.
  await row.click();
  await expect(page.getByText('Add Contact', { exact: true })).toBeVisible();
  await expect.poll(readShipContactState).toEqual(removedSuggestion);
  await page.reload();
  await page.getByTestId('AvatarNavIcon').click();
  await expect(row.getByText('Add', { exact: true })).toBeVisible();
  await row.click();
  await expect(page.getByText('Add Contact', { exact: true })).toBeVisible();

  await expect.poll(readShipContactState).toEqual(removedSuggestion);
  await row.getByText('Add', { exact: true }).click();
  await expect(page.getByText('Remove Contact', { exact: true })).toBeVisible();
  await expect(row.getByText('Add', { exact: true })).not.toBeVisible();
  await expect.poll(readShipContactState).toEqual(savedContact);
  await page.reload();
  await page.getByTestId('AvatarNavIcon').click();
  await expect(row.getByText('Add', { exact: true })).not.toBeVisible();
  await row.click();
  await expect(page.getByText('Remove Contact', { exact: true })).toBeVisible();

  await expect.poll(readShipContactState).toEqual(savedContact);

  // Contacts are the fixture cleanup exception; leave this contact unsaved.
  await page.getByText('Remove Contact', { exact: true }).click();
  await expect(page.getByText('Add Contact', { exact: true })).toBeVisible();
  await expect.poll(readShipContactState).toEqual({
    saved: false,
    removed: true,
    suggested: false,
  });
});
