import type * as db from '@tloncorp/shared/db';
import { expect, test } from 'vitest';

import { getChatTimestampsSignature } from './useResolvedChats';

function makeGroupChat(timestamp: number): db.Chat {
  return {
    id: '~zod/test-group',
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp,
    isPending: false,
    unreadCount: 0,
    group: {
      id: '~zod/test-group',
      title: 'Test group',
      lastPostAt: 100,
    } as db.Group,
  };
}

test('chat signature changes when recency advances without reordering', () => {
  const before = [makeGroupChat(100)];
  const after = [makeGroupChat(200)];

  expect(getChatTimestampsSignature(after)).not.toBe(
    getChatTimestampsSignature(before)
  );
});
