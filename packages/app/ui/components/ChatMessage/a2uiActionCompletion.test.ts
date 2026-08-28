import * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import { getA2UIActionCompletions } from './a2uiActionCompletion';

const ownerId = '~owner';

function post(overrides: Partial<db.Post>): db.Post {
  return {
    id: overrides.id ?? 'post',
    authorId: overrides.authorId ?? '~agent',
    ...overrides,
  } as db.Post;
}

describe('getA2UIActionCompletions', () => {
  it('keeps only the nearest live owner text in each suffix', () => {
    const posts = [
      post({ id: 'surface' }),
      post({
        id: 'failed-choice',
        authorId: ownerId,
        textContent: 'Failed',
        deliveryStatus: 'failed',
      }),
      post({ id: 'choice', authorId: ownerId, textContent: 'Research' }),
      post({ id: 'follow-up' }),
      post({ id: 'topics', authorId: ownerId, textContent: 'Mycology' }),
    ];
    expect(getA2UIActionCompletions(posts, ownerId)).toEqual([
      { sentMessageText: 'Research' },
      { sentMessageText: 'Research' },
      { sentMessageText: 'Mycology' },
      { sentMessageText: 'Mycology' },
      { sentMessageText: undefined },
    ]);
  });

  it('does not use selection-aware replies as legacy positional completions', () => {
    const posts = [
      post({ id: 'older-surface' }),
      post({ id: 'newer-surface' }),
      post({
        id: 'selection-reply',
        authorId: ownerId,
        textContent: 'Yes',
        blob: appendToPostBlob(undefined, {
          type: 'tlon-a2ui-selection',
          version: 1,
          surfaceId: 'newer',
          componentId: 'answer',
          values: ['yes'],
        }),
      }),
    ];

    expect(getA2UIActionCompletions(posts, ownerId)).toEqual([
      { sentMessageText: undefined },
      { sentMessageText: undefined },
      { sentMessageText: undefined },
    ]);
  });

  it('handles the newest-first order used by bottom-anchored chats', () => {
    const posts = [
      post({ id: 'topics', authorId: ownerId, textContent: 'Mycology' }),
      post({ id: 'follow-up' }),
      post({ id: 'choice', authorId: ownerId, textContent: 'Research' }),
      post({ id: 'surface' }),
    ];

    expect(getA2UIActionCompletions(posts, ownerId, true)).toEqual([
      { sentMessageText: undefined },
      { sentMessageText: 'Mycology' },
      { sentMessageText: 'Mycology' },
      { sentMessageText: 'Research' },
    ]);
  });
});
