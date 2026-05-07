import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { resolveScrollOffset } from './helpers/scrollers';
import { test } from './test-fixtures';

const FILLER_COUNT = 4;
// IMPORTANT: do not put the substrings "Pin"/"Unpin" in any of these titles.
// helpers.toggleChatPin uses getByText('Pin')/getByText('Unpin'), and any row
// or header text containing those substrings on the chat-details screen will
// trigger a Playwright strict-mode violation.
const PIN_TITLE = 'PScroll-Target';
const fillerTitle = (i: number) =>
  `PScroll-Filler-${String(i).padStart(2, '0')}`;
const fillerTitles = Array.from({ length: FILLER_COUNT }, (_, i) =>
  fillerTitle(i)
);

async function createNamedGroup(
  page: Page,
  title: string,
  registerForCleanup: (title: string) => void
) {
  await helpers.createGroup(page);
  await helpers.openGroupCustomization(page);
  await helpers.changeGroupName(page, title);
  // The rename has been saved; the group exists under the unique title even if
  // a later step (back-nav, HomeNavIcon, visibility wait) times out. Register
  // for cleanup immediately so the finally-block sweep can find and delete it.
  registerForCleanup(title);
  // back out of edit-group-info, then back to Home
  await helpers.navigateBack(page);
  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText(title, { exact: true })).toBeVisible({
    timeout: 10000,
  });
}

async function returnToHome(page: Page) {
  // Cleanup may run while the page is mid-flow (e.g. inside group settings,
  // an open sheet, or a modal). Try a few standard exits before giving up; a
  // failed attempt should never throw because we still want subsequent
  // cleanups to run.
  for (let i = 0; i < 4; i++) {
    if (
      await page
        .getByTestId('HomeSidebarHeader')
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      return;
    }
    // Dismiss any open modal/sheet that traps navigation.
    const cancel = page.getByText('Cancel');
    if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) {
      await cancel.click().catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }
    // HomeNavIcon is the most reliable jump-to-Home control.
    const homeIcon = page.getByTestId('HomeNavIcon');
    if (await homeIcon.isVisible({ timeout: 500 }).catch(() => false)) {
      await homeIcon.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    // Last resort: peel back stack frames.
    await helpers.navigateBack(page).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function cleanupNamedGroup(page: Page, title: string) {
  try {
    await returnToHome(page);
    const row = page.getByText(title, { exact: true }).first();
    if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) {
      return;
    }
    await row.click();
    await helpers.openGroupSettings(page);
    // Unpin first if pinned (toggleChatPin's "Unpin" branch is idempotent).
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
    // Cleanup is best-effort. Surface failures without aborting the rest of
    // the cleanup sweep so other titles still get removed.
    console.warn(
      `cleanupNamedGroup failed for "${title}":`,
      (error as Error).message
    );
  }
}

test('home sidebar mounts at the top with the Pinned section visible', async ({
  zodPage,
}) => {
  // Creating multiple groups, navigating, asserting, then cleaning up all of
  // them serially exceeds the 60s default. Bump to 5 minutes.
  test.setTimeout(300_000);
  const page = zodPage;
  const createdTitles: string[] = [];
  const registerForCleanup = (title: string) => {
    createdTitles.push(title);
  };

  try {
    // Smaller viewport keeps the filler count modest while still guaranteeing
    // the sidebar overflows.
    await page.setViewportSize({ width: 1024, height: 480 });

    await expect(page.getByText('Home')).toBeVisible();

    // Setup: uniquely-named filler groups so we can assert on / clean up by
    // exact title without colliding on duplicate "Untitled group" rows.
    for (const title of fillerTitles) {
      await createNamedGroup(page, title, registerForCleanup);
    }

    // Pinned group: create, rename, then pin via group settings.
    await createNamedGroup(page, PIN_TITLE, registerForCleanup);
    await page.getByText(PIN_TITLE, { exact: true }).first().click();
    await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
      timeout: 10000,
    });
    await helpers.openGroupSettings(page);
    // The Group info header must be present before toggleChatPin queries for
    // Pin/Unpin — without this wait, isVisible races against the screen mount
    // and reports false.
    await expect(page.getByText('Group info')).toBeVisible({ timeout: 10000 });
    const pinStatus = await helpers.toggleChatPin(page);
    expect(pinStatus).toBe('pinned');
    await helpers.navigateBack(page);
    await page.getByTestId('HomeNavIcon').click();
    await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
      timeout: 5000,
    });
    // Confirm the pin landed before forcing a fresh mount; otherwise reload may
    // beat the pin-write to the cache and the [Pinned, All] transition we want
    // to assert against won't happen.
    await expect(page.getByText('Pinned', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // Force a fresh Home mount — closest equivalent to the originally reported
    // bug, where the cold render briefly has [All] before pinned hydrates.
    await page.reload();
    await page.waitForSelector('text=Home', { state: 'visible' });
    await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
      timeout: 10000,
    });

    await assertPinnedAboveAllAndAtTop(page);

    // Originally reported repro path: navigate into a group, then back via
    // HomeNavIcon. List should still mount at scrollTop 0 with Pinned above.
    await page.getByText(PIN_TITLE, { exact: true }).first().click();
    await expect(page.getByTestId('ChannelListItem-General')).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId('HomeNavIcon').click();
    await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible({
      timeout: 5000,
    });

    await assertPinnedAboveAllAndAtTop(page);
  } finally {
    // Cleanup every title actually created, in reverse order so PinnedScroll-Pin
    // (the only pinned row) is unpinned before its filler neighbors are
    // touched. cleanupNamedGroup is best-effort and re-routes to Home before
    // each delete, so a mid-test failure can't strand fixtures.
    for (const title of [...createdTitles].reverse()) {
      await cleanupNamedGroup(page, title);
    }
  }
});

async function assertPinnedAboveAllAndAtTop(page: Page) {
  // Wait for the Pinned section to appear before measuring offset.
  await expect(page.getByText('Pinned', { exact: true })).toBeVisible({
    timeout: 10000,
  });

  // Real-offset assertion: the sidebar must be scrollable AND mounted at the
  // top. resolveScrollOffset throws if no scrollable descendant exists, so
  // setup must produce overflow before this point.
  const offset = await resolveScrollOffset(page, 'HomeSidebarChatScroller');
  expect(offset.scrollHeight).toBeGreaterThan(offset.clientHeight);
  expect(offset.scrollTop).toBe(0);

  // Rendered-order assertion: inside the resolved scroller, "Pinned" must
  // precede "All". Comparing bounding-box top edges is robust against any
  // layout container differences and is what the user actually sees.
  const scroller = page.getByTestId('HomeSidebarChatScroller');
  const pinnedHeader = scroller.getByText('Pinned', { exact: true }).first();
  const allHeader = scroller.getByText('All', { exact: true }).first();
  await expect(pinnedHeader).toBeVisible();
  await expect(allHeader).toBeAttached();

  const pinnedBox = await pinnedHeader.boundingBox();
  const allBox = await allHeader.boundingBox();
  expect(pinnedBox).not.toBeNull();
  expect(allBox).not.toBeNull();
  expect(pinnedBox!.y).toBeLessThan(allBox!.y);
}
