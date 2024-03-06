import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

const groupHostUrl = `${shipManifest['~naldeg-mardev'].webUrl}/apps/groups/`;
const groupHost = 'mardev';
const testGroupName = 'mardev Club';
const testChannelName = 'mardev chat';
const testMessageText = `hi, it's me, ~naldeg-mardev`;
const defaultVisibleEmoji = '😇';

test('Add reaction', async ({ browser }) => {
  // authenticate as test group host
  const hostContext = await browser.newContext({
    storageState: shipManifest['~naldeg-mardev'].authFile,
  });
  const page = await hostContext.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(groupHostUrl);

  // navigate to test channel
  await page.getByRole('link', { name: testGroupName }).waitFor();
  await page.getByRole('link', { name: testGroupName }).click();
  await page.getByRole('link', { name: testChannelName }).waitFor();
  await page.getByRole('link', { name: testChannelName }).click();

  // open longpress menu
  await page.getByText(testMessageText).click({ delay: 300 });
  await page.getByTestId('chat-message-options').waitFor();
  await expect(page.getByTestId('chat-message-options')).toBeVisible();

  // open picker and add reaction
  await page.getByTestId('react').waitFor();
  await page.getByTestId('react').dispatchEvent('click'); // workaround for vaul intercepting the click event
  await page.getByTestId('emoji-picker').waitFor();
  await expect(page.getByTestId('emoji-picker')).toBeVisible();
  await page.getByText(defaultVisibleEmoji).waitFor();
  await page.getByText(defaultVisibleEmoji).click();

  // verify reaction
  await page.getByTestId('emoji-picker').waitFor({ state: 'detached' });
  await page.getByText(defaultVisibleEmoji).waitFor();
  await expect(page.getByText(defaultVisibleEmoji)).toBeVisible();
});
