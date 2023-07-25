import { test, expect } from '@playwright/test';

test('Invite to a group', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('link', { name: 'Add Note' }).waitFor();
  await page.getByRole('link', { name: 'Invite People' }).click();
  await page.getByLabel('Ships').click();
  await page.getByRole('combobox', { name: 'Ships' }).fill('~zod');
  await page.getByText('zod', { exact: true }).click();
  await page.getByRole('button', { name: 'Send Invites' }).click();
  await page.getByText('A bus note').waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'B Bus Club' }).click();
  await page.getByRole('menuitem', { name: 'Group Settings' }).click();
  await page.getByRole('link', { name: 'Members' }).click();
  await page
    .getByRole('region', { name: 'Members' })
    .getByText('zod')
    .waitFor();
});
