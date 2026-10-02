import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { getGroupRecencyOverride } from './chatListRecency';

function makeGroupChat({
  lastPostAt = 100,
  notesActivityAt = 200,
  timestamp = Math.max(lastPostAt, notesActivityAt),
  isPending = false,
  isNew = true,
  noteTitle = 'Weekly plan',
}: {
  lastPostAt?: number;
  notesActivityAt?: number;
  timestamp?: number;
  isPending?: boolean;
  isNew?: boolean;
  noteTitle?: string | null;
} = {}): Extract<db.Chat, { type: 'group' }> {
  return {
    id: '~zod/test-group',
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp,
    isPending,
    unreadCount: 0,
    notesActivity: {
      channelId: 'notes/~zod/test-notebook',
      notebookTitle: 'Journal',
      noteId: '42',
      noteTitle,
      authorId: '~zod',
      isNew,
      timestamp: notesActivityAt,
    },
    group: {
      id: '~zod/test-group',
      lastPostAt,
    } as db.Group,
  };
}

describe('getGroupRecencyOverride', () => {
  test('describes the note and notebook when Notes supplies recency', () => {
    expect(getGroupRecencyOverride(makeGroupChat())).toEqual({
      label: 'New note “Weekly plan” in Journal',
      timestamp: 200,
      channelId: 'notes/~zod/test-notebook',
    });
  });

  test('distinguishes edited notes and title-less fallbacks', () => {
    expect(
      getGroupRecencyOverride(makeGroupChat({ isNew: false }))?.label
    ).toBe('Note “Weekly plan” edited in Journal');
    expect(
      getGroupRecencyOverride(makeGroupChat({ noteTitle: null }))?.label
    ).toBe('New note in Journal');
  });

  test('keeps the post presentation when the latest post is newer', () => {
    expect(
      getGroupRecencyOverride(
        makeGroupChat({ lastPostAt: 300, notesActivityAt: 200 })
      )
    ).toBeNull();
  });

  test('does not relabel pending groups', () => {
    expect(
      getGroupRecencyOverride(makeGroupChat({ isPending: true }))
    ).toBeNull();
  });

  test('updates the presentation for pinned groups without changing ordering', () => {
    const chat = makeGroupChat();
    chat.pin = { itemId: chat.id } as db.Pin;

    expect(getGroupRecencyOverride(chat)?.label).toBe(
      'New note “Weekly plan” in Journal'
    );
  });
});
