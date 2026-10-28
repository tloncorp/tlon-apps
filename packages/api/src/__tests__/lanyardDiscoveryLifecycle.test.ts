import { jam } from '@urbit/nockjs';
import { afterEach, expect, test, vi } from 'vitest';

// The test setup initializes the client; reload it so the serializer fault is injected.
vi.hoisted(() => vi.resetModules());

vi.mock('@urbit/nockjs', async (original) => {
  const actual = await original<typeof import('@urbit/nockjs')>();
  return { ...actual, jam: vi.fn(actual.jam) };
});

import { discoverContacts } from '../client/lanyardApi';
import { internalConfigureClient, internalRemoveClient } from '../client/urbit';
import type { PokeHandlers, SubscriptionRequestInterface } from '../http-api';
import { Urbit } from '../http-api/Urbit';
import type { WhoseBulkResponseEvent } from '../urbit/lanyard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

function setup(implementation?: typeof fetch) {
  vi.useFakeTimers();
  const fetch = vi.fn(
    implementation ?? (async () => new Response(null, { status: 204 }))
  );
  const client = new Urbit('http://example.test', undefined, undefined, fetch);
  const state = client as unknown as {
    sseClientInitialized: boolean;
    outstandingSubscriptions: Map<number, SubscriptionRequestInterface>;
    outstandingPokes: Map<number, PokeHandlers>;
  };
  state.sseClientInitialized = true;
  internalConfigureClient({
    shipName: '~sampel-palnet',
    shipUrl: 'http://example.test',
    client,
  });
  const respond = (result: WhoseBulkResponseEvent['query']['result']) => {
    const [id, entry] = [...state.outstandingSubscriptions][0];
    const nonce = entry.path.split('/').at(-1)!;
    entry.event?.({ query: { nonce, result } }, 'lanyard-update-1', id);
  };
  return { client, state, fetch, respond };
}

