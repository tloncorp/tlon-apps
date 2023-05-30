import { test, expect } from '@playwright/test';

test('Create a notebook channel and post to it.', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('link', { name: 'All Channels' }).click();
  await page.getByRole('link', { name: 'New Channel' }).click();
  await page
    .locator('label')
    .filter({ hasText: 'NotebookLongform publishing and discussion' })
    .click();
  await page.getByLabel('Channel Name*').click();
  await page.getByLabel('Channel Name*').fill('bus notes');
  await page.getByLabel('Channel Description').click();
  await page.getByLabel('Channel Description').fill('news from the bus');
  await page.getByRole('button', { name: 'Add Channel' }).click();
  await page.getByRole('link', { name: 'bus notes' }).waitFor();
  await page.getByRole('link', { name: 'bus notes' }).click();
  await page.getByRole('link', { name: 'Add Note' }).waitFor();
  await page.getByRole('link', { name: 'Add Note' }).click();
  await page.getByPlaceholder('New Title').click();
  await page.getByPlaceholder('New Title').fill('A bus note');
  await page.getByRole('paragraph').click();
  await page.locator('.ProseMirror').fill('With some bus content.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('link').filter({ hasText: 'A bus note' })
  ).toBeVisible();
});
