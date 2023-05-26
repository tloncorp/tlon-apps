import { test } from '@playwright/test';

test('Invite to a group', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('link', { name: 'Add Note' }).waitFor();
  await page.getByRole('link', { name: 'Invite People' }).click();
  await page.locator('.py-0\\.5').click();
  await page.getByRole('combobox', { name: 'Ships' }).fill('~zod');
  await page.getByText('zod', { exact: true }).click();
  await page.getByRole('button', { name: 'Send Invites' }).click();
  await page.getByRole('button', { name: 'B Bus Club' }).click();
  await page.getByRole('menuitem', { name: 'Members & Group Info' }).click();
  await page.getByRole('link', { name: 'Members' }).click();
  await page
    .locator('div')
    .filter({ hasText: /^~zod$/ })
    .waitFor();
});
