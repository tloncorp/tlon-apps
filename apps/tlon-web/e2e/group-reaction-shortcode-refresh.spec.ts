import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

const GROUP_NAME = '~ten, ~zod';
const MESSAGE_TEXT = 'Shortcode refresh duplicate reaction repro';

test('should never show duplicate thumb reaction chips after stale refresh', async ({
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

  const maxThumbChipCountPromise = watchMaxThumbReactionChipCount(zodPage);
  await addThumbReaction(zodPage);

  expect(await maxThumbChipCountPromise).toBe(1);
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
  const reactionDisplay = getMessagePost(page).getByTestId('ReactionDisplay');
  await expect(reactionDisplay).toHaveCount(1);
  await expect(reactionDisplay.getByText('👍')).toHaveCount(1);
}

async function expectSingleThumbReactionWithCount(page: Page, count: number) {
  const reactionDisplay = getMessagePost(page).getByTestId('ReactionDisplay');
  await expectSingleThumbReaction(page);
  await expect(
    reactionDisplay.getByText(String(count), { exact: true })
  ).toHaveCount(1);
}

async function addThumbReaction(page: Page) {
  await helpers.longPressMessage(page, MESSAGE_TEXT);
  await page.getByTestId('EmojiToolbarButton-thumb').click();
}

async function watchMaxThumbReactionChipCount(page: Page, durationMs = 2000) {
  const post = getMessagePost(page);

  return post.evaluate(
    (element, watchDurationMs) =>
      new Promise<number>((resolve) => {
        const countThumbReactionChips = () =>
          Array.from(
            element.querySelectorAll('[data-testid="ReactionDisplay"]')
          ).filter((reaction) => reaction.textContent?.includes('👍')).length;

        let maxCount = countThumbReactionChips();
        const observer = new MutationObserver(() => {
          maxCount = Math.max(maxCount, countThumbReactionChips());
        });

        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        setTimeout(() => {
          observer.disconnect();
          resolve(maxCount);
        }, watchDurationMs);
      }),
    durationMs
  );
}

function getMessagePost(page: Page) {
  return page
    .getByTestId('Post')
    .filter({ has: page.getByText(MESSAGE_TEXT, { exact: true }) })
    .first();
}
