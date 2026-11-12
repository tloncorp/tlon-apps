import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  type ChannelUnreadSnapshot,
  nextChannelUnreadSnapshot,
} from './channelUnreadSnapshot';

function snapshot(
  channelId: string,
  count: number,
  firstUnreadPostId = 'post-1'
): ChannelUnreadSnapshot {
  return {
    channelId,
    unread:
      count > 0
        ? ({
            channelId,
            countWithoutThreads: count,
            firstUnreadPostId,
          } as db.ChannelUnread)
        : null,
  };
}

describe('nextChannelUnreadSnapshot', () => {
  test('takes the first snapshot', () => {
    const fresh = snapshot('a', 3);
    expect(nextChannelUnreadSnapshot(null, fresh)).toBe(fresh);
  });

  test('keeps the opening snapshot after the channel was marked read', () => {
    const opened = snapshot('a', 3);
    expect(nextChannelUnreadSnapshot(opened, snapshot('a', 0))).toBe(opened);
  });

  test('keeps the opening snapshot when more arrived while away', () => {
    const opened = snapshot('a', 3);
    expect(nextChannelUnreadSnapshot(opened, snapshot('a', 5, 'post-9'))).toBe(
      opened
    );
  });

  test('keeps a read channel read', () => {
    const opened = snapshot('a', 0);
    expect(nextChannelUnreadSnapshot(opened, snapshot('a', 0))).toBe(opened);
  });

  test('anchors on unreads that arrived while a read channel was away', () => {
    const fresh = snapshot('a', 2, 'post-9');
    expect(nextChannelUnreadSnapshot(snapshot('a', 0), fresh)).toBe(fresh);
  });

  test('takes a fresh snapshot for another channel', () => {
    const fresh = snapshot('b', 0);
    expect(nextChannelUnreadSnapshot(snapshot('a', 3), fresh)).toBe(fresh);
  });
});
