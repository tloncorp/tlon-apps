import { describe, expect, it } from 'vitest';

import { readAttemptStamp } from './unreadActivity';

const unread = { updatedAt: 1000 };
const threads = [{ updatedAt: 900 }, { updatedAt: 1100 }];

describe('readAttemptStamp', () => {
  it('returns null without an unread row', () => {
    expect(readAttemptStamp(null, null)).toBeNull();
    expect(readAttemptStamp(undefined, threads)).toBeNull();
  });

  it('is stable for the same unread row', () => {
    expect(readAttemptStamp({ ...unread }, null)).toBe(
      readAttemptStamp({ ...unread }, null)
    );
    expect(readAttemptStamp({ ...unread }, [...threads])).toBe(
      readAttemptStamp({ ...unread }, [...threads])
    );
  });

  it('changes when the unread row is updated', () => {
    expect(readAttemptStamp({ updatedAt: 2000 }, null)).not.toBe(
      readAttemptStamp(unread, null)
    );
  });

  it('changes when a thread unread is updated, if threads are covered', () => {
    const updatedThreads = [{ updatedAt: 900 }, { updatedAt: 1200 }];
    expect(readAttemptStamp(unread, updatedThreads)).not.toBe(
      readAttemptStamp(unread, threads)
    );
  });

  it('changes when a thread unread is added, if threads are covered', () => {
    expect(
      readAttemptStamp(unread, [...threads, { updatedAt: 1100 }])
    ).not.toBe(readAttemptStamp(unread, threads));
  });

  it('ignores thread unreads when threads are not covered', () => {
    expect(readAttemptStamp(unread, null)).toBe(readAttemptStamp(unread, null));
    expect(readAttemptStamp(unread, null)).toBe(
      readAttemptStamp({ updatedAt: 1000 }, null)
    );
  });
});
