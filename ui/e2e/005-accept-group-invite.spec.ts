import { test, expect } from '@playwright/test';

test('accept group invite', async ({ page }) => {
  test.skip(process.env.SHIP === '~bus', 'skip on ~bus');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page
    .getByTestId('group-invite')
    .filter({ hasText: 'Bus Club' })
    .waitFor();
  const groupInvite = page
    .getByTestId('group-invite')
    .filter({ hasText: 'Bus Club' });
  await groupInvite.getByRole('button', { name: 'Accept' }).first().click();
  await page.getByText('Join This Group').waitFor();
  await page.getByRole('button', { name: 'Join Group' }).first().click();
  await page.getByText('bus chat').first().waitFor();
  await page.getByText('bus chat').first().click();
  await page.getByText("hi, it's me, ~bus").waitFor();
});
