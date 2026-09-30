import { describe, expect, it, vi } from 'vitest';

import {
  type ActivityReadSource,
  channelReadSource,
  createActivityReadTracker,
  dmReadSource,
} from './activity-read.js';

function makeTracker(
  options: {
    stopping?: () => boolean;
    ready?: Promise<void>;
    poke?: () => Promise<unknown>;
  } = {}
) {
  const poke = vi.fn(options.poke ?? (async () => undefined));
  const onError = vi.fn();
  const sleep = vi.fn(async () => undefined);
  const tracker = createActivityReadTracker({
    poke,
    isStopping: options.stopping ?? (() => false),
    ready: options.ready ?? Promise.resolve(),
    onError,
    sleep,
  });
  return { poke, onError, sleep, tracker };
}

const CHANNEL = channelReadSource('chat/~zod/test', '~zod/group')!;
const channel = () => CHANNEL;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('activity read tracker', () => {
  it('marks the source read deeply once the message is handled', async () => {
    const { poke, tracker } = makeTracker();
    await flush();

    tracker.begin('channel/chat/~zod/test', channel)();
    await flush();

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

  it('waits until every in-flight message from the source is done', async () => {
    const { poke, tracker } = makeTracker();
    await flush();

    const first = tracker.begin('c', channel);
    const second = tracker.begin('c', channel);
    first();
    await flush();
    expect(poke).not.toHaveBeenCalled();
    second();
    await flush();
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('tracks sources independently', async () => {
    const { poke, tracker } = makeTracker();
    await flush();

    const held = tracker.begin('c', channel);
    tracker.begin('dm/~bus', () => dmReadSource('~bus'))();
    await flush();

    expect(poke).toHaveBeenCalledTimes(1);
    expect(poke.mock.calls[0][0].json.read.source).toEqual({
      dm: { ship: '~bus' },
    });
    held();
    await flush();
    expect(poke).toHaveBeenCalledTimes(2);
  });

  it('holds reads until catch-up is done, then flushes each source once', async () => {
    const ready = deferred();
    const { poke, tracker } = makeTracker({ ready: ready.promise });

    tracker.begin('c', channel)();
    tracker.begin('c', channel)();
    tracker.begin('dm/~bus', () => dmReadSource('~bus'))();
    await flush();
    expect(poke).not.toHaveBeenCalled();

    ready.resolve();
    await flush();
    expect(poke).toHaveBeenCalledTimes(2);
  });

  it('resolves the source when the read is sent', async () => {
    const ready = deferred();
    const { poke, tracker } = makeTracker({ ready: ready.promise });
    let group: string | undefined;

    tracker.begin('c', () => channelReadSource('chat/~zod/test', group))();
    group = '~zod/group';
    ready.resolve();
    await flush();

    expect(poke.mock.calls[0][0].json.read.source).toEqual(CHANNEL);
  });

  it('leaves messages unread when the monitor is stopping', async () => {
    const { poke, tracker } = makeTracker({ stopping: () => true });
    await flush();

    tracker.begin('c', channel)();
    await flush();

    expect(poke).not.toHaveBeenCalled();
  });

  it('drops held reads if the monitor stops before catch-up finishes', async () => {
    const ready = deferred();
    let stopping = false;
    const { poke, tracker } = makeTracker({
      ready: ready.promise,
      stopping: () => stopping,
    });

    tracker.begin('c', channel)();
    stopping = true;
    ready.resolve();
    await flush();

    expect(poke).not.toHaveBeenCalled();
  });

  it('ignores a repeated end call', async () => {
    const { poke, tracker } = makeTracker();
    await flush();

    const held = tracker.begin('c', channel);
    const end = tracker.begin('c', channel);
    end();
    end();
    await flush();
    expect(poke).not.toHaveBeenCalled();
    held();
    await flush();
    expect(poke).toHaveBeenCalledTimes(1);
  });

  it('retries a failed read with backoff before reporting it', async () => {
    const { poke, onError, sleep, tracker } = makeTracker({
      poke: async () => {
        throw new Error('nack');
      },
    });
    await flush();

    tracker.begin('c', channel)();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(poke).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
    expect(onError.mock.calls[0][1]).toEqual(CHANNEL as ActivityReadSource);
  });

  it('stops retrying once the monitor is stopping', async () => {
    let stopping = false;
    const { poke, onError, tracker } = makeTracker({
      stopping: () => stopping,
      poke: async () => {
        stopping = true;
        throw new Error('nack');
      },
    });
    await flush();

    tracker.begin('c', channel)();
    await flush();
    await flush();

    expect(poke).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('skips sources it cannot address', async () => {
    const { poke, tracker } = makeTracker();
    await flush();

    expect(channelReadSource('chat/~zod/test', undefined)).toBeNull();
    tracker.begin('c', () => null)();
    await flush();

    expect(poke).not.toHaveBeenCalled();
  });

  it('builds club sources for group DMs', () => {
    expect(dmReadSource('0v4.abcde')).toEqual({ dm: { club: '0v4.abcde' } });
  });
});
