import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Drag-and-drop reordering of the pinned ChatList section (TLON-5948).
//
// Home sidebar, three pinned groups: enter sort mode, drag one pin to a new
// slot, and assert the new order both optimistically and after a reload (proving
// it persisted, not just the local optimistic state).
//
// Rows are targeted by their unique title (group itemIds are unpredictable
// slugs) and order is asserted via each row's on-screen vertical position — the
// same bounding-box approach as home-sidebar-pinned-scroll.spec.ts.

// IMPORTANT: do not put the substrings "Pin"/"Unpin" in any title —
// helpers.toggleChatPin matches getByText('Pin')/getByText('Unpin'), and any
// such substring on the chat-details screen trips a strict-mode violation.
const TITLES = ['PReorder-Alpha', 'PReorder-Bravo', 'PReorder-Charlie'];

async function createNamedGroup(
  page: Page,
  title: string,
  registerForCleanup: (title: string) => void
) {
  await helpers.createGroup(page);
  await helpers.openGroupCustomization(page);
  await helpers.changeGroupName(page, title);
  // Register immediately: the group exists under this title even if a later
  // step times out, so the cleanup sweep can still find and delete it.
  registerForCleanup(title);
  await helpers.navigateBack(page);
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText(title, { exact: true })).toBeVisible({
    timeout: 10000,
  });
}

async function pinNamedGroup(page: Page, title: string) {
  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
    timeout: 10000,
  });
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible({ timeout: 10000 });
  const status = await helpers.toggleChatPin(page);
  expect(status).toBe('pinned');
  await helpers.navigateBack(page);
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
    timeout: 5000,
  });
}

// The visible top-to-bottom order of the given titles within the pinned
// scroller, derived from each row's bounding-box y. A pinned group appears only
// in the Pinned section (getChats removes it from "All"), so the title is unique.
async function visibleOrder(page: Page, titles: string[]): Promise<string[]> {
  const scroller = page.getByTestId('HomeSidebarChatScroller');
  const positioned = await Promise.all(
    titles.map(async (title) => {
      const box = await scroller
        .getByText(title, { exact: true })
        .first()
        .boundingBox();
      return { title, y: box ? box.y : Number.POSITIVE_INFINITY };
    })
  );
  return positioned.sort((a, b) => a.y - b.y).map((p) => p.title);
}

// Drag the pinned row containing `fromTitle` to just below the row containing
// `belowTitle`, using manual mouse ops on the drag handle (@dnd-kit MouseSensor).
async function dragPinnedBelow(
  page: Page,
  fromTitle: string,
  belowTitle: string
) {
  const fromRow = page
    .locator('[data-testid^="PinnedSortable-"]')
    .filter({ hasText: fromTitle });
  const belowRow = page
    .locator('[data-testid^="PinnedSortable-"]')
    .filter({ hasText: belowTitle });
  const handle = fromRow.locator('[data-testid^="PinnedDragHandle-"]');

  const handleBox = await handle.boundingBox();
  const belowBox = await belowRow.boundingBox();
  if (!handleBox || !belowBox) {
    throw new Error(
      'could not resolve drag handle / target row bounding boxes'
    );
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = startX;
  const endY = belowBox.y + belowBox.height + 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(endX, endY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1000);
}

async function unpinAndDeleteGroup(page: Page, title: string) {
  try {
    // Make sure we're at Home before searching for the row.
    if (
      !(await page
        .getByTestId('HomeSidebarHeader')
        .isVisible({ timeout: 500 })
        .catch(() => false))
    ) {
      await page
        .getByTestId('HomeNavIcon')
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
    }
    const row = page.getByText(title, { exact: true }).first();
    if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) {
      return;
    }
    await row.click();
    await helpers.openGroupSettings(page);
    if (
      await page
        .getByText('Unpin')
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await page.getByText('Unpin').click();
      await page.getByText('Pin').waitFor({ state: 'visible', timeout: 5000 });
    }
    await helpers.deleteGroup(page, title);
  } catch (error) {
    console.warn(
      `unpinAndDeleteGroup failed for "${title}":`,
      (error as Error).message
    );
  }
}

test('pinned chats can be reordered by drag and the new order persists', async ({
  zodPage,
}) => {
  // Creating + pinning three groups, dragging, then deleting all three serially
  // exceeds the 60s default.
  test.setTimeout(300_000);
  const page = zodPage;
  const created: string[] = [];
  const register = (title: string) => {
    created.push(title);
  };

  try {
    await expect(page.getByText('Home')).toBeVisible();

    // Setup: three uniquely-named groups, pinned in TITLES order so the initial
    // pinned order is [Alpha, Bravo, Charlie] (new pins append).
    for (const title of TITLES) {
      await createNamedGroup(page, title, register);
    }
    for (const title of TITLES) {
      await pinNamedGroup(page, title);
    }

    await expect(page.getByText('Pinned', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    expect(await visibleOrder(page, TITLES)).toEqual([
      'PReorder-Alpha',
      'PReorder-Bravo',
      'PReorder-Charlie',
    ]);

    // Enter sort mode, drag Alpha (top) below Charlie (bottom): [B, C, A].
    await page.getByTestId('PinnedSortToggle').click();
    await page.waitForTimeout(500);
    await dragPinnedBelow(page, 'PReorder-Alpha', 'PReorder-Charlie');

    // Optimistic order should reflect the move before persistence completes.
    expect(await visibleOrder(page, TITLES)).toEqual([
      'PReorder-Bravo',
      'PReorder-Charlie',
      'PReorder-Alpha',
    ]);

    await page.getByTestId('PinnedSortToggle').click(); // "Done"

    // Force a fresh mount: the reordered order must survive a reload (proves it
    // persisted to the backend/cache, not just the optimistic local state).
    await page.reload();
    await page.waitForSelector('text=Home', { state: 'visible' });
    await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Pinned', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    expect(await visibleOrder(page, TITLES)).toEqual([
      'PReorder-Bravo',
      'PReorder-Charlie',
      'PReorder-Alpha',
    ]);
  } finally {
    // Reverse order is irrelevant here (no ordering dependency between deletes),
    // but unpin-then-delete each created group so no pinned fixtures leak.
    for (const title of [...created].reverse()) {
      await unpinAndDeleteGroup(page, title);
    }
  }
});
