import { expect, Page } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

const GROUP_NAME = '~ten, ~zod';
const MESSAGE_TEXT = 'Shortcode refresh duplicate reaction repro';

test('should keep one thumb reaction chip when another ship reacts after zod reloads', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  await setupGroupWithMessage(zodPage, tenPage);

  await waitForWebDbSave(zodPage);
  await reloadFromHome(zodPage);

  // Keep the new session alive on Home, then update the cached post from another
  // official client so opening the channel triggers the stale-post /changes refresh.
  await helpers.reactToMessage(tenPage, MESSAGE_TEXT, 'thumb');

  await openGeneralChannel(zodPage, GROUP_NAME);
  await expectSingleThumbReaction(zodPage);
  await addThumbReaction(zodPage);
  await expectSingleThumbReactionWithCount(zodPage, 2);
});

test('should keep one thumb reaction chip when zod reacted before stale refresh', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  await setupGroupWithMessage(zodPage, tenPage);

  await helpers.reactToMessage(zodPage, MESSAGE_TEXT, 'thumb');
  await expect(tenPage.getByTestId('ReactionDisplay').getByText('👍')).toBeVisible();

  await waitForWebDbSave(zodPage);
  await reloadFromHome(zodPage);

  await helpers.reactToMessage(tenPage, MESSAGE_TEXT, 'thumb');

  await openGeneralChannel(zodPage, GROUP_NAME);
  await expectSingleThumbReactionWithCount(zodPage, 2);
});

test('should keep one thumb reaction chip after zod refreshes again', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  await setupGroupWithMessage(zodPage, tenPage);

  await waitForWebDbSave(zodPage);
  await reloadFromHome(zodPage);

  await helpers.reactToMessage(tenPage, MESSAGE_TEXT, 'thumb');

  await openGeneralChannel(zodPage, GROUP_NAME);
  await expectSingleThumbReaction(zodPage);
  await addThumbReaction(zodPage);
  await expectSingleThumbReactionWithCount(zodPage, 2);

  await zodPage.reload();
  await expect(zodPage.getByTestId('HomeNavIcon')).toBeVisible({
    timeout: 30000,
  });

  await openGeneralChannel(zodPage, GROUP_NAME);
  await expectSingleThumbReactionWithCount(zodPage, 2);
});

async function setupGroupWithMessage(zodPage: Page, tenPage: Page) {
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  await helpers.createGroup(zodPage);
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  await openGeneralChannel(zodPage, GROUP_NAME);

  await helpers.acceptGroupInvite(tenPage, GROUP_NAME);
  await helpers.navigateToChannel(tenPage, 'General');

  await helpers.sendMessage(zodPage, MESSAGE_TEXT);
  await expect(
    tenPage.getByTestId('Post').getByText(MESSAGE_TEXT, { exact: true })
  ).toBeVisible({ timeout: 15000 });
}

async function waitForWebDbSave(page: Page) {
  // The web DB persists to IndexedDB on a 1000ms debounce.
  await page.waitForTimeout(2000);
}

async function reloadFromHome(page: Page) {
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Home')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
    timeout: 10000,
  });
}

async function openGeneralChannel(page: Page, groupName: string) {
  await helpers.navigateToGroupByTestId(page, {
    expectedDisplayName: groupName,
  });
  await helpers.navigateToChannel(page, 'General');
}

async function expectSingleThumbReaction(page: Page) {
  await expect(page.getByTestId('ReactionDisplay')).toHaveCount(1);
  await expect(page.getByTestId('ReactionDisplay').getByText('👍')).toHaveCount(
    1
  );
}

async function expectSingleThumbReactionWithCount(page: Page, count: number) {
  await expectSingleThumbReaction(page);
  await expect(
    page.getByTestId('ReactionDisplay').getByText(String(count), { exact: true })
  ).toHaveCount(1);
}

async function addThumbReaction(page: Page) {
  // Add the same visible emoji from the refreshed client. If the cached
  // reaction stayed as shortcode, the optimistic local insert creates a second
  // visually identical chip keyed by Unicode.
  await helpers.longPressMessage(page, MESSAGE_TEXT);
  await page.getByTestId('EmojiToolbarButton-thumb').click();
}
