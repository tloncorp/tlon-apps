import { describe, expect, it } from 'bun:test';

import { formatActivityTime, formatEvent } from './activity-runtime';

describe('activity runtime formatting', () => {
  const now = Date.parse('2026-09-30T15:00:00Z');

  it('formats unix-ms event timestamps as UTC with a relative age', () => {
    expect(formatActivityTime(now - 20 * 1000, now)).toBe(
      '2026-09-30T14:59:40Z (just now)'
    );
    expect(formatActivityTime(now - 5 * 60 * 1000, now)).toBe(
      '2026-09-30T14:55:00Z (5m ago)'
    );
    expect(formatActivityTime(now - 3 * 60 * 60 * 1000, now)).toBe(
      '2026-09-30T12:00:00Z (3h ago)'
    );
    expect(formatActivityTime(now - 9 * 24 * 60 * 60 * 1000, now)).toBe(
      '2026-09-21T15:00:00Z (9d ago)'
    );
  });

  it('prints a real time for events, not unknown date', () => {
    const formatted = formatEvent(
      {
        id: 'e1',
        bucketId: 'mentions',
        sourceId: 's1',
        type: 'post',
        timestamp: now - 2 * 60 * 60 * 1000,
        authorId: '~zod',
        channelId: 'chat/~zod/test',
      },
      now
    );

    expect(formatted).toContain('Time: 2026-09-30T13:00:00Z (2h ago)');
    expect(formatted).not.toContain('unknown');
  });
});
