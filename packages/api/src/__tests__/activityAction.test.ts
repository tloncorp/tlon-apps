import { afterEach, describe, expect, test } from 'vitest';

import {
  activityAction,
  sourceIdToSource,
  toClientUnreads,
} from '../client/activityApi';
import {
  setActivitySupportsNotes,
  setActivitySupportsReactions,
} from '../client/urbit';
import type { ActivityAction, ActivitySummary } from '../urbit';

const volume = {
  post: { unreads: true, notify: true },
  react: { unreads: false, notify: true },
  'dm-react': { unreads: false, notify: true },
};

const adjustAction: ActivityAction = {
  adjust: { source: { base: null }, volume },
};

afterEach(() => {
  setActivitySupportsReactions(false);
  setActivitySupportsNotes(false);
});

describe('activityAction mark gating', () => {
  test('uses the v9 mark and keeps react keys when supported', () => {
    setActivitySupportsReactions(true);
    const action = activityAction(adjustAction);
    expect(action.mark).toBe('activity-action-1');
    const sent = action.json as typeof adjustAction;
    expect(sent.adjust.volume).toHaveProperty('react');
    expect(sent.adjust.volume).toHaveProperty('dm-react');
  });

  test('uses the v8 mark and strips react keys when unsupported', () => {
    setActivitySupportsReactions(false);
    const action = activityAction(adjustAction);
    expect(action.mark).toBe('activity-action');
    const sent = action.json as typeof adjustAction;
    expect(sent.adjust.volume).not.toHaveProperty('react');
    expect(sent.adjust.volume).not.toHaveProperty('dm-react');
    // non-react keys are preserved
    expect(sent.adjust.volume).toHaveProperty('post');
    // does not mutate the caller's action
    expect(adjustAction.adjust.volume).toHaveProperty('react');
  });

  test('passes non-adjust actions through unchanged on the v8 mark', () => {
    setActivitySupportsReactions(false);
    const action = activityAction({ 'clear-group-invites': null });
    expect(action.mark).toBe('activity-action');
    expect(action.json).toEqual({ 'clear-group-invites': null });
  });

  test('uses the v10 mark when the backend supports notes', () => {
    setActivitySupportsNotes(true);
    const action = activityAction(adjustAction);
    expect(action.mark).toBe('activity-action-2');
    expect(action.json).toEqual(adjustAction);
  });
});

const summary = (count: number): ActivitySummary => ({
  recency: 1721700000000,
  count,
  'notify-count': 0,
  notify: false,
  unread: null,
});

describe('notes activity sources', () => {
  test('parses notebook source ids onto the notes channel', () => {
    expect(sourceIdToSource('notebook/~zod/journal')).toEqual({
      type: 'channel',
      channelId: 'notes/~zod/journal',
    });
  });

  test('parses note source ids, stripping @ud dot grouping', () => {
    expect(sourceIdToSource('note/~zod/journal/42')).toEqual({
      type: 'note',
      channelId: 'notes/~zod/journal',
      noteId: '42',
    });
    expect(sourceIdToSource('note/~zod/journal/12.345')).toEqual({
      type: 'note',
      channelId: 'notes/~zod/journal',
      noteId: '12345',
    });
  });

  test('converts notebook and note summaries onto channel and thread unreads', () => {
    const unreads = toClientUnreads({
      'notebook/~zod/journal': summary(3),
      'note/~zod/journal/42': summary(2),
    });

    expect(unreads.channelUnreads).toEqual([
      expect.objectContaining({
        channelId: 'notes/~zod/journal',
        type: 'channel',
        count: 3,
      }),
    ]);
    expect(unreads.threadActivity).toEqual([
      expect.objectContaining({
        channelId: 'notes/~zod/journal',
        // raw decimal, not the dotted @ud canonical form
        threadId: '42',
        count: 2,
        firstUnreadPostId: null,
      }),
    ]);
  });

  test('strips dot grouping from large wire note ids', () => {
    const unreads = toClientUnreads({
      'note/~zod/journal/12.345': summary(1),
    });
    expect(unreads.threadActivity[0].threadId).toBe('12345');
  });
});
