import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

/**
 * Helper to test group creation with a specific template
 */
async function testGroupCreation({
  page,
  groupType,
  expectedTitle,
  expectedChannels,
  hasWelcomeMessage = false,
}: {
  page: Page;
  groupType: 'quick' | 'basic' | string;
  expectedTitle: string;
  expectedChannels: Array<{ title: string; type: 'chat' | 'notebook' | 'gallery' }>;
  hasWelcomeMessage?: boolean;
}) {
  await expect(page.getByText('Home')).toBeVisible();

  await helpers.createGroupWithTemplate(page, groupType);

  // Quick groups show welcome message, template groups don't
  if (hasWelcomeMessage) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible({
      timeout: 5000,
    });
  } else {
    await page.waitForTimeout(2000);
  }

  const homeVisible = await page.getByText('Home').isVisible();
  if (!homeVisible) {
    await page.getByTestId('HomeNavIcon').click();
  }

  await expect(page.getByText(expectedTitle)).toBeVisible({
    timeout: 10000,
  });

  await page.getByText(expectedTitle).click();
  await page.waitForTimeout(1000);

  await helpers.verifyGroupChannels(page, expectedChannels);

  // Clean up: navigate back and delete the group
  await helpers.navigateBack(page);
  await helpers.navigateBack(page);
  await helpers.openGroupSettings(page);
  await helpers.deleteGroup(page, expectedTitle !== 'Untitled group' ? expectedTitle : undefined);

  await expect(page.getByText('Home')).toBeVisible();
  await expect(page.getByText(expectedTitle)).not.toBeVisible();
}

test('should create a quick group with default single channel', async ({
  zodPage,
}) => {
  await testGroupCreation({
    page: zodPage,
    groupType: 'quick',
    expectedTitle: 'Untitled group',
    expectedChannels: [{ title: 'General', type: 'chat' }],
    hasWelcomeMessage: true,
  });
});

test('should create a basic group with chat, gallery, and notebook channels', async ({
  zodPage,
}) => {
  await testGroupCreation({
    page: zodPage,
    groupType: 'basic',
    expectedTitle: 'Basic Group',
    expectedChannels: [
      { title: 'Chat', type: 'chat' },
      { title: 'Gallery', type: 'gallery' },
      { title: 'Notebook', type: 'notebook' },
    ],
  });
});

test('should create a Book Club template group with correct channels', async ({
  zodPage,
}) => {
  await testGroupCreation({
    page: zodPage,
    groupType: 'Book Club',
    expectedTitle: 'Book Club',
    expectedChannels: [
      { title: 'Book chat', type: 'chat' },
      { title: 'Now reading', type: 'gallery' },
      { title: 'Reviews', type: 'notebook' },
    ],
  });
});
