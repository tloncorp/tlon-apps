import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSharedFeed, readAlongsideFeed } from './sharedFeed';

type Open = Parameters<typeof createSharedFeed<string>>[0]['open'];

/** A ship whose subscriptions the test settles by hand. */
function fakeShip() {
  const attempts: {
    onUpdate: Parameters<Open>[0];
    onRejected: Parameters<Open>[1];
    resolve: (id: number) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const open = vi.fn<Parameters<Open>, ReturnType<Open>>(
    (onUpdate, onRejected) =>
      new Promise<number>((resolve, reject) => {
        attempts.push({ onUpdate, onRejected, resolve, reject });
      })
  );
  return { attempts, open, close: vi.fn(), onUpdate: vi.fn() };
}

const DELAYS = [1_000, 4_000];

function feedOn(
  ship: ReturnType<typeof fakeShip>,
  shouldReopen?: () => boolean
) {
  return createSharedFeed<string>({
    open: ship.open,
    close: ship.close,
    onUpdate: ship.onUpdate,
    shouldReopen,
    retryDelaysMs: DELAYS,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSharedFeed', () => {
  it('opens once for every user and closes when the last one leaves', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship);
    const first = retain();
    const second = retain();
    expect(ship.open).toHaveBeenCalledTimes(1);

    ship.attempts[0].resolve(3);
    ship.attempts[0].onUpdate('snapshot', 3);
    expect(ship.onUpdate).toHaveBeenCalledWith('snapshot');

    first();
    await vi.runAllTimersAsync();
    expect(ship.close).not.toHaveBeenCalled();

    second();
    await vi.runAllTimersAsync();
    expect(ship.close).toHaveBeenCalledTimes(1);
    expect(ship.close).toHaveBeenCalledWith(3);
  });

  it('closes by the id on the latest update, which a channel reset changes', async () => {
    const ship = fakeShip();
    const release = feedOn(ship)();
    ship.attempts[0].resolve(3);
    ship.attempts[0].onUpdate('snapshot', 3);
    ship.attempts[0].onUpdate('snapshot again', 9);

    release();
    await vi.runAllTimersAsync();
    expect(ship.close).toHaveBeenCalledWith(9);
  });

  it('opens again after the ship refuses the subscription', async () => {
    const ship = fakeShip();
    feedOn(ship)();
    ship.attempts[0].reject(new Error('nack'));

    await vi.advanceTimersByTimeAsync(DELAYS[0] - 1);
    expect(ship.open).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(ship.open).toHaveBeenCalledTimes(2);
  });

  it('opens again when the refusal arrives after the subscribe resolved', async () => {
    const ship = fakeShip();
    const release = feedOn(ship)();
    ship.attempts[0].resolve(3);
    await vi.advanceTimersByTimeAsync(0);
    ship.attempts[0].onRejected(new Error('late nack'));

    await vi.advanceTimersByTimeAsync(DELAYS[0]);
    expect(ship.open).toHaveBeenCalledTimes(2);

    // The refused subscription is already gone on the ship; only the one
    // that replaced it is closed.
    ship.attempts[1].resolve(5);
    release();
    await vi.runAllTimersAsync();
    expect(ship.close).toHaveBeenCalledTimes(1);
    expect(ship.close).toHaveBeenCalledWith(5);
  });

  it('counts a subscribe that throws as a refusal', async () => {
    const ship = fakeShip();
    ship.open.mockImplementationOnce(() => {
      throw new Error('not supported');
    });
    feedOn(ship)();

    await vi.advanceTimersByTimeAsync(DELAYS[0]);
    expect(ship.open).toHaveBeenCalledTimes(2);
  });

  it('waits longer after each refusal in a row, and starts over once an update arrives', async () => {
    const ship = fakeShip();
    feedOn(ship)();
    ship.attempts[0].reject(new Error('nack'));
    await vi.advanceTimersByTimeAsync(DELAYS[0]);
    ship.attempts[1].reject(new Error('nack'));

    await vi.advanceTimersByTimeAsync(DELAYS[1] - 1);
    expect(ship.open).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(ship.open).toHaveBeenCalledTimes(3);

    ship.attempts[2].resolve(4);
    ship.attempts[2].onUpdate('snapshot', 4);
    ship.attempts[2].onRejected(new Error('late nack'));
    await vi.advanceTimersByTimeAsync(DELAYS[0]);
    expect(ship.open).toHaveBeenCalledTimes(4);
  });

  it('stops trying once nobody uses the feed', async () => {
    const ship = fakeShip();
    const release = feedOn(ship)();
    // The runner's own timeout for this test is a pending timer too.
    const idle = vi.getTimerCount();
    ship.attempts[0].reject(new Error('nack'));
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(idle + 1);
    release();
    expect(vi.getTimerCount()).toBe(idle);
    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(1);
    expect(ship.close).not.toHaveBeenCalled();
  });

  it('closes a subscription that only opens after its last user has left', async () => {
    const ship = fakeShip();
    const release = feedOn(ship)();
    release();
    expect(ship.close).not.toHaveBeenCalled();

    ship.attempts[0].resolve(3);
    await vi.runAllTimersAsync();
    expect(ship.close).toHaveBeenCalledTimes(1);
    expect(ship.close).toHaveBeenCalledWith(3);
  });

  it('opens at once for a user who arrives after a refusal emptied the feed', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship);
    const release = retain();
    ship.attempts[0].reject(new Error('nack'));
    await vi.advanceTimersByTimeAsync(0);
    release();

    retain();
    expect(ship.open).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(2);
  });

  it('leaves the feed closed when told not to reopen, until someone new asks', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship, () => false);
    retain();
    ship.attempts[0].reject(new Error('no such agent'));

    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(1);

    retain();
    expect(ship.open).toHaveBeenCalledTimes(2);
  });

  it('opens again when woken after being left closed', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship, () => false);
    retain();
    ship.attempts[0].reject(new Error('no such agent'));
    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(1);

    retain.wake();
    expect(ship.open).toHaveBeenCalledTimes(2);
    ship.attempts[1].resolve(4);
    ship.attempts[1].onUpdate('snapshot', 4);
    expect(ship.onUpdate).toHaveBeenCalledWith('snapshot');
  });

  it('is not woken while it is open, waiting to retry, or unused', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship);
    retain.wake();
    expect(ship.open).not.toHaveBeenCalled();

    const release = retain();
    retain.wake();
    expect(ship.open).toHaveBeenCalledTimes(1);

    ship.attempts[0].reject(new Error('nack'));
    await vi.advanceTimersByTimeAsync(0);
    retain.wake();
    expect(ship.open).toHaveBeenCalledTimes(1);

    release();
    retain.wake();
    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(1);
  });

  it('drops an update from a subscription that was released', async () => {
    const ship = fakeShip();
    const retain = feedOn(ship);
    const release = retain();
    ship.attempts[0].resolve(3);
    ship.attempts[0].onUpdate('first', 3);
    release();

    retain();
    ship.attempts[1].resolve(5);
    ship.attempts[1].onUpdate('newer', 5);
    ship.attempts[0].onUpdate('late', 3);

    expect(ship.onUpdate.mock.calls).toEqual([['first'], ['newer']]);
  });

  it('ignores a late failure from an attempt that was already replaced', async () => {
    const ship = fakeShip();
    feedOn(ship)();
    ship.attempts[0].resolve(3);
    await vi.advanceTimersByTimeAsync(0);
    ship.attempts[0].onRejected(new Error('late nack'));
    await vi.advanceTimersByTimeAsync(DELAYS[0]);
    ship.attempts[1].resolve(5);
    ship.attempts[1].onUpdate('snapshot', 5);

    ship.attempts[0].onRejected(new Error('again'));
    await vi.runAllTimersAsync();
    expect(ship.open).toHaveBeenCalledTimes(2);
  });
});

