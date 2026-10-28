import { describe, expect, it, vi } from 'vitest';

import { makeKeyedFetches } from './keyedFetches';

/** A fetch the test settles by hand, one call at a time. */
function setup() {
  const calls: {
    id: string;
    signal: AbortSignal;
    resolve: () => void;
    reject: (error: unknown) => void;
  }[] = [];
  const onError = vi.fn();
  const fetches = makeKeyedFetches({
    fetch: (id, signal) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ id, signal, resolve, reject });
      }),
    onError,
  });
  const started = () => calls.map((call) => call.id);
  return { fetches, calls, onError, started };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('makeKeyedFetches', () => {
  it('starts one fetch for each wanted id', async () => {
    const { fetches, started } = setup();
    fetches.want(['a', 'b']);
    fetches.want(['b', 'a']);
    await settled();
    expect(started()).toEqual(['a', 'b']);
  });

  it('keeps the fetch of an id that is still wanted when another leaves the list', async () => {
    const { fetches, calls, started } = setup();
    fetches.want(['a', 'b']);
    await settled();
    calls[0].resolve();
    fetches.want(['b']);
    await settled();

    expect(calls[1].signal.aborted).toBe(false);
    expect(started()).toEqual(['a', 'b']);
  });

  it('cancels the fetch of an id that leaves the list', async () => {
    const { fetches, calls } = setup();
    fetches.want(['a', 'b']);
    await settled();
    fetches.want(['a']);

    expect(calls[0].signal.aborted).toBe(false);
    expect(calls[1].signal.aborted).toBe(true);
  });

  it('fetches an id again once it has finished and is wanted anew', async () => {
    const { fetches, calls, started } = setup();
    fetches.want(['a']);
    await settled();
    calls[0].resolve();
    await settled();
    fetches.want([]);
    fetches.want(['a']);
    await settled();

    expect(started()).toEqual(['a', 'a']);
  });

  it('waits for a cancelled fetch to settle before fetching its id again', async () => {
    const { fetches, calls, started } = setup();
    fetches.want(['a']);
    await settled();
    fetches.want([]);
    fetches.want(['a']);
    await settled();
    expect(started()).toEqual(['a']);

    calls[0].reject(new Error('Operation aborted'));
    await settled();
    expect(started()).toEqual(['a', 'a']);
    expect(calls[1].signal.aborted).toBe(false);
  });

  it('does not fetch an id that was dropped again while it waited', async () => {
    const { fetches, calls, started } = setup();
    fetches.want(['a']);
    await settled();
    fetches.want([]);
    fetches.want(['a']);
    fetches.want([]);
    calls[0].reject(new Error('Operation aborted'));
    await settled();

    expect(started()).toEqual(['a']);
  });

  it('starts every fetch over under a new scope', async () => {
    const { fetches, calls, started } = setup();
    fetches.want(['a'], 1);
    await settled();
    fetches.want(['a'], 2);
    expect(calls[0].signal.aborted).toBe(true);

    calls[0].reject(new Error('Operation aborted'));
    await settled();
    expect(started()).toEqual(['a', 'a']);
  });

  it('cancels everything when stopped', async () => {
    const { fetches, calls } = setup();
    fetches.want(['a', 'b']);
    await settled();
    fetches.stop();

    expect(calls.map((call) => call.signal.aborted)).toEqual([true, true]);
  });

  it('reports a failed fetch, but not one that was cancelled', async () => {
    const { fetches, calls, onError } = setup();
    fetches.want(['a', 'b']);
    await settled();
    const failure = new Error('offline');
    calls[0].reject(failure);
    fetches.want(['a']);
    calls[1].reject(new Error('Operation aborted'));
    await settled();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('a', failure);
  });
});
