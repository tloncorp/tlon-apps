import { afterEach, describe, expect, test, vi } from 'vitest';

import { AuthFailureError } from '../client/landscapeApi';
import {
  internalConfigureClient,
  internalRemoveClient,
  poke,
  subscribe,
} from '../client/urbit';
import { AuthError, ChannelPutError } from '../http-api';
import { Urbit } from '../http-api/Urbit';

// A stand-in for the singleton Urbit client with just enough surface for the
// client wrapper's retry paths. `channelOpened` mirrors a client that has
// already sent something over its channel, which is the case that matters.
function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    poke: vi.fn(),
    subscribe: vi.fn(),
    seamlessReset: vi.fn(),
    channelOpened: true,
    cookie: 'urbauth=old',
    delete: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

function loginResponse(status = 200) {
  return new Response(null, {
    status,
    headers:
      status === 200
        ? { 'set-cookie': 'urbauth=refreshed; Path=/; Max-Age=2592000' }
        : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  internalRemoveClient();
});

describe('reauth', () => {
  test('concurrent auth failures share one login and one channel rotation', async () => {
    const client = fakeClient({
      poke: vi
        .fn()
        .mockRejectedValueOnce(new AuthError('invalid session'))
        .mockRejectedValueOnce(new AuthError('invalid session'))
        .mockRejectedValueOnce(new AuthError('invalid session'))
        .mockResolvedValue(1),
    });
    const loginFetch = vi.fn().mockResolvedValue(loginResponse());
    vi.stubGlobal('fetch', loginFetch);
    // resolve the code on a later tick so every caller reaches reauth() before
    // the first one has a cookie; this is the window the old code raced in
    const getCode = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('code')))
    );

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode,
      client: client as any,
    });

    const pokes = [
      poke({ app: 'activity', mark: 'activity-action-2', json: {} }),
      poke({ app: 'settings', mark: 'settings-event', json: {} }),
      poke({ app: 'contacts', mark: 'contact-action-1', json: {} }),
    ];
    await expect(Promise.all(pokes)).resolves.toEqual([1, 1, 1]);

    expect(getCode).toHaveBeenCalledTimes(1);
    expect(loginFetch).toHaveBeenCalledTimes(1);
    expect(client.cookie).toBe('urbauth=refreshed');
    // the channel we had belonged to the old session; one rotation, shared
    expect(client.seamlessReset).toHaveBeenCalledTimes(1);
    // three failures, three retries
    expect(client.poke).toHaveBeenCalledTimes(6);
  });

  test('does not rotate the channel when nothing was sent on it yet', async () => {
    const client = fakeClient({
      channelOpened: false,
      poke: vi
        .fn()
        .mockRejectedValueOnce(new AuthError('invalid session'))
        .mockResolvedValue(1),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loginResponse()));
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    await expect(poke({ app: 'a', mark: 'm', json: {} })).resolves.toBe(1);
    expect(client.seamlessReset).not.toHaveBeenCalled();
  });

  test('retries a login that eyre rejected for a stale cookie', async () => {
    vi.useFakeTimers();
    const client = fakeClient({
      poke: vi
        .fn()
        .mockRejectedValueOnce(new AuthError('invalid session'))
        .mockResolvedValue(1),
    });
    const loginFetch = vi
      .fn()
      .mockResolvedValueOnce(loginResponse(401))
      .mockResolvedValueOnce(loginResponse(200));
    vi.stubGlobal('fetch', loginFetch);
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    const pending = poke({ app: 'a', mark: 'm', json: {} });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toBe(1);
    expect(loginFetch).toHaveBeenCalledTimes(2);
    expect(client.cookie).toBe('urbauth=refreshed');
  });

  test('a rejected access code logs out instead of retrying', async () => {
    const handleAuthFailure = vi.fn();
    const client = fakeClient({
      poke: vi.fn().mockRejectedValue(new AuthError('invalid session')),
    });
    const loginFetch = vi.fn().mockResolvedValue(loginResponse(400));
    vi.stubGlobal('fetch', loginFetch);
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      handleAuthFailure,
      client: client as any,
    });

    await expect(
      poke({ app: 'a', mark: 'm', json: {} })
    ).rejects.toBeInstanceOf(AuthError);
    expect(loginFetch).toHaveBeenCalledTimes(1);
    expect(handleAuthFailure).toHaveBeenCalledWith({ mustLogout: true });
    expect(client.seamlessReset).not.toHaveBeenCalled();
  });
});

