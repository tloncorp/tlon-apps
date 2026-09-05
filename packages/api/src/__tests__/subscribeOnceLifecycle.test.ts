import { afterEach, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';

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
  return { client, initialPut, unsubscribe };
}

afterEach(() => {
  vi.useRealTimers();
});

test.each(['before', 'after'] as const)(
  'cancellation %s the PUT finishes cannot unsubscribe a replacement channel subscription',
  async (timing) => {
    const { client, initialPut, unsubscribe } = setup();
    const once = client.subscribeOnce('a', '/once', undefined, 1000).catch((e) => e);
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
    expect((client as any).outstandingSubscriptions.get(replacementId)?.path).toBe(
      '/live'
    );
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
  const once = client.subscribeOnce('a', '/once', undefined, 1000).catch((e) => e);
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
  const once = client.subscribeOnce('a', '/once', undefined, 1000).catch((e) => e);
  const entry = (client as any).outstandingSubscriptions.get(1);
  initialPut.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(1000);
  await expect(once).resolves.toBe('timeout');
  entry.event('late', 'm', 1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledWith(1);
});
