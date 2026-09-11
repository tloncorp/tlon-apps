import type * as db from '@tloncorp/shared/db';
import { expect, test } from 'vitest';

import {
  getChatNotesActivitySignature,
  getChatTimestampsSignature,
} from './useResolvedChats';

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

test('notes activity signature changes when a title arrives at the same recency', () => {
  const before = makeGroupChat(200);
  const after = makeGroupChat(200);
  if (before.type !== 'group' || after.type !== 'group') {
    throw new Error('expected group chats');
  }
  before.notesActivity = {
    channelId: 'notes/~zod/journal',
    notebookTitle: 'Journal',
    noteId: null,
    noteTitle: null,
    authorId: null,
    isNew: true,
    timestamp: 200,
  };
  after.notesActivity = {
    ...before.notesActivity,
    noteId: '42',
    noteTitle: 'Weekly plan',
  };

  expect(getChatNotesActivitySignature([after])).not.toBe(
    getChatNotesActivitySignature([before])
  );
  expect(getChatTimestampsSignature([after])).toBe(
    getChatTimestampsSignature([before])
  );
});
