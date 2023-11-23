import { test, expect } from '@playwright/test';
import shipManifest from './shipManifest.json';

const busUrl = `${shipManifest['~bus'].webUrl}/apps/groups/`;

// Authenticate as bus
test.use({ storageState: 'e2e/.auth/bus.json' });

test('Add Note to existing notebook channel', async ({ page }) => {
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto(busUrl);
  await page.getByRole('link', { name: 'Zod test group' }).waitFor();
  await page.getByRole('link', { name: 'Zod test group' }).click();
  await page.getByTestId('sidebar-item-text-Zod notebook').waitFor();
  await page.getByTestId('sidebar-item-text-Zod notebook').click();
  await page.getByTestId('add-note-button').waitFor();
  await page.getByTestId('add-note-button').click();
  await page.getByTestId('note-title-input').waitFor();
  await page.getByTestId('note-title-input').click();
  await page.getByTestId('note-title-input').fill('Markdown note');

  // Markdown option by default should be false
  await expect(
    page.getByTestId('edit-with-markdown-toggle').getByRole('button')
  ).toHaveAttribute('aria-pressed', 'false');

  await page
    .getByTestId('edit-with-markdown-toggle')
    .getByRole('button')
    .click();
  await expect(
    page.getByTestId('edit-with-markdown-toggle').getByRole('button')
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('note-markdown-editor').click();
  await page.getByTestId('note-markdown-editor').fill('## Heading level 2');
  await page.getByTestId('save-note-button').click();
  await page.getByRole('heading', { name: 'Markdown note' }).waitFor();
  await page.getByRole('heading', { name: 'Markdown note' }).click();
  await expect(page.locator('article > h2').first()).toHaveText(
    'Heading level 2'
  );
});

test('Edit markdown note', async ({ page }) => {
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto(busUrl);
  await page.getByRole('link', { name: 'Zod test group' }).waitFor();
  await page.getByRole('link', { name: 'Zod test group' }).click();
  await page.getByTestId('sidebar-item-text-Zod notebook').waitFor();
  await page.getByTestId('sidebar-item-text-Zod notebook').click();
  await page.getByRole('heading', { name: 'Markdown note' }).waitFor();
  await page.getByRole('heading', { name: 'Markdown note' }).click();
  await page.getByTestId('button-edit-note').waitFor();
  await page.getByTestId('button-edit-note').click();
  await page
    .getByTestId('note-markdown-editor')
    .fill('[tlon corp](https://tlon.io/)');
  await page.getByTestId('save-note-button').click();
  await page.getByRole('heading', { name: 'Markdown note' }).waitFor();
  await page.getByRole('heading', { name: 'Markdown note' }).click();
  const locator = page.locator('article > a').first();
  await expect(locator).toHaveText('tlon corp');
  await expect(locator).toHaveAttribute('href', 'https://tlon.io/');
});
