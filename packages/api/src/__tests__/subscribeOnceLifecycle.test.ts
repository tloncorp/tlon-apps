import { afterEach, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';
import type { SubscriptionRequestInterface } from '../http-api';

type ClientState = {
  sseClientInitialized: boolean;
  outstandingSubscriptions: Map<number, SubscriptionRequestInterface>;
};

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
  vi.useFakeTimers();
  const initialPut = deferred<Response>();
  const fetch = vi
    .fn()
    .mockReturnValueOnce(initialPut.promise)
    .mockImplementation(async () => new Response(null, { status: 204 }));
  const client = new Urbit('http://example.test', undefined, undefined, fetch);
  (client as any).sseClientInitialized = true;
  const unsubscribe = vi.spyOn(client, 'unsubscribe');
  return {
    client,
    initialPut,
    unsubscribe,
    state: client as unknown as ClientState,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

test.each(['before', 'after'] as const)(
  'cancellation %s the PUT finishes cannot unsubscribe a replacement channel subscription',
  async (timing) => {
    const { client, initialPut, unsubscribe } = setup();
    const once = client
      .subscribeOnce('a', '/once', undefined, 1000)
      .catch((e) => e);
    if (timing === 'after') {
      initialPut.resolve(new Response(null, { status: 204 }));
      await vi.advanceTimersByTimeAsync(0);
    }

    client.seamlessReset();
    await expect(once).resolves.toBe('quit');
    (client as any).sseClientInitialized = true;
    const replacementId = await client.subscribe({
      app: 'a',
      path: '/live',
      event: () => {},
    });
    expect(replacementId).toBe(1);
    if (timing === 'before') {
      initialPut.resolve(new Response(null, { status: 204 }));
      await vi.advanceTimersByTimeAsync(0);
    }

    await vi.advanceTimersByTimeAsync(1000);
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(
      (client as any).outstandingSubscriptions.get(replacementId)?.path
    ).toBe('/live');
  }
);

test('the first fact settles once and prevents a late PUT from scheduling a timeout', async () => {
  const { client, initialPut, unsubscribe } = setup();
  const once = client.subscribeOnce<string>('a', '/once', undefined, 1000);
  const entry = (client as any).outstandingSubscriptions.get(1);
  entry.event('first', 'm', 1);
  entry.event('second', 'm', 1);
  await expect(once).resolves.toBe('first');
  initialPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(1000);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledWith(1);
});

test('a failed PUT rejects the one-shot instead of leaving it pending', async () => {
  const { client, initialPut, unsubscribe } = setup();
  const failure = new Error('PUT failed');
  let outcome: unknown;
  void client.subscribeOnce('a', '/once', undefined, 1000).catch((e) => {
    outcome = e;
  });
  initialPut.reject(failure);
  await vi.advanceTimersByTimeAsync(1000);
  expect(outcome).toBe(failure);
  expect(unsubscribe).not.toHaveBeenCalled();
});

test('a subscription error cancels its already scheduled timeout', async () => {
  const { client, initialPut, unsubscribe } = setup();
  const once = client
    .subscribeOnce('a', '/once', undefined, 1000)
    .catch((e) => e);
  const entry = (client as any).outstandingSubscriptions.get(1);
  initialPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(0);
  entry.err('watch failed');
  await expect(once).resolves.toBe('watch failed');
  await vi.advanceTimersByTimeAsync(1000);
  expect(unsubscribe).not.toHaveBeenCalled();
});

test('an unanswered one-shot still times out and unsubscribes once', async () => {
  const { client, initialPut, unsubscribe } = setup();
  const once = client
    .subscribeOnce('a', '/once', undefined, 1000)
    .catch((e) => e);
  const entry = (client as any).outstandingSubscriptions.get(1);
  initialPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(1000);
  await expect(once).resolves.toBe('timeout');
  entry.event('late', 'm', 1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledWith(1);
});

test('an abort while the watch PUT is pending removes its handlers immediately', async () => {
  const { client, initialPut, unsubscribe, state } = setup();
  const controller = new AbortController();
  const failure = new Error('cancelled');
  const once = client
    .subscribeOnce('a', '/once', undefined, 1000, controller.signal)
    .catch((error) => error);
  controller.abort(failure);
  expect(await once).toBe(failure);
  expect(state.outstandingSubscriptions.size).toBe(0);
  initialPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(1000);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('a late unsubscribe PUT cannot delete an id reused after a channel reset', async () => {
  vi.useFakeTimers();
  const unsubPut = deferred<Response>();
  const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (String(options?.body).includes('"action":"unsubscribe"')) {
      return unsubPut.promise;
    }
    return new Response(null, { status: 204 });
  });
  const client = new Urbit('http://example.test', undefined, undefined, fetch);
  const state = client as unknown as ClientState;
  state.sseClientInitialized = true;
  const once = client.subscribeOnce('a', '/once', undefined, 1000);
  const entry = state.outstandingSubscriptions.get(1)!;
  entry.event?.('result', 'm', 1);
  await expect(once).resolves.toBe('result');
  client.seamlessReset();
  state.sseClientInitialized = true;
  const id = await client.subscribe({ app: 'a', path: '/live' });
  expect(id).toBe(1);
  unsubPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(0);
  expect(state.outstandingSubscriptions.get(id)?.path).toBe('/live');
});
