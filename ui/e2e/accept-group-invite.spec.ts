import { test, expect } from '@playwright/test';

test('accept group invite', async ({ page }) => {
  test.skip(process.env.SHIP === '~bus', 'skip on ~bus');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByText('Pending Invites').waitFor();
  await page.getByRole('button', { name: 'Join' }).click();
  await page.getByLabel('Send message').waitFor();
});
