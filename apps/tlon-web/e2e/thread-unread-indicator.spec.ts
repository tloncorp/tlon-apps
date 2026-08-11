import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// Reproduces TLON-6304: a thread reply that arrives while the channel is
// closed leaves no unread dot on the parent post when the channel is reopened.
//
// Three conditions all have to hold for the bug to appear, and getting any of
// them wrong yields a test that passes on unfixed code:
//
//  1. ~ten must have opened the channel BEFORE the reply. On a channel that has
//     never been opened there is no local thread-unread row, so the mount-time
//     `syncChannelThreadUnreads` inserts one — that write fires a sqlite trigger
//     which invalidates the per-post query and repaints the dot even without the
//     fix. The bug needs a row already present so the mount-time sync dedupes it
//     and skips the write.
//  2. The reply must land while the channel is closed, so the live write has no
//     mounted post query to invalidate.
//  3. Reopening must happen more than PER_POST_GC_TIME_MS (30s) after leaving.
//     Within that window the still-cached ['post', id] entry is merely marked
//     stale and refetches on remount, painting the dot on unfixed code. After
//     the entry is garbage-collected, the remount seeds a fresh query from the
//     post list (which never joins threadUnreads) under staleTime: Infinity,
//     so nothing ever fetches the unread — that is the failure being fixed.
const PER_POST_GC_MS = 30_000;

test('should show a thread unread indicator for a reply received while the channel was closed', async ({
  zodSetup,
  tenSetup,
}) => {
  test.setTimeout(180000); // cross-ship group ops plus the 30s cache-expiry wait

  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

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

  await helpers.sendMessage(zodPage, 'Closed channel thread parent');

  await helpers.acceptGroupInvite(tenPage, groupName);

  // Loud is load-bearing: at the default volume a reply does not notify, and a
  // channel's rollup counts only its threads' notify-counts, so the reply would
  // not move the badge this test waits on below.
  await helpers.openGroupSettings(tenPage);
  await helpers.setGroupNotifications(tenPage, 'All group activity');
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Condition 1: ~ten opens the channel once, before any reply exists, so the
  // parent post and its thread-unread state are already synced locally.
  await tenPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
  await helpers.navigateToChannel(tenPage, 'General');
  await expect(
    tenPage.getByTestId('Post').getByText('Closed channel thread parent', {
      exact: true,
    })
  ).toBeVisible({ timeout: 15000 });

  // Condition 2: ~ten leaves the channel; everything below happens while it is
  // closed. This is also when the per-post query entries start aging out.
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible();
  const leftChannelAt = Date.now();

  await helpers.startThread(zodPage, 'Closed channel thread parent');
  await helpers.sendThreadReply(zodPage, 'Reply while ten has channel closed');

  // The badge going 1 -> 2 proves the reply's unread reached ~ten while the
  // channel was closed: the parent contributes the first count, and only the
  // notifying thread reply can contribute the second.
  await helpers.verifyChatUnreadCount(
    tenPage,
    'Untitled group',
    2,
    false,
    true
  );

  // Condition 3: wait out the per-post cache TTL. Not an arbitrary sleep — it
  // is the exact window that decides whether the remount refetches a stale
  // cached entry or seeds a fresh one that never fetches.
  const elapsed = Date.now() - leftChannelAt;
  if (elapsed < PER_POST_GC_MS + 2000) {
    await tenPage.waitForTimeout(PER_POST_GC_MS + 2000 - elapsed);
  }

  await tenPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
  await helpers.navigateToChannel(tenPage, 'General');

  const parentMessage = tenPage
    .getByTestId('Post')
    .filter({ hasText: 'Closed channel thread parent' });
  await expect(parentMessage).toBeVisible({ timeout: 10000 });
  await expect(parentMessage.getByTestId('ThreadUnreadDot')).toBeVisible({
    timeout: 15000,
  });
});
