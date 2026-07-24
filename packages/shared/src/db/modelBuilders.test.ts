import { expect, test, vi } from 'vitest';

import { buildChannel, buildPost } from './modelBuilders';

test('builds distinct optimistic post IDs within the same millisecond', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  const channel = buildChannel({ id: 'chat/~zod/test', type: 'chat' });

  const first = buildPost({
    authorId: '~zod',
    channel,
    sequenceNum: null,
    content: [],
  });
  const second = buildPost({
    authorId: '~zod',
    channel,
    sequenceNum: null,
    content: [],
  });

  expect(second.sentAt).toBeGreaterThan(first.sentAt);
  expect(second.id).not.toBe(first.id);

  vi.restoreAllMocks();
});
