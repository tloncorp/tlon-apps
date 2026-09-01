import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import { canMarkChannelRead } from './chatOptionsUtils';

function channelWithUnreadCount(
  id: string,
  count: number | undefined
): db.Channel {
  return {
    id,
    unread: count === undefined ? undefined : { count },
  } as db.Channel;
}

describe('canMarkChannelRead', () => {
  test('allows notebook channels with unread activity', () => {
    expect(
      canMarkChannelRead(channelWithUnreadCount('notes/~zod/work', 2))
    ).toBe(true);
  });

  test('hides the action for channels explicitly known to be read', () => {
    expect(
      canMarkChannelRead(channelWithUnreadCount('notes/~zod/work', 0))
    ).toBe(false);
  });

  test('preserves the action while unread state is unavailable', () => {
    expect(
      canMarkChannelRead(channelWithUnreadCount('notes/~zod/work', undefined))
    ).toBe(true);
  });
});
