import { afterEach, describe, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';
import {
  internalConfigureClient,
  internalRemoveClient,
  startSpinHintCheck,
} from './urbit';
import { fetchChangesSince } from './changesApi';

const emptyChanges = {
  groups: {},
  channels: {},
  chat: {},
  contacts: {},
  activity: {},
};

function configureClient(fetchFn: typeof fetch) {
  const client = new Urbit(
    'http://example.test',
    undefined,
    undefined,
    fetchFn
  );
  internalConfigureClient({
    shipName: '~sampel-palnet',
    shipUrl: client.url,
    client,
  });
  return client;
}

afterEach(() => {
  internalRemoveClient();
  vi.useRealTimers();
});

describe('spin hint integration', () => {
  test('grace expiry aborts the real spin request and cannot arm a retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let spinSignal: AbortSignal | undefined;
    let spinFetches = 0;
    const fetchFn = vi.fn((url: RequestInfo | URL, options?: RequestInit) => {
      const value = String(url);
      if (value.endsWith('/~_~/spin')) {
        spinFetches += 1;
        spinSignal = options?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          spinSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true }
          );
        });
      }
      if (value.includes('/~/scry/groups-ui/v11/changes/')) {
        return new Promise<Response>((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify(emptyChanges), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                })
              ),
            100
          );
        });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    configureClient(fetchFn);

    const resultPromise = fetchChangesSince(0);
    await vi.advanceTimersByTimeAsync(599);
    let settled = false;
    void resultPromise.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toMatchObject({
      nodeBusyStatus: 'unknown',
      spinOutcome: 'grace_expired',
      spinDurationMs: 600,
    });
    expect(spinSignal?.aborted).toBe(true);
    expect(spinFetches).toBe(1);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(spinFetches).toBe(1);
  });

  test('converts a real spin transport error to an advisory result', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn((_url: RequestInfo | URL, options?: RequestInit) =>
      options?.method === 'POST'
        ? Promise.resolve(new Response(null, { status: 204 }))
        : Promise.reject(new TypeError('offline'))
    );
    configureClient(fetchFn);

    await expect(startSpinHintCheck().settleWithin(500)).resolves.toMatchObject(
      {
        outcome: 'failed',
        nodeBusyStatus: 'unknown',
        errorClass: 'transport',
      }
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('a changes failure aborts the real spin request without a later retry', async () => {
    vi.useFakeTimers();
    let spinSignal: AbortSignal | undefined;
    let spinFetches = 0;
    const fetchFn = vi.fn((url: RequestInfo | URL, options?: RequestInit) => {
      const value = String(url);
      if (value.endsWith('/~_~/spin')) {
        spinFetches += 1;
        spinSignal = options?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          spinSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true }
          );
        });
      }
      if (value.includes('/~/scry/groups-ui/v11/changes/')) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    configureClient(fetchFn);

    await expect(fetchChangesSince(0)).rejects.toThrow('HTTP 500');
    expect(spinSignal?.aborted).toBe(true);
    expect(spinFetches).toBe(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(spinFetches).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([
    {
      name: '404',
      response: () => new Response(null, { status: 404 }),
      errorClass: 'http_4xx',
    },
    {
      name: '503',
      response: () => new Response(null, { status: 503 }),
      errorClass: 'http_5xx',
    },
    {
      name: 'HTML',
      response: () =>
        new Response('<html></html>', {
          headers: { 'content-type': 'text/html' },
        }),
      errorClass: 'content_type',
    },
    {
      name: 'empty stream close',
      response: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } }
        ),
      errorClass: 'closed',
    },
  ])('classifies a $name spin failure', async ({ response, errorClass }) => {
    const fetchFn = vi.fn((_url: RequestInfo | URL, options?: RequestInit) =>
      options?.method === 'POST'
        ? Promise.resolve(new Response(null, { status: 204 }))
        : Promise.resolve(response())
    );
    configureClient(fetchFn);

    await expect(startSpinHintCheck().settleWithin(500)).resolves.toMatchObject(
      {
        outcome: 'failed',
        nodeBusyStatus: 'unknown',
        errorClass,
      }
    );
  });

  test('keeps grace_expired latched after abort cleanup settles', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fetchFn = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      const signal = options?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true }
        );
      });
    });
    configureClient(fetchFn);
    const spin = startSpinHintCheck();
    const firstResult = spin.settleWithin(500);

    await vi.advanceTimersByTimeAsync(500);
    const expected = {
      outcome: 'grace_expired',
      nodeBusyStatus: 'unknown',
      durationMs: 500,
    };
    await expect(firstResult).resolves.toEqual(expected);
    await vi.advanceTimersByTimeAsync(0);
    await expect(spin.settleWithin(500)).resolves.toEqual(expected);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('classifies the spin response timeout without retrying', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn((_url: RequestInfo | URL, options?: RequestInit) =>
      options?.method === 'POST'
        ? Promise.resolve(new Response(null, { status: 204 }))
        : new Promise<Response>(() => {})
    );
    configureClient(fetchFn);
    const result = startSpinHintCheck().settleWithin(30_000);

    await vi.advanceTimersByTimeAsync(25_000);
    await expect(result).resolves.toMatchObject({
      outcome: 'failed',
      nodeBusyStatus: 'unknown',
      errorClass: 'timeout',
      durationMs: 25_000,
    });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('returns unavailable without a configured client', async () => {
    internalRemoveClient();

    await expect(startSpinHintCheck().settleWithin(500)).resolves.toEqual({
      outcome: 'unavailable',
      nodeBusyStatus: 'unknown',
      durationMs: 0,
    });
  });
});
