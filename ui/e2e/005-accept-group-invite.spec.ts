import { test, expect } from '@playwright/test';

test('accept group invite', async ({ page }) => {
  test.skip(process.env.SHIP === '~bus', 'skip on ~bus');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByText('Pending Invites').waitFor();
  await page.getByRole('button', { name: 'Join Group' }).first().click();
  await page
    .getByText('Fetching messages from group host. This might take a sec...')
    .waitFor();
  await page.getByText('bus chat').first().waitFor();
  await page.getByText('bus chat').first().click();
  await page.getByText("hi, it's me, ~bus").waitFor();
});
