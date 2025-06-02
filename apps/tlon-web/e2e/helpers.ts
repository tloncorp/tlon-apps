import { Page, expect } from '@playwright/test';

export async function clickThroughWelcome(page: Page) {
  await page.waitForTimeout(3000);
  if (await page.getByText('Welcome to Tlon Messenger').isVisible()) {
    await page.getByTestId('lets-get-started').click();
    await page.getByTestId('got-it').click();
    await page.getByTestId('one-quick-thing').click();
    await page.getByTestId('invite-friends').click();
    await page.getByTestId('connect-contact-book').click();
  }
}

export async function createGroup(page: Page) {
  await page.getByTestId('CreateChatSheetTrigger').click();
  await page.getByText('New group').click();
  await page.getByText('Select contacts to invite').click();
  await page.getByText('Create group').click();

  await page.waitForTimeout(2000);

  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }
}

export async function deleteGroup(page: Page) {
  await page.getByTestId('GroupLeaveAction-Delete group').click();
  await expect(page.getByText('Delete Untitled group?')).toBeVisible();
  await page.getByTestId('ActionSheetAction-Delete group').click();
  await expect(page.getByText('Untitled group')).not.toBeVisible();
}

export async function openGroupSettings(page: Page) {
  await page
    .locator('[data-testid="GroupOptionsSheetTrigger"]')
    .first()
    .click();
  await expect(page.getByText('Group info & settings')).toBeVisible();
  await page.getByText('Group info & settings').click();
}

export async function navigateToHomeAndVerifyGroup(
  page: Page,
  expectedStatus: 'pinned' | 'unpinned'
) {
  await page.getByTestId('HeaderBackButton').nth(1).click();
  if (await page.getByText('Home').isVisible()) {
    await expect(
      page.getByTestId(`ChatListItem-Untitled group-${expectedStatus}`)
    ).toBeVisible();
  }
}

export async function fillFormField(
  page: Page,
  testId: string,
  value: string,
  shouldClear = false
) {
  await page.getByTestId(testId).click();
  if (shouldClear) {
    await page.getByTestId(testId).fill('');
  }
  await page.fill(`[data-testid="${testId}"]`, value);
}
