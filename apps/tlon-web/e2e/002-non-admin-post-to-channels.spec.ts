import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

// mardev is the owner of the group
// patbud is the testing ship

const testUrl = `${shipManifest['~habduc-patbud'].webUrl}/apps/groups/`;
const groupOwner = 'mardev';

// Authenticate as patbud
test.use({ storageState: 'e2e/.auth/habduc-patbud.json' });

test('Navigate to group chat', async ({ page }) => {
  await page.goto(testUrl);
  await page.getByRole('link', { name: `${groupOwner} test group` }).waitFor();
  await page.getByRole('link', { name: `${groupOwner} test group` }).click();
  await page.getByTestId(`sidebar-item-text-${groupOwner} chat`).waitFor();
  await page.getByTestId(`sidebar-item-text-${groupOwner} chat`).click();
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill('hi there');
  await page.locator('.ProseMirror').press('Enter');
  await expect(page.getByText('hi there')).toBeVisible();
});

test('Add Block to existing gallery channel', async ({ page }) => {
  await page.goto(testUrl);
  await page.getByRole('link', { name: `${groupOwner} test group` }).waitFor();
  await page.getByRole('link', { name: `${groupOwner} test group` }).click();
  await page.getByTestId(`sidebar-item-text-${groupOwner} gallery`).waitFor();
  await page.getByTestId(`sidebar-item-text-${groupOwner} gallery`).click();
  await page.getByTestId('add-block-button').waitFor();
  await page.getByTestId('add-block-button').click();
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill('Posting text');
  await page.getByTestId('block-post-button').click();
  await expect(
    page.locator('.heap-block').getByText('Posting text')
  ).toBeVisible();
});

test('Add Note to existing notebook channel', async ({ page }) => {
  await page.goto(testUrl);
  await page.getByRole('link', { name: `${groupOwner} test group` }).waitFor();
  await page.getByRole('link', { name: `${groupOwner} test group` }).click();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).waitFor();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).click();
  await page.getByTestId('add-note-button').waitFor();
  await page.getByTestId('add-note-button').click();
  await page.getByTestId('note-title-input').waitFor();
  await page.getByTestId('note-title-input').click();
  await page.getByTestId('note-title-input').fill('Title of test note');
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill('Posting note');
  await page.getByTestId('save-note-button').click();
  await expect(
    page.getByRole('heading', { name: 'Title of test note' })
  ).toBeVisible();
});
