import { describe, expect, test, vi } from 'vitest';

import { getBotReplyFeedback } from './queries';
import type { QueryCtx } from './query';

describe('getBotReplyFeedback', () => {
  test('returns null when no feedback exists', async () => {
    const findFirst = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      db: {
        query: {
          botReplyFeedback: { findFirst },
        },
      },
      pendingEffects: new Set(),
      meta: getBotReplyFeedback.meta,
    } as unknown as QueryCtx;

    await expect(
      getBotReplyFeedback('missing-message', ctx)
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledOnce();
  });
});
