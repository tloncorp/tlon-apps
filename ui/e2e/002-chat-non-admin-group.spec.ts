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

  // To do: Find div "Edit with Markdown"  and locate toggle button formarkdown

  // await page.getByRole('button', { name: 'New Block' }).click();
  // await page.getByLabel('Gallery block editor').waitFor();
  // await page.getByLabel('Gallery block editor').fill('Posting text');
  // await page.getByRole('button', { name: 'Post' }).click();
  // await expect(page.locator('.heap-block').getByText('Posting text')).toBeVisible();

  // await page.getByTestId('sidebar-item-text-Zod notebook').waitFor();
  // await page.getByTestId('sidebar-item-text-Zod notebook').click();

  // await page.goto('http://localhost:3000/apps/groups/groups');
  // await page.goto('http://localhost:3000/~/login?redirect=/');
  // await page.getByPlaceholder('sampel-ticlyt-migfun-falmel').click();
  // await page.getByPlaceholder('sampel-ticlyt-migfun-falmel').fill('riddec-bicrym-ridlev-pocsef');
  // await page.getByRole('button', { name: 'Continue' }).click();
  // const page1Promise = page.waitForEvent('popup');
  // await page.getByRole('link', { name: 'Menu Groups' }).click();
  // const page1 = await page1Promise;
  // await page1.getByRole('link', { name: 'Z Zod test group' }).click();
  // await page1.getByRole('link', { name: 'Zod chat' }).click();
  // await page1.getByRole('button', { name: 'Start Thread' }).click();
  // await page1.getByRole('paragraph').nth(1).click();
  // await page1.locator('[id="chat-thread-input-dropzone-\\~bus\\/170\\.141\\.184\\.506\\.514\\.883\\.418\\.760\\.476\\.201\\.384\\.738\\.291"] > div > .input > .w-full > .ProseMirror').fill('good');
  // await page1.getByRole('button', { name: 'eyrie' }).click();
  // await page1.getByRole('button', { name: 'eyrie' }).click();
  // await page1.getByText('good').click();
  // await page1.locator('div').filter({ hasText: /^good$/ }).nth(2).press('Enter');
  // await page1.getByRole('link', { name: 'Zod gallery' }).click();
  // await page1.getByRole('button', { name: 'New Block' }).click();
  // await page1.getByRole('paragraph').click();
  // await page1.getByRole('dialog').locator('div').nth(2).fill('Posting text');
  // await page1.getByRole('button', { name: 'Post' }).click();
  // await page1.locator('.heap-block > div').first().click();
  // await page1.getByRole('link', { name: 'Zod notebook' }).click();
  // await page1.getByRole('link', { name: 'Add Note' }).click();
  // await page1.getByPlaceholder('New Title').click();
  // await page1.getByPlaceholder('New Title').fill('Title of test notebook');
  // await page1.getByRole('paragraph').click();
  // await page1.locator('.ProseMirror').fill('Content of notebook');
  // await page1.getByRole('button', { name: 'Save' }).click();
  // await page1.getByRole('link', { name: 'Title of test notebook November 16th, 2023 bus comments Share Note menu' }).click();
});
