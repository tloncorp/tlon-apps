import { describe, expect, it, vi } from 'vitest';

import {
  channelReadSource,
  createActivityReadTracker,
  dmReadSource,
} from './activity-read.js';

function makeTracker(options: { stopping?: boolean } = {}) {
  const poke = vi.fn(async () => undefined);
  const tracker = createActivityReadTracker({
    poke,
    isStopping: () => options.stopping ?? false,
  });
  return { poke, tracker };
}

const CHANNEL = channelReadSource('chat/~zod/test', '~zod/group')!;

describe('activity read tracker', () => {
  it('marks the source read deeply once the message is handled', async () => {
    const { poke, tracker } = makeTracker();

    tracker.begin(CHANNEL)();

    expect(poke).toHaveBeenCalledTimes(1);
    expect(poke).toHaveBeenCalledWith({
      app: 'activity',
      mark: 'activity-action',
      json: {
        read: {
          source: { channel: { nest: 'chat/~zod/test', group: '~zod/group' } },
          action: { all: { time: null, deep: true } },
        },
      },
    });
  });

  it('waits until every in-flight message from the source is done', () => {
    const { poke, tracker } = makeTracker();

    const first = tracker.begin(CHANNEL);
    const second = tracker.begin(CHANNEL);
    first();
    expect(poke).not.toHaveBeenCalled();
    second();
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('tracks sources independently', () => {
    const { poke, tracker } = makeTracker();

    const channel = tracker.begin(CHANNEL);
    tracker.begin(dmReadSource('~bus'))();

    expect(poke).toHaveBeenCalledTimes(1);
    expect(poke.mock.calls[0][0].json.read.source).toEqual({
      dm: { ship: '~bus' },
    });
    channel();
    expect(poke).toHaveBeenCalledTimes(2);
  });

  it('leaves messages unread when the monitor is stopping', () => {
    const { poke, tracker } = makeTracker({ stopping: true });

    tracker.begin(CHANNEL)();

    expect(poke).not.toHaveBeenCalled();
  });

  it('ignores a repeated end call', () => {
    const { poke, tracker } = makeTracker();

    const held = tracker.begin(CHANNEL);
    const end = tracker.begin(CHANNEL);
    end();
    end();
    expect(poke).not.toHaveBeenCalled();
    held();
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('reports poke failures instead of throwing', async () => {
    const onError = vi.fn();
    const tracker = createActivityReadTracker({
      poke: async () => {
        throw new Error('nack');
      },
      isStopping: () => false,
      onError,
    });

    tracker.begin(CHANNEL)();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('skips sources it cannot address', () => {
    const { poke, tracker } = makeTracker();

    expect(channelReadSource('chat/~zod/test', undefined)).toBeNull();
    tracker.begin(null)();

    expect(poke).not.toHaveBeenCalled();
  });

  it('builds club sources for group DMs', () => {
    expect(dmReadSource('0v4.abcde')).toEqual({ dm: { club: '0v4.abcde' } });
  });
});