describe('channel identity mismatch', () => {
  test('a 403 on the channel PUT rotates the channel and retries the poke', async () => {
    const client = fakeClient({
      poke: vi
        .fn()
        .mockRejectedValueOnce(new ChannelPutError(403))
        .mockResolvedValue(9),
    });
    const loginFetch = vi.fn();
    vi.stubGlobal('fetch', loginFetch);
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    await expect(
      poke({ app: 'activity', mark: 'activity-action-2', json: {} })
    ).resolves.toBe(9);
    expect(client.seamlessReset).toHaveBeenCalledTimes(1);
    // our session is fine; the channel was the problem, so no login
    expect(loginFetch).not.toHaveBeenCalled();
    expect(client.poke).toHaveBeenCalledTimes(2);
  });

  test('a 403 on a subscribe PUT rotates the channel and resubscribes', async () => {
    const client = fakeClient({
      subscribe: vi
        .fn()
        .mockRejectedValueOnce(new ChannelPutError(403))
        .mockResolvedValue(4),
    });
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    await expect(
      subscribe({ app: 'activity', path: '/v6' }, () => {})
    ).resolves.toBe(4);
    expect(client.seamlessReset).toHaveBeenCalledTimes(1);
    expect(client.subscribe).toHaveBeenCalledTimes(2);
  });

  test('other channel PUT failures surface without a rotation', async () => {
    const failure = new ChannelPutError(500);
    const client = fakeClient({ poke: vi.fn().mockRejectedValue(failure) });
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    await expect(poke({ app: 'a', mark: 'm', json: {} })).rejects.toBe(failure);
    expect(client.seamlessReset).not.toHaveBeenCalled();
    expect(client.poke).toHaveBeenCalledTimes(1);
  });

  test('the http-api client reports the channel PUT status', async () => {
    const fetch = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);
    urbit.nodeId = '~zod';

    await expect(
      urbit.poke({ app: 'a', mark: 'm', json: {} })
    ).rejects.toMatchObject({ name: 'ChannelPutError', status: 403 });
    expect(urbit.channelOpened).toBe(true);
  });

  test('a failed subscribe PUT is not replayed by a later channel reset', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);
    urbit.nodeId = '~zod';
    // pretend the SSE side is already up so a successful PUT stays a PUT
    (urbit as any).sseClientInitialized = true;

    await expect(
      urbit.subscribe({ app: 'a', path: '/p', event: () => {} })
    ).rejects.toMatchObject({ status: 403 });
    expect((urbit as any).outstandingSubscriptions.size).toBe(0);

    urbit.seamlessReset();
    // the reset had nothing to resubscribe; only the original PUT went out
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('seamlessReset', () => {
  test('aborts the old channel connection so its retry loop stops', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);
    urbit.nodeId = '~zod';
    (urbit as any).sseClientInitialized = true;
    await urbit.poke({ app: 'a', mark: 'm', json: {} }).catch(() => {});
    const oldSignal: AbortSignal = (fetch.mock.calls[0] as any)[1].signal;
    const oldChannel = urbit.channelId;

    urbit.seamlessReset();

    expect(oldSignal.aborted).toBe(true);
    expect(urbit.channelId).not.toBe(oldChannel);
    await urbit.poke({ app: 'a', mark: 'm', json: {} }).catch(() => {});
    const newSignal: AbortSignal = (fetch.mock.calls[1] as any)[1].signal;
    expect(newSignal.aborted).toBe(false);
  });
});

describe('AuthFailureError', () => {
  test('describes what each eyre status means', () => {
    expect(new AuthFailureError(400).message).toMatch(
      /access code was rejected/
    );
    expect(new AuthFailureError(401).message).toMatch(/stale session cookie/);
    expect(new AuthFailureError(500).message).toMatch(/Unexpected response/);
  });
});

describe('storms', () => {
  // several requests fail together when a channel dies; only the first one
  // back should rotate, the rest retry on the new channel
  function rotatingClient(overrides: Record<string, unknown> = {}) {
    const client: Record<string, any> = fakeClient({
      channelId: 'chan-1',
      ...overrides,
    });
    client.seamlessReset = vi.fn(() => {
      client.channelId = `chan-${client.seamlessReset.mock.calls.length + 1}`;
    });
    return client;
  }

  test('concurrent channel 403s rotate the channel once', async () => {
    const client = rotatingClient({
      poke: vi
        .fn()
        .mockRejectedValueOnce(new ChannelPutError(403))
        .mockRejectedValueOnce(new ChannelPutError(403))
        .mockRejectedValueOnce(new ChannelPutError(403))
        .mockResolvedValue(1),
    });
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    const pokes = [
      poke({ app: 'a', mark: 'm', json: 1 }),
      poke({ app: 'b', mark: 'm', json: 2 }),
      poke({ app: 'c', mark: 'm', json: 3 }),
    ];
    await expect(Promise.all(pokes)).resolves.toEqual([1, 1, 1]);
    expect(client.seamlessReset).toHaveBeenCalledTimes(1);
    expect(client.poke).toHaveBeenCalledTimes(6);
  });

  test('an auth failure that lands after a reauth retries without a second login', async () => {
    let calls = 0;
    const client = rotatingClient({
      poke: vi.fn(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new AuthError('invalid session'));
        }
        if (calls === 2) {
          // in flight while the first failure's reauth runs; comes back late
          return new Promise((_, reject) =>
            setTimeout(() => reject(new AuthError('invalid session')), 30)
          );
        }
        return Promise.resolve(calls);
      }),
    });
    const loginFetch = vi.fn().mockResolvedValue(loginResponse());
    vi.stubGlobal('fetch', loginFetch);
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    const pokes = [
      poke({ app: 'a', mark: 'm', json: 1 }),
      poke({ app: 'b', mark: 'm', json: 2 }),
    ];
    await expect(Promise.all(pokes)).resolves.toEqual([3, 4]);
    // the late failure saw the epoch move and just retried
    expect(loginFetch).toHaveBeenCalledTimes(1);
    expect(client.seamlessReset).toHaveBeenCalledTimes(1);
  });
});
