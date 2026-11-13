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

const HIDDEN = { listShown: false };
const SHOWN = { listShown: true };

describe('nextChannelUnreadSnapshot', () => {
  test('takes the first snapshot', () => {
    const fresh = snapshot('a', 3);
    expect(nextChannelUnreadSnapshot(null, fresh, HIDDEN)).toBe(fresh);
  });

  test('keeps the opening snapshot after the channel was marked read', () => {
    const opened = snapshot('a', 3);
    expect(nextChannelUnreadSnapshot(opened, snapshot('a', 0), HIDDEN)).toBe(
      opened
    );
  });

  test('keeps the opening snapshot when more arrived while away', () => {
    const opened = snapshot('a', 3);
    expect(
      nextChannelUnreadSnapshot(opened, snapshot('a', 5, 'post-9'), HIDDEN)
    ).toBe(opened);
  });

  test('keeps a read channel read', () => {
    const opened = snapshot('a', 0);
    expect(nextChannelUnreadSnapshot(opened, snapshot('a', 0), HIDDEN)).toBe(
      opened
    );
  });

  test('anchors on unreads that appear before a read channel is shown', () => {
    const fresh = snapshot('a', 2, 'post-9');
    expect(nextChannelUnreadSnapshot(snapshot('a', 0), fresh, HIDDEN)).toBe(
      fresh
    );
  });

  test('keeps a shown channel where it was when unreads arrived while away', () => {
    const opened = snapshot('a', 0);
    expect(
      nextChannelUnreadSnapshot(opened, snapshot('a', 8, 'post-9'), SHOWN)
    ).toBe(opened);
  });

  test('takes a fresh snapshot for another channel', () => {
    const fresh = snapshot('b', 0);
    expect(nextChannelUnreadSnapshot(snapshot('a', 3), fresh, SHOWN)).toBe(
      fresh
    );
  });
});
