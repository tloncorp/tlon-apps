import { EventEmitter } from 'node:events';
import { expect, test, vi } from 'vitest';

import {
  runWithTlonApiScope,
  setScopedTlonApiWithPoke,
} from '../urbit/api-client.js';
import {
  createComputingPresenceReporter,
  createComputingPresenceTracker,
} from './computing-presence.js';

test('publishes and clears continuation presence outside the monitor API scope', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);
  const error = vi.fn();
  const tracker = await runWithTlonApiScope(async () => {
    setScopedTlonApiWithPoke(poke, '~zod', 'http://zod');
    return createComputingPresenceTracker({
      runtime: { log: vi.fn(), error, exit: vi.fn<(code: number) => never>() },
      minUpdateIntervalMs: 0,
    });
  });
  const target = { conversationId: '~ten', runId: 'browser-continuation' };
  const events = new EventEmitter();
  events.on('commentary', () => {
    tracker.setCommentary({ ...target, text: 'Checking your sign-in.' });
  });
  events.on('end', () => tracker.stopRun(target));

  tracker.refreshRun(target);
  await vi.waitFor(() => expect(poke).toHaveBeenCalledTimes(1));
  events.emit('commentary');
  await vi.waitFor(() =>
    expect(poke).toHaveBeenLastCalledWith(
      expect.objectContaining({
        json: {
          set: expect.objectContaining({
            key: { ship: '~zod', context: '/dm/~ten', topic: 'computing' },
            display: expect.objectContaining({
              text: 'Checking your sign-in.',
            }),
          }),
        },
      })
    )
  );
  events.emit('end');
  await vi.waitFor(() =>
    expect(poke).toHaveBeenLastCalledWith(
      expect.objectContaining({
        json: {
          clear: { ship: '~zod', context: '/dm/~ten', topic: 'computing' },
        },
      })
    )
  );
  expect(error).not.toHaveBeenCalled();
});

test('keeps each presence reporter bound to its own monitor client', async () => {
  const zodPoke = vi.fn().mockResolvedValue(undefined);
  const necPoke = vi.fn().mockResolvedValue(undefined);
  const createReporter = (ship: string, poke: typeof zodPoke) =>
    runWithTlonApiScope(async () => {
      setScopedTlonApiWithPoke(poke, ship, `http://${ship.slice(1)}`);
      return createComputingPresenceReporter();
    });
  const zod = await createReporter('~zod', zodPoke);
  const nec = await createReporter('~nec', necPoke);
  const update = {
    conversationId: '~ten',
    thinking: true,
    toolNames: [],
    commentary: 'Checking the payment result.',
  };

  await Promise.all([zod.publish(update), nec.publish(update)]);
  for (const [poke, ship] of [
    [zodPoke, '~zod'],
    [necPoke, '~nec'],
  ] as const) {
    expect(poke).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        json: {
          set: expect.objectContaining({
            key: { ship, context: '/dm/~ten', topic: 'computing' },
          }),
        },
      })
    );
  }
});
