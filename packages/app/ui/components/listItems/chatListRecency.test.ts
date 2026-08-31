import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { getGroupRecencyOverride } from './chatListRecency';

function makeGroupChat({
  lastPostAt = 100,
  notesActivityAt = 200,
  timestamp = Math.max(lastPostAt, notesActivityAt),
  isPending = false,
}: {
  lastPostAt?: number;
  notesActivityAt?: number;
  timestamp?: number;
  isPending?: boolean;
} = {}): db.Chat {
  return {
    id: '~zod/test-group',
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp,
    isPending,
    unreadCount: 0,
    group: {
      id: '~zod/test-group',
      lastPostAt,
      channels: [
        {
          id: 'notes/~zod/test-notebook',
          type: 'notes',
          unread: {
            channelId: 'notes/~zod/test-notebook',
            updatedAt: notesActivityAt,
          },
        },
      ],
    } as db.Group,
  };
}

describe('getGroupRecencyOverride', () => {
  test('describes Notes activity when it supplies the group sort timestamp', () => {
    expect(getGroupRecencyOverride(makeGroupChat())).toEqual({
      label: 'Notes activity',
      timestamp: 200,
    });
  });

  test('keeps the post presentation when the latest post is newer', () => {
    expect(
      getGroupRecencyOverride(
        makeGroupChat({ lastPostAt: 300, notesActivityAt: 200 })
      )
    ).toBeNull();
  });

  test('does not relabel pending groups or unrelated timestamps', () => {
    expect(
      getGroupRecencyOverride(makeGroupChat({ isPending: true }))
    ).toBeNull();
    expect(
      getGroupRecencyOverride(makeGroupChat({ timestamp: 300 }))
    ).toBeNull();
  });
});
