import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

// mardev is the owner of the group
// patbud is the testing ship

const testUrl = `${shipManifest['~habduc-patbud'].webUrl}/apps/groups/`;
const groupOwner = 'mardev';

// Authenticate as patbud
test.use({ storageState: 'e2e/.auth/habduc-patbud.json' });

test('Add markdown note to existing notebook channel', async ({ page }) => {
  await page.goto(testUrl);
  await page.getByRole('link', { name: `${groupOwner} test group` }).waitFor();
  await page.getByRole('link', { name: `${groupOwner} test group` }).click();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).waitFor();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).click();
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
  await page.goto(testUrl);
  await page.getByRole('link', { name: `${groupOwner} test group` }).waitFor();
  await page.getByRole('link', { name: `${groupOwner} test group` }).click();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).waitFor();
  await page.getByTestId(`sidebar-item-text-${groupOwner} notebook`).click();
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
  const locator = page.getByRole('link', { name: 'tlon corp' });
  await expect(locator).toHaveAttribute('href', 'https://tlon.io/');
});
