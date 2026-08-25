import * as db from '@tloncorp/shared/db';
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
});
