import { afterEach, expect, test, vi } from 'vitest';

// The test setup initializes the client; reload it so the serializer fault is injected.
vi.hoisted(() => vi.resetModules());

vi.mock('../http-api/nounEncoding', async (original) => {
  const actual = await original<typeof import('../http-api/nounEncoding')>();
  return { ...actual, jamToUw: vi.fn(actual.jamToUw) };
});

import { discoverContacts } from '../client/lanyardApi';
import {
  internalConfigureClient,
  internalRemoveClient,
  poke,
} from '../client/urbit';
import {
  AuthError,
  type PokeHandlers,
  type SubscriptionRequestInterface,
} from '../http-api';
import { Urbit } from '../http-api/Urbit';
import { jamToUw } from '../http-api/nounEncoding';
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
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('a serialization failure rejects promptly and removes the live watch and poke', async () => {
  const { state, fetch } = setup();
  const failure = new RangeError('Maximum BigInt size exceeded');
  vi.mocked(jamToUw).mockImplementationOnce(() => {
    throw failure;
  });
  let outcome: unknown;
  void discoverContacts(['+12025550123']).catch((error) => {
    outcome = error;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.mocked(jamToUw)).toHaveBeenCalled();
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

test('the deadline settles during shared reauth without cancelling auth or starting late discovery writes', async () => {
  const { client, state, fetch: channelFetch } = setup();
  const loginRequests: {
    response: ReturnType<typeof deferred<Response>>;
    signal: AbortSignal | null | undefined;
  }[] = [];
  const loginFetch = vi.fn(
    async (_url: RequestInfo | URL, options?: RequestInit) => {
      const response = deferred<Response>();
      const signal = options?.signal;
      signal?.addEventListener('abort', () => response.reject(signal.reason), {
        once: true,
      });
      loginRequests.push({ response, signal });
      return response.promise;
    }
  );
  vi.stubGlobal('fetch', loginFetch);
  const initiatingPoke = vi
    .spyOn(client, 'poke')
    .mockRejectedValueOnce(new AuthError('invalid session'))
    .mockResolvedValue(7);
  const watch = vi.spyOn(client, 'subscribeOnce');
  const send = vi.spyOn(client, 'pokeNoun');
  internalConfigureClient({
    shipName: '~sampel-palnet',
    shipUrl: 'http://example.test',
    client,
    getCode: async () => 'code',
  });
  const initiatingRequest = poke({
    app: 'activity',
    mark: 'activity-action-2',
    json: {},
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(loginRequests).toHaveLength(1);
  let outcome: unknown;
  const discovery = discoverContacts(['+12025550123']).then(
    (value) => {
      outcome = value;
    },
    (error) => {
      outcome = error;
    }
  );
  await vi.advanceTimersByTimeAsync(60000);
  const outcomeAtDeadline = outcome;
  const pendingLogin = loginRequests.at(-1)!;
  const authWasStillActive = !pendingLogin.signal?.aborted;
  const timersWhileAuthContinues = vi.getTimerCount();
  pendingLogin.response.resolve(
    new Response(null, {
      status: 200,
      headers: { 'set-cookie': 'urbauth=refreshed; Path=/' },
    })
  );
  await vi.advanceTimersByTimeAsync(0);
  await expect(initiatingRequest).resolves.toBe(7);
  await discovery;

  expect(outcomeAtDeadline).toBe('timeout');
  expect(authWasStillActive).toBe(true);
  expect(timersWhileAuthContinues).toBe(1);
  expect(client.cookie).toBe('urbauth=refreshed');
  expect(initiatingPoke).toHaveBeenCalledTimes(2);
  expect(watch).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(channelFetch).not.toHaveBeenCalled();
  expect(state.outstandingSubscriptions.size).toBe(0);
  expect(state.outstandingPokes.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
