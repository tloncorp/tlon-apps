import { Atom } from '@urbit/nockjs';
import { afterEach, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';
import type { PokeHandlers } from '../http-api';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

function setup() {
  const firstPut = deferred<Response>();
  const fetch = vi
    .fn()
    .mockReturnValueOnce(firstPut.promise)
    .mockImplementation(async () => new Response(null, { status: 204 }));
  const client = new Urbit('http://example.test', undefined, undefined, fetch);
  client.nodeId = '~sampel-palnet';
  const state = client as unknown as {
    sseClientInitialized: boolean;
    outstandingPokes: Map<number, PokeHandlers>;
  };
  state.sseClientInitialized = true;
  return { client, state, firstPut, fetch };
}

afterEach(() => {
  vi.restoreAllMocks();
});

test.each(['send failure', 'abort'])(
  'a stale noun %s cannot delete a replacement poke after reset',
  async (failureType) => {
    const { client, state, firstPut } = setup();
    const controller = new AbortController();
    const old = client
      .pokeNoun({
        app: 'a',
        mark: 'm',
        noun: new Atom(0n),
        signal: controller.signal,
      })
      .catch((error) => error);
    client.seamlessReset();
    state.sseClientInitialized = true;
    const replacementId = await client.pokeNoun({
      app: 'a',
      mark: 'm',
      noun: new Atom(1n),
    });
    expect(replacementId).toBe(1);
    const replacement = state.outstandingPokes.get(replacementId);
    const failure = new Error('old request failed');
    if (failureType === 'abort') controller.abort(failure);
    firstPut.reject(failure);
    expect(await old).toBe(failure);
    expect(state.outstandingPokes.get(replacementId)).toBe(replacement);
  }
);

test('an already aborted noun request registers no poke or PUT', async () => {
  const { client, state, fetch } = setup();
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await expect(
    client.pokeNoun({
      app: 'a',
      mark: 'm',
      noun: new Atom(0n),
      signal: controller.signal,
    })
  ).rejects.toThrow('cancelled');
  expect(state.outstandingPokes.size).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});
