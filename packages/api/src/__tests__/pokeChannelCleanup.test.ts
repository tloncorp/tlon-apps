import { afterEach, expect, test, vi } from 'vitest';

import {
  internalConfigureClient,
  internalRemoveClient,
  poke,
} from '../client/urbit';
import { ReapError } from '../http-api';
import { Urbit } from '../http-api/Urbit';
import type { FetchEventSourceInit } from '../http-api/fetch-event-source';

const streams = vi.hoisted(() => {
  vi.resetModules();
  return [] as { url: string; options: FetchEventSourceInit }[];
});

vi.mock('../http-api/fetch-event-source', () => ({
  fetchEventSource: vi.fn((url: string, options: FetchEventSourceInit) => {
    streams.push({ url, options });
    void options.onopen?.(new Response(null, { status: 200 }), false);
    return new Promise<void>(() => {});
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}

afterEach(() => {
  internalRemoveClient();
  vi.useRealTimers();
  streams.length = 0;
});

test('a late old-channel PUT preserves the replacement poke acknowledgement handler', async () => {
  vi.useFakeTimers();
  const oldFirst = deferred<Response>();
  const oldSecond = deferred<Response>();
  const retry = deferred<Response>();
  let puts = 0;
  const fetch = vi.fn((_url: unknown, options?: RequestInit) =>
    options?.method === 'PUT'
      ? [oldFirst.promise, oldSecond.promise, retry.promise][puts++]
      : Promise.resolve(new Response('~sampel-palnet', { status: 200 }))
  );
  const client = new Urbit('http://example.test', undefined, undefined, fetch);
  internalConfigureClient({
    shipName: '~sampel-palnet',
    shipUrl: client.url,
    client,
    getCode: async () => 'code',
  });
  (client as any).sseClientInitialized = true;
  const originalChannel = client.channelId;
  const first = poke({ app: 'a', mark: 'm', json: 1 }).catch((e) => e);
  const second = poke({ app: 'a', mark: 'm', json: 2 }).catch((e) => e);

  // The second poke's 403 rotates the channel. The first is swept with a
  // ReapError, while the second retries using id 1 on the replacement channel.
  oldSecond.resolve(new Response(null, { status: 403 }));
  await vi.advanceTimersByTimeAsync(0);
  expect(await first).toBeInstanceOf(ReapError);
  expect(client.channelId).not.toBe(originalChannel);
  expect(puts).toBe(3);
  retry.resolve(new Response(null, { status: 204 }));
  await vi.advanceTimersByTimeAsync(0);
  expect(streams).toHaveLength(1);

  // The first poke's late failure must not remove the retry's handler just
  // because both requests used id 1. Deliver a real acknowledgement event.
  oldFirst.resolve(new Response(null, { status: 403 }));
  await vi.advanceTimersByTimeAsync(0);
  streams[0].options.onmessage?.({
    id: '1',
    event: '',
    data: JSON.stringify({ id: 1, response: 'poke', ok: 'ok' }),
  });
  await vi.advanceTimersByTimeAsync(30000);
  expect(await second).toBe(1);
});
