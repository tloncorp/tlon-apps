import { test, expect } from '@playwright/test';

test('Navigate to group chat', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'Zod test group' }).waitFor();
  await page.getByRole('link', { name: 'Zod test group' }).click();
  await page.getByTestId('sidebar-item-text-Zod chat').waitFor();
  await page.getByTestId('sidebar-item-text-Zod chat').click();
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill('hi there');
  await page.locator('.ProseMirror').press('Enter');
  await expect(page.getByText('hi there')).toBeVisible();
});

test('Add Block to existing gallery channel', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'Zod test group' }).waitFor();
  await page.getByRole('link', { name: 'Zod test group' }).click();
  await page.getByTestId('sidebar-item-text-Zod gallery').waitFor();
  await page.getByTestId('sidebar-item-text-Zod gallery').click();
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
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'Zod test group' }).waitFor();
  await page.getByRole('link', { name: 'Zod test group' }).click();
  await page.getByTestId('sidebar-item-text-Zod notebook').waitFor();
  await page.getByTestId('sidebar-item-text-Zod notebook').click();
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
