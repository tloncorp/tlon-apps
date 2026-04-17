import { describe, expect, test, vi } from 'vitest';

import {
  conversationIdToPresenceContext,
  getPresenceContextIdFromKey,
  groupIdToPresenceContext,
  subscribeToPresenceUpdates,
  toPresenceEvent,
  toPresenceStatuses,
} from '../client/presenceApi';
import { BadResponseError, scry, subscribe } from '../client/urbit';
import type * as ub from '../urbit';

vi.mock('../client/urbit', async () => {
  const actual =
    await vi.importActual<typeof import('../client/urbit')>('../client/urbit');

  return {
    ...actual,
    scry: vi.fn(),
    subscribe: vi.fn(),
  };
});

const FIRST_SINCE = new Date('2026-03-25T12:00:00.000Z').getTime();
const SECOND_SINCE = new Date('2026-03-25T12:00:30.000Z').getTime();

describe('presenceApi', () => {
  test('builds DM and channel presence contexts from conversation ids', () => {
    expect(conversationIdToPresenceContext('~nec')).toBe('/dm/~nec');
    expect(conversationIdToPresenceContext('chat/~bus/general')).toBe(
      '/channel/chat/~bus/general'
    );
  });

  test('builds group presence contexts from group ids', () => {
    expect(groupIdToPresenceContext('~bus/community')).toBe(
      '/group/~bus/community'
    );
  });

  test('extracts context ids from presence keys', () => {
    expect(
      getPresenceContextIdFromKey({
        context: '/dm/~nec',
        ship: '~nec',
        topic: 'computing',
      })
    ).toBe('~nec');

    expect(
      getPresenceContextIdFromKey({
        context: '/channel/chat/~bus/general',
        ship: '~nec',
        topic: 'typing',
      })
    ).toBe('chat/~bus/general');

    expect(
      getPresenceContextIdFromKey({
        context: '/group/~bus/community',
        ship: '~nec',
        topic: 'other',
      })
    ).toBe('~bus/community');
  });

  test('flattens presence init state into normalized statuses', () => {
    const places: ub.PresencePlaces = {
      '/dm/~nec': {
        computing: {
          '~nec': {
            timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
            display: { icon: null, text: 'Thinking...', blob: null },
          },
        },
      },
      '/channel/chat/~bus/general': {
        typing: {
          '~marzod': {
            timing: { since: '~2026.3.25..12.00.30', timeout: '~s30' },
            display: { icon: null, text: 'Typing...', blob: null },
          },
        },
      },
    };

    expect(toPresenceStatuses(places)).toStrictEqual([
      {
        key: {
          context: '/dm/~nec',
          ship: '~nec',
          topic: 'computing',
        },
        timing: { since: FIRST_SINCE, timeout: '~m1' },
        display: { icon: null, text: 'Thinking...', blob: null },
        contextId: '~nec',
      },
      {
        key: {
          context: '/channel/chat/~bus/general',
          ship: '~marzod',
          topic: 'typing',
        },
        timing: { since: SECOND_SINCE, timeout: '~s30' },
        display: { icon: null, text: 'Typing...', blob: null },
        contextId: 'chat/~bus/general',
      },
    ]);
  });

  test('maps presence response events into normalized client events', () => {
    expect(
      toPresenceEvent({
        here: {
          key: {
            context: '/dm/~nec',
            ship: '~nec',
            topic: 'computing',
          },
          timing: { since: '~2026.3.25..12.00.00', timeout: '~m1' },
          display: { icon: null, text: 'Thinking...', blob: null },
        },
      })
    ).toStrictEqual({
      type: 'set',
      state: {
        key: {
          context: '/dm/~nec',
          ship: '~nec',
          topic: 'computing',
        },
        timing: { since: FIRST_SINCE, timeout: '~m1' },
        display: { icon: null, text: 'Thinking...', blob: null },
        contextId: '~nec',
      },
    });

    expect(
      toPresenceEvent({
        gone: {
          context: '/dm/~nec',
          ship: '~nec',
          topic: 'computing',
        },
      })
    ).toStrictEqual({
      type: 'clear',
      key: {
        context: '/dm/~nec',
        ship: '~nec',
        topic: 'computing',
      },
      contextId: '~nec',
    });
  });

  test('skips subscribing when the presence agent is unavailable', async () => {
    vi.mocked(scry).mockRejectedValueOnce(new BadResponseError(404, 'Missing'));

    await expect(subscribeToPresenceUpdates(vi.fn())).resolves.toBeNull();

    expect(subscribe).not.toHaveBeenCalled();
  });

  test('rethrows non-missing errors while probing presence availability', async () => {
    vi.mocked(scry).mockRejectedValueOnce(
      new BadResponseError(500, 'Internal Server Error')
    );

    await expect(subscribeToPresenceUpdates(vi.fn())).rejects.toBeInstanceOf(
      BadResponseError
    );

    expect(subscribe).not.toHaveBeenCalled();
  });

  test('subscribes to presence updates after a successful availability probe', async () => {
    vi.mocked(scry).mockResolvedValueOnce({ init: {} } as ub.PresenceResponse);
    vi.mocked(subscribe).mockResolvedValueOnce(42);

    await expect(subscribeToPresenceUpdates(vi.fn())).resolves.toBe(42);

    expect(scry).toHaveBeenCalledWith({
      app: 'presence',
      path: '/v1/init',
    });
    expect(subscribe).toHaveBeenCalledWith(
      {
        app: 'presence',
        path: '/v1',
      },
      expect.any(Function)
    );
  });
});
