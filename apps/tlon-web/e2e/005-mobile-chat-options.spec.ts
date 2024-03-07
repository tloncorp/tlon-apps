import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

const groupHost = 'mardev';
const hostShip = '~naldeg-mardev';
const groupHostUrl = `${shipManifest[hostShip].webUrl}/apps/groups/`;
const testGroupName = `${groupHost} test group`;
const testChannelId = `sidebar-item-text-${groupHost} chat`;
const guestShip = '~naldeg-mardev';
const testMessageText = `hi there`;
const defaultVisibleEmoji = '😇';

test('Post chat message as group guest', async ({ browser }) => {
  // Authenticate as guestShip
  const guestContext = await browser.newContext({
    storageState: shipManifest[guestShip].authFile,
  });
  const page = await guestContext.newPage();
  await page.goto(groupHostUrl);
  await page.getByRole('link', { name: testGroupName }).waitFor();
  await page.getByRole('link', { name: testGroupName }).click();
  await page.getByTestId(testChannelId).waitFor();
  await page.getByTestId(testChannelId).click();
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill(testMessageText);
  await page.locator('.ProseMirror').press('Enter');
  await expect(page.getByText(testMessageText)).toBeVisible();
});

test('Add reaction as group host', async ({ browser }) => {
  // authenticate as test group host
  const hostContext = await browser.newContext({
    storageState: shipManifest[hostShip].authFile,
  });
  const page = await hostContext.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(groupHostUrl);

  // navigate to test channel
  await page.goto(groupHostUrl);
  await page.getByRole('link', { name: testGroupName }).waitFor();
  await page.getByRole('link', { name: testGroupName }).click();
  await page.getByTestId(testChannelId).waitFor();
  await page.getByTestId(testChannelId).click();

  // open longpress menu
  await page.getByText(testMessageText).click({ delay: 300 });
  // await page.getByTestId('chat-message-options').waitFor();
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
