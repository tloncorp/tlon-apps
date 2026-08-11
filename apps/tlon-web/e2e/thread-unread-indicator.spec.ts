import { type Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Reproduces TLON-6304: a thread reply that arrives while the channel is
// closed leaves no unread dot on the parent post when the channel is reopened.
//
// Three conditions all have to hold for the bug to appear, and getting any of
// them wrong yields a test that passes on unfixed code:
//
//  1. ~ten must open the channel BEFORE the reply exists, to establish the
//     parent post's ['post', id] query and start its cache lifecycle. (Opening
//     early does not by itself create a thread-unread row —
//     `syncChannelThreadUnreads` only inserts summaries the backend returns —
//     but on a channel opened for the first time *after* the reply, that
//     mount-time sync inserts the row, and that write fires a sqlite trigger
//     which repaints the dot even without the fix.)
//  2. The reply must land while the channel is closed, so the write has no
//     mounted post query to invalidate.
//  3. Reopening must happen more than PER_POST_GC_TIME_MS (30s) after leaving.
//     Within that window the still-cached ['post', id] entry is merely marked
//     stale and refetches on remount, painting the dot on unfixed code. After
//     the entry is garbage-collected, the remount seeds a fresh query from the
//     post list (which never joins threadUnreads) under staleTime: Infinity,
//     so nothing ever fetches the unread — that is the failure being fixed.
//
// The barrier between (2) and (3) has to prove the unread row actually reached
// ~ten's local db while the channel was closed; if it lands after reopening,
// the sqlite trigger fires against a mounted query and unfixed code passes. No
// user-facing signal works here: channel/group rollups count only notifying
// thread replies, home previews exclude replies, and the bell and activity
// feed both require shouldNotify. So we poll the receiving client's db
// directly. The read is read-only, so it fires no trigger and touches no
// query cache. Note the dot itself needs no special volume — %reply defaults
// to [unreads=& notify=|], and notify only selects the dot's color.
const PER_POST_GC_MS = 30_000;
const GC_HEADROOM_MS = 5_000;

async function getLocalThreadUnreadCount(
  page: Page,
  parentText: string
): Promise<number> {
  return page.evaluate(async (text) => {
    const db = (globalThis as any).__db;
    if (!db) {
      throw new Error('E2E database handle is unavailable');
    }

    const posts = (await db.query.posts.findMany({
      columns: { id: true, parentId: true, textContent: true },
    })) as Array<{
      id: string;
      parentId: string | null;
      textContent: string | null;
    }>;

    const parent = posts.find(
      (post) => post.parentId === null && post.textContent === text
    );
    if (!parent) return 0;

    const threadUnreads = (await db.query.threadUnreads.findMany({
      columns: { threadId: true, count: true },
    })) as Array<{ threadId: string | null; count: number | null }>;

    return (
      threadUnreads.find((unread) => unread.threadId === parent.id)?.count ?? 0
    );
  }, parentText);
}

test('should show a thread unread indicator for a reply received while the channel was closed', async ({
  zodSetup,
  tenSetup,
}) => {
  test.setTimeout(180_000);

  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;
  const parentText = 'Closed channel thread parent';
  const replyText = 'Reply while ten has channel closed';

  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(
      zodPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 5000 });
    await zodPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  await helpers.sendMessage(zodPage, parentText);
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Condition 1: mount the parent post's ['post', id] query before the reply
  // exists.
  await tenPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
  await helpers.navigateToChannel(tenPage, 'General');
  await expect(
    tenPage.getByTestId('Post').getByText(parentText, { exact: true })
  ).toBeVisible({ timeout: 15_000 });

  // Condition 2: unmount that query before the reply arrives.
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible();

  await helpers.startThread(zodPage, parentText);
  await helpers.sendThreadReply(zodPage, replyText);

  // Prove ~ten persisted the thread unread while the channel was closed.
  await expect
    .poll(() => getLocalThreadUnreadCount(tenPage, parentText), {
      message: 'waiting for ten to persist the thread unread',
      timeout: 45_000,
      intervals: [250, 500, 1000],
    })
    .toBeGreaterThan(0);

  // Condition 3: ~ten left before the row arrived, so waiting out the full
  // per-post GC interval here guarantees the cached query entry is gone.
  await tenPage.waitForTimeout(PER_POST_GC_MS + GC_HEADROOM_MS);

  await tenPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
  await helpers.navigateToChannel(tenPage, 'General');

  const parentMessage = tenPage
    .getByTestId('Post')
    .filter({ hasText: parentText });

  await expect(parentMessage).toBeVisible({ timeout: 10_000 });
  await expect(parentMessage.getByTestId('ThreadUnreadDot')).toBeVisible({
    timeout: 15_000,
  });
});
