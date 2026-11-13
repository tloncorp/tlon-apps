import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  type PostWithNeighbors,
  describeWindowChange,
  getPostRowType,
} from './shared';

function rows(...ids: string[]): PostWithNeighbors[] {
  return ids.map((id) => ({
    post: { id, type: 'chat' } as db.Post,
    previous: null,
    next: null,
  }));
}

describe('describeWindowChange', () => {
  test('a page landing above changes the top only', () => {
    expect(
      describeWindowChange(rows('c', 'd'), rows('a', 'b', 'c', 'd'))
    ).toEqual({ changesTop: true, changesEnd: false });
  });

  test('a new message changes the end only', () => {
    expect(describeWindowChange(rows('c', 'd'), rows('c', 'd', 'e'))).toEqual({
      changesTop: false,
      changesEnd: true,
    });
  });

  test('a cached page replaced by a fresh one changes both', () => {
    expect(
      describeWindowChange(rows('a', 'b', 'c'), rows('b', 'c', 'd'))
    ).toEqual({ changesTop: true, changesEnd: true });
  });

  test('the first rows and unchanged windows change nothing', () => {
    const none = { changesTop: false, changesEnd: false };
    expect(describeWindowChange([], rows('a', 'b'))).toEqual(none);
    expect(describeWindowChange(rows('a', 'b'), [])).toEqual(none);
    expect(describeWindowChange(rows('a', 'b'), rows('a', 'b'))).toEqual(none);
  });
});

describe('getPostRowType', () => {
  let next = 0;
  function row(post: Partial<db.Post>): PostWithNeighbors {
    next += 1;
    return {
      post: {
        id: `x${next}`,
        type: 'chat',
        authorId: '~zod',
        sentAt: next,
        ...post,
      } as db.Post,
      previous: null,
      next: null,
    };
  }

  test('groups rows by text length and what they contain', () => {
    expect(getPostRowType(row({ textContent: 'ok' }))).not.toBe(
      getPostRowType(row({ textContent: 'x'.repeat(500) }))
    );
    expect(getPostRowType(row({ textContent: 'ok', hasImage: true }))).not.toBe(
      getPostRowType(row({ textContent: 'ok' }))
    );
    expect(getPostRowType(row({ textContent: 'ok' }))).toBe(
      getPostRowType(row({ textContent: 'fine' }))
    );
  });

  test('a row keeps its first type when its post is updated', () => {
    const first = row({ textContent: 'ok' });
    const updated = {
      ...first,
      post: { ...first.post, textContent: 'x'.repeat(500), hasImage: true },
    };
    expect(getPostRowType(updated)).toBe(getPostRowType(first));
  });

  test('ignores the neighbours, so a row keeps its type as posts arrive', () => {
    const post = {
      id: 'y',
      type: 'chat',
      authorId: '~ten',
      sentAt: 999,
      textContent: 'ok',
    } as db.Post;
    const other = { id: 'y', type: 'chat', authorId: '~zod' } as db.Post;
    expect(getPostRowType({ post, previous: null, next: null })).toBe(
      getPostRowType({ post, previous: other, next: null })
    );
  });
});