describe('readAlongsideFeed', () => {
  it('returns the read when no fact arrived while it was out', async () => {
    const read = vi.fn().mockResolvedValue('A');
    await expect(readAlongsideFeed(read, () => 4)).resolves.toBe('A');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again when a fact arrived while the first read was out', async () => {
    let facts = 0;
    const read = vi
      .fn<[], Promise<string>>()
      .mockImplementationOnce(async () => {
        // The feed delivers something newer than this read saw.
        facts += 1;
        return 'stale';
      })
      .mockResolvedValue('fresh');

    await expect(readAlongsideFeed(read, () => facts)).resolves.toBe('fresh');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('leaves what the feed has built when facts arrive during every read', async () => {
    let facts = 0;
    const read = vi.fn(async () => `read ${(facts += 1)}`);

    await expect(
      readAlongsideFeed(read, () => facts, {
        attempts: 3,
        keptByFeed: () => `feed at ${facts}`,
      })
    ).resolves.toBe('feed at 3');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('settles for the last read when the feed has built nothing', async () => {
    let facts = 0;
    const read = vi.fn(async () => `read ${(facts += 1)}`);

    await expect(
      readAlongsideFeed(read, () => facts, {
        attempts: 3,
        keptByFeed: () => undefined,
      })
    ).resolves.toBe('read 3');
    await expect(
      readAlongsideFeed(read, () => facts, { attempts: 2 })
    ).resolves.toBe('read 5');
  });

  it('passes a failed read on', async () => {
    const failure = new Error('404');
    await expect(
      readAlongsideFeed(
        () => Promise.reject(failure),
        () => 0
      )
    ).rejects.toBe(failure);
  });
});
