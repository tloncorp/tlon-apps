import { test } from '@playwright/test';

test('Create a group', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByText('Some Good Groups').waitFor();
  await page.getByRole('link', { name: 'Create Group' }).click();
  await page.getByPlaceholder('e.g. Urbit Fan Club').click();
  await page.getByPlaceholder('e.g. Urbit Fan Club').fill('Bus Club');
  await page.locator('textarea[name="description"]').click();
  await page.locator('textarea[name="description"]').fill('Get in.');
  await page.getByRole('button', { name: 'Next: Privacy' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create Group' }).click();
  await page.getByRole('heading', { name: 'or drag a Channel here' }).waitFor();
});
