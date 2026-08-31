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
} = {}): Extract<db.Chat, { type: 'group' }> {
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
          currentUserIsMember: true,
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

  test('keeps the post presentation for pinned groups', () => {
    const chat = makeGroupChat();
    chat.pin = { itemId: chat.id } as db.Pin;

    expect(getGroupRecencyOverride(chat)).toBeNull();
  });

  test('ignores stale activity from a left Notes channel', () => {
    const chat = makeGroupChat();
    chat.group.channels![0].currentUserIsMember = false;

    expect(getGroupRecencyOverride(chat)).toBeNull();
  });
});
