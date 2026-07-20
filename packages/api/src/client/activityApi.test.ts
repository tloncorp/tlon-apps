import { beforeEach, describe, expect, test, vi } from 'vitest';

import type * as ub from '../urbit';
import { subscribeToActivity } from './activityApi';
import { subscribe } from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');

  return {
    ...actual,
    subscribe: vi.fn(),
  };
});

const EVENT_TIME = '170.141.184.506.853.155.647.879.036.981.225.717.760';

function mockActivityAdd({
  event,
  source,
  sourceKey,
}: {
  event: ub.ActivityEvent;
  source: ub.Source;
  sourceKey: string;
}) {
  vi.mocked(subscribe).mockImplementationOnce(async (_endpoint, onUpdate) => {
    await (onUpdate as (update: ub.ActivityUpdate) => void | Promise<void>)({
      add: {
        event,
        source,
        time: EVENT_TIME,
        'source-key': sourceKey,
      },
    });
    return 7;
  });
}

beforeEach(() => {
  vi.mocked(subscribe).mockReset();
});

describe('subscribeToActivity invite conversion', () => {
  test('converts DM invites for opt-in subscribers', async () => {
    mockActivityAdd({
      event: { notified: true, 'dm-invite': { ship: '~bus' } },
      source: { dm: { ship: '~bus' } },
      sourceKey: 'ship/~bus',
    });
    const handler = vi.fn();

    await subscribeToActivity(handler, { includeInvites: true });

    expect(handler).toHaveBeenCalledWith({
      type: 'addActivityEvent',
      events: [
        expect.objectContaining({
          id: EVENT_TIME,
          sourceId: 'ship/~bus',
          bucketId: 'all',
          shouldNotify: true,
          type: 'dm-invite',
          channelId: '~bus',
          authorId: '~bus',
        }),
      ],
    });
  });

  test('converts group invites for opt-in subscribers', async () => {
    mockActivityAdd({
      event: {
        notified: true,
        'group-invite': { ship: '~bus', group: '~zod/tlon' },
      },
      source: { group: '~zod/tlon' },
      sourceKey: 'group/~zod/tlon',
    });
    const handler = vi.fn();

    await subscribeToActivity(handler, { includeInvites: true });

    expect(handler).toHaveBeenCalledWith({
      type: 'addActivityEvent',
      events: [
        expect.objectContaining({
          sourceId: 'group/~zod/tlon',
          type: 'group-invite',
          groupId: '~zod/tlon',
          groupEventUserId: '~bus',
        }),
      ],
    });
  });

  test('keeps invite events out of the default activity-feed stream', async () => {
    mockActivityAdd({
      event: {
        notified: true,
        'group-invite': { ship: '~bus', group: '~zod/tlon' },
      },
      source: { group: '~zod/tlon' },
      sourceKey: 'group/~zod/tlon',
    });
    const handler = vi.fn();

    await subscribeToActivity(handler);

    expect(handler).not.toHaveBeenCalled();
  });
});
