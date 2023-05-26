import { test } from '@playwright/test';

test('Create a chat channel', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('heading', { name: 'or drag a Channel here' }).waitFor();
  await page.getByRole('link', { name: 'New Channel' }).nth(1).click();
  await page
    .locator('label')
    .filter({ hasText: 'ChatA simple, standard text chat' })
    .click();
  await page.getByLabel('Channel Name*').click();
  await page.getByLabel('Channel Name*').fill('bus chat');
  await page.getByLabel('Channel Description').click();
  await page.getByLabel('Channel Description').fill('the bus is coming');
  await page.getByRole('button', { name: 'Add Channel' }).click();
  await page.getByRole('link', { name: 'bus chat' }).waitFor();
  await page.getByRole('link', { name: 'bus chat' }).click();
  await page.getByLabel('Send message').waitFor();
});
