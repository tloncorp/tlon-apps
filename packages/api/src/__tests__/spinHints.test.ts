import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  ReapError,
  SSETimeoutError,
  SpinAbortedError,
  SpinClosedError,
} from '../http-api';
import { Urbit } from '../http-api/Urbit';

const encoder = new TextEncoder();

function streamResponse(...messages: string[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const message of messages) {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        }
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Urbit.getSpinHints', () => {
  test('returns the first hint and aborts the request', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: unknown, options?: RequestInit) => {
      requestSignal = options?.signal ?? undefined;
      return Promise.resolve(streamResponse('/root', '/second'));
    });
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );

    await expect(client.getSpinHints()).resolves.toBe('/root');

    expect(requestSignal?.aborted).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('rejects a transport failure once and does not retry', async () => {
    vi.useFakeTimers();
    const error = new TypeError('offline');
    const fetchFn = vi.fn().mockRejectedValue(error);
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );
    const result = client.getSpinHints();

    await expect(result).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects the header timeout once and does not retry', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(() => new Promise<Response>(() => {}));
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );
    const result = expect(client.getSpinHints()).rejects.toBeInstanceOf(
      SSETimeoutError
    );

    await vi.advanceTimersByTimeAsync(25_000);
    await result;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects a 404 as a ReapError without retrying', async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );

    await expect(client.getSpinHints()).rejects.toBeInstanceOf(ReapError);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('rejects a non-SSE response without retrying', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('<html></html>', {
        headers: { 'content-type': 'text/html' },
      })
    );
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );

    await expect(client.getSpinHints()).rejects.toThrow(
      'Expected content-type to be text/event-stream'
    );
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('rejects a clean close before the first message', async () => {
    const fetchFn = vi.fn().mockResolvedValue(streamResponse());
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );

    await expect(client.getSpinHints()).rejects.toBeInstanceOf(SpinClosedError);
  });

  test('honors a caller abort before starting', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn();
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );

    await expect(
      client.getSpinHints({ signal: controller.signal })
    ).rejects.toBeInstanceOf(SpinAbortedError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('honors a caller abort while the request is pending', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: unknown, options?: RequestInit) => {
      requestSignal = options?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      });
    });
    const client = new Urbit(
      'http://example.test',
      undefined,
      undefined,
      fetchFn
    );
    const controller = new AbortController();
    const result = client.getSpinHints({ signal: controller.signal });

    controller.abort();

    await expect(result).rejects.toBeInstanceOf(SpinAbortedError);
    expect(requestSignal?.aborted).toBe(true);
  });
});
