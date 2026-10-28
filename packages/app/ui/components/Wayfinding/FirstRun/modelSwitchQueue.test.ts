import { describe, expect, it } from 'vitest';

import { createModelSwitchQueue } from './modelSwitchQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('model switches', () => {
  it('starts a newer switch only after the one in flight settles', async () => {
    const runSwitch = createModelSwitchQueue();
    const saves: string[] = [];
    const first = deferred<boolean>();

    const apiKey = runSwitch(async () => {
      saves.push('api-key started');
      const applied = await first.promise;
      // A late retry of the older switch lands here.
      saves.push('api-key saved');
      return applied;
    });
    await flush();
    const included = runSwitch(async () => {
      saves.push('included saved');
      return true;
    });
    await flush();
    expect(saves).toEqual(['api-key started']);

    first.resolve(true);
    expect(await apiKey).toEqual({ superseded: true });
    expect(await included).toEqual({ superseded: false, value: true });
    expect(saves).toEqual([
      'api-key started',
      'api-key saved',
      'included saved',
    ]);
  });

  it('never runs a switch replaced while it waited its turn', async () => {
    const runSwitch = createModelSwitchQueue();
    const started: string[] = [];
    const first = deferred<boolean>();

    void runSwitch(() => {
      started.push('a');
      return first.promise;
    });
    await flush();
    const b = runSwitch(async () => {
      started.push('b');
      return true;
    });
    const c = runSwitch(async () => {
      started.push('c');
      return true;
    });

    first.resolve(true);
    expect(await b).toEqual({ superseded: true });
    expect(await c).toEqual({ superseded: false, value: true });
    expect(started).toEqual(['a', 'c']);
  });

  it('reports the only switch, failed or not', async () => {
    const runSwitch = createModelSwitchQueue();
    expect(await runSwitch(async () => false)).toEqual({
      superseded: false,
      value: false,
    });
  });

  it('keeps going after a switch throws', async () => {
    const runSwitch = createModelSwitchQueue();
    const failing = runSwitch(() => Promise.reject(new Error('offline')));
    await expect(failing).rejects.toThrow('offline');
    expect(await runSwitch(async () => true)).toEqual({
      superseded: false,
      value: true,
    });
  });
});
