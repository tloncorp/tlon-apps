import { describe, expect, test } from 'vitest';

import type { ThreadUnreadState } from '../db/types';
import { resolveThreadUnread } from './threadUnreads';

function unread(threadId: string, count: number): ThreadUnreadState {
  return {
    channelId: 'chat/~zod/test',
    threadId,
    count,
    notify: false,
    updatedAt: 0,
    firstUnreadPostId: null,
    firstUnreadPostReceivedAt: null,
  } as ThreadUnreadState;
}

describe('resolveThreadUnread', () => {
  test('uses the channel map entry when one exists', () => {
    const map = new Map([['post-1', unread('post-1', 3)]]);
    expect(resolveThreadUnread(map, { id: 'post-1' })?.count).toBe(3);
  });

  test('treats a present map as authoritative, ignoring a stale post relation', () => {
    // The live query excludes read threads, so a thread the user just read
    // drops out of the map while the post object may still carry the old row.
    // Falling back here would light the dot again.
    const map = new Map<string, ThreadUnreadState>();
    const resolved = resolveThreadUnread(map, {
      id: 'post-1',
      threadUnread: unread('post-1', 5),
    });
    expect(resolved).toBeNull();
  });

  test('falls back to the post relation when no map is in scope', () => {
    const resolved = resolveThreadUnread(null, {
      id: 'post-1',
      threadUnread: unread('post-1', 2),
    });
    expect(resolved?.count).toBe(2);
  });

  test('returns null when there is no map and no post relation', () => {
    expect(resolveThreadUnread(null, { id: 'post-1' })).toBeNull();
  });
});
