import { describe, expect, it, vi } from 'vitest';

import {
  type ActivityReadTarget,
  createActivityReadTracker,
  dmReadTarget,
} from './activity-read.js';

const CHANNEL: ActivityReadTarget = {
  channelId: 'chat/~zod/test',
  channelType: 'chat',
  groupId: '~zod/group',
};
const channel = () => CHANNEL;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeTracker(
  options: {
    stopping?: () => boolean;
    ready?: Promise<void>;
    markRead?: (target: ActivityReadTarget) => Promise<unknown>;
  } = {}
) {
  const markRead = vi.fn(options.markRead ?? (async () => undefined));
  const onError = vi.fn();
  const tracker = createActivityReadTracker({
    markRead,
    isStopping: options.stopping ?? (() => false),
    ready: options.ready ?? Promise.resolve(),
    onError,
  });
  return { markRead, onError, tracker };
}

describe('activity read tracker', () => {
  it('marks the source read once the message is handled', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    tracker.begin('c', channel)();
    await flush();

    expect(markRead).toHaveBeenCalledExactlyOnceWith(CHANNEL);
  });

  it('waits until every in-flight message from the source is done', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    const first = tracker.begin('c', channel);
    const second = tracker.begin('c', channel);
    first();
    await flush();
    expect(markRead).not.toHaveBeenCalled();
    second();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('tracks sources independently', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    const held = tracker.begin('c', channel);
    tracker.begin('dm/~bus', () => dmReadTarget('~bus'))();
    await flush();
    expect(markRead).toHaveBeenCalledExactlyOnceWith({
      channelId: '~bus',
      channelType: 'dm',
    });
    held();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(2);
  });

  it('holds reads until catch-up is done, then flushes each source once', async () => {
    const ready = deferred();
    const { markRead, tracker } = makeTracker({ ready: ready.promise });

    tracker.begin('c', channel)();
    tracker.begin('c', channel)();
    tracker.begin('dm/~bus', () => dmReadTarget('~bus'))();
    await flush();
    expect(markRead).not.toHaveBeenCalled();

    ready.resolve();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(2);
  });

  it('does not flush a held source that has a newer message in flight', async () => {
    const ready = deferred();
    const { markRead, tracker } = makeTracker({ ready: ready.promise });

    tracker.begin('c', channel)();
    const newer = tracker.begin('c', channel);
    ready.resolve();
    await flush();
    expect(markRead).not.toHaveBeenCalled();

    newer();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('waits for an async target, such as a group lookup in progress', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();
    const lookup = deferred<ActivityReadTarget>();

    tracker.begin('c', () => lookup.promise)();
    await flush();
    expect(markRead).not.toHaveBeenCalled();

    lookup.resolve(CHANNEL);
    await flush();
    expect(markRead).toHaveBeenCalledExactlyOnceWith(CHANNEL);
  });

  it('leaves the source unread when a turn in that round failed', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    const failed = tracker.begin('c', channel);
    const ok = tracker.begin('c', channel);
    failed(false);
    ok();
    await flush();
    expect(markRead).not.toHaveBeenCalled();

    // A later round starts clean.
    tracker.begin('c', channel)();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('leaves messages unread when the monitor is stopping', async () => {
    const { markRead, tracker } = makeTracker({ stopping: () => true });
    await flush();

    tracker.begin('c', channel)();
    await flush();

    expect(markRead).not.toHaveBeenCalled();
  });

  it('drops held reads if the monitor stops before catch-up finishes', async () => {
    const ready = deferred();
    let stopping = false;
    const { markRead, tracker } = makeTracker({
      ready: ready.promise,
      stopping: () => stopping,
    });

    tracker.begin('c', channel)();
    stopping = true;
    ready.resolve();
    await flush();

    expect(markRead).not.toHaveBeenCalled();
  });

  it('ignores a repeated end call', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    const held = tracker.begin('c', channel);
    const end = tracker.begin('c', channel);
    end();
    end();
    await flush();
    expect(markRead).not.toHaveBeenCalled();
    held();
    await flush();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('reports a failed read instead of throwing', async () => {
    const { onError, tracker } = makeTracker({
      markRead: async () => {
        throw new Error('nack');
      },
    });
    await flush();

    tracker.begin('c', channel)();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][1]).toEqual(CHANNEL);
  });

  it('skips sources it cannot address', async () => {
    const { markRead, tracker } = makeTracker();
    await flush();

    tracker.begin('c', () => null)();
    await flush();

    expect(markRead).not.toHaveBeenCalled();
  });

  it('addresses group DMs by club id', () => {
    expect(dmReadTarget('0v4.abcde')).toEqual({
      channelId: '0v4.abcde',
      channelType: 'groupDm',
    });
  });
});