afterEach(() => {
  internalRemoveClient();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('a serialization failure rejects promptly and removes the live watch and poke', async () => {
  const { state, fetch } = setup();
  const failure = new RangeError('Maximum BigInt size exceeded');
  vi.mocked(jam).mockImplementationOnce(() => {
    throw failure;
  });
  let outcome: unknown;
  void discoverContacts(['+12025550123']).catch((error) => {
    outcome = error;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.mocked(jam)).toHaveBeenCalled();
  expect(outcome).toBe(failure);
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
  expect(
    fetch.mock.calls.some(([, options]) =>
      String(options?.body).includes('unsubscribe')
    )
  ).toBe(true);
  expect(
    fetch.mock.calls.some(
      ([, options]) =>
        options?.headers &&
        (options.headers as Record<string, string>)['Content-Type'] ===
          'application/x-urb-jam'
    )
  ).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

test('a failed noun PUT rejects instead of waiting for a result', async () => {
  const { state } = setup(
    async (_url, options) =>
      new Response(null, {
        status: String(options?.body).startsWith('0w') ? 500 : 204,
      })
  );
  const outcome = discoverContacts(['+12025550123']).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  expect(await outcome).toMatchObject({ name: 'ChannelPutError', status: 500 });
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test('a failed watch aborts an in-flight noun PUT without an unhandled rejection', async () => {
  let nounSignal: AbortSignal | null | undefined;
  const { state } = setup(async (_url, options) => {
    if (String(options?.body).startsWith('0w')) {
      nounSignal = options?.signal;
      return new Promise<Response>((_resolve, reject) => {
        nounSignal?.addEventListener('abort', () => reject(nounSignal?.reason));
      });
    }
    return new Response(null, { status: 204 });
  });
  const outcome = discoverContacts(['+12025550123']).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  const failure = new Error('watch failed');
  const [id, entry] = [...state.outstandingSubscriptions][0];
  entry.err?.(failure, String(id));
  await vi.advanceTimersByTimeAsync(0);
  expect(await outcome).toBe(failure);
  expect(nounSignal?.aborted).toBe(true);
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test.each(['accepted', 'pending'])(
  'a %s watch PUT has a finite result deadline and releases handlers',
  async (watchState) => {
    const watchPut = deferred<Response>();
    const { state } = setup(async (_url, options) => {
      const body = String(options?.body);
      if (watchState === 'pending' && body.includes('"action":"subscribe"')) {
        return watchPut.promise;
      }
      return new Response(null, { status: 204 });
    });
    const outcome = discoverContacts(['+12025550123']).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.outstandingSubscriptions.size).toBe(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(await outcome).toBe('timeout');
    expect(state.outstandingSubscriptions.size).toBe(0);
    expect(state.outstandingPokes.size).toBe(0);
    watchPut.resolve(new Response(null, { status: 204 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  }
);

test('a result arriving before a stuck noun PUT does not cancel the operation deadline', async () => {
  let nounSignal: AbortSignal | null | undefined;
  const { state, respond } = setup(async (_url, options) => {
    if (String(options?.body).startsWith('0w')) {
      nounSignal = options?.signal;
      return new Promise<Response>((_resolve, reject) => {
        nounSignal?.addEventListener('abort', () => reject(nounSignal?.reason));
      });
    }
    return new Response(null, { status: 204 });
  });
  const outcome = discoverContacts(['+12025550123']).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  respond({ 'next-salt': '0x1', results: {} });
  await vi.advanceTimersByTimeAsync(60000);
  expect(await outcome).toBe('timeout');
  expect(nounSignal?.aborted).toBe(true);
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
});

test('an ACK and result before a stalled PUT still leave the deadline armed', async () => {
  const nounPut = deferred<Response>();
  const { state, respond } = setup(async (_url, options) => {
    if (String(options?.body).startsWith('0w')) return nounPut.promise;
    return new Response(null, { status: 204 });
  });
  const outcome = discoverContacts(['+12025550123']).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  [...state.outstandingPokes.values()][0].onSuccess?.();
  respond({ 'next-salt': '0x1', results: {} });
  await vi.advanceTimersByTimeAsync(60000);
  expect(await outcome).toBe('timeout');
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
  nounPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(0);
});

test.each(['rate limited', 'poke nacked', 'verifier unavailable'])(
  'a backend failure string %s rejects without an accepted cursor',
  async (failure) => {
    const { state, respond } = setup();
    const outcome = discoverContacts(['+12025550123']).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    respond(failure);
    await vi.advanceTimersByTimeAsync(0);
    expect(await outcome).toEqual(new Error(failure));
    expect(state.outstandingSubscriptions.size).toBe(0);
    expect(state.outstandingPokes.size).toBe(0);
  }
);

test.each<{
  results: Record<string, string | null>;
  matches: [string, string][];
}>([
  { results: {}, matches: [] },
  {
    results: { '+12025550123': '~bus', '+12025550124': null },
    matches: [['+12025550123', '~bus']],
  },
])(
  'accepted results retain their salt, including zero matches: %j',
  async ({ results, matches }) => {
    const { state, respond } = setup();
    const outcome = discoverContacts(['+12025550123']).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    respond({ 'next-salt': '0x1234', results });
    await expect(outcome).resolves.toEqual({ matches, nextSalt: '0x1234' });
    expect(state.outstandingSubscriptions.size).toBe(0);
    expect(state.outstandingPokes.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  }
);

test('a nonce mismatch rejects instead of returning a null cursor', async () => {
  const { state } = setup();
  const outcome = discoverContacts(['+12025550123']).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  const [id, entry] = [...state.outstandingSubscriptions][0];
  entry.event?.(
    { query: { nonce: 'wrong', result: { 'next-salt': '0x1', results: {} } } },
    'lanyard-update-1',
    id
  );
  expect(await outcome).toEqual(new Error('Contact discovery nonce mismatch'));
  expect(state.outstandingPokes.size).toBe(0);
});
