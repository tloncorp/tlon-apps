import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchEventSource } from '../http-api/fetch-event-source/fetch';
import { getBytes } from '../http-api/fetch-event-source/parse';

const eventStreamResponse = (body: ReadableStream<Uint8Array>, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchEventSource cancellation and retry ownership', () => {
  test('does not fetch when the input signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn();

    await fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      fetch: fetchFn,
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('does not retry when onerror aborts the input signal', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
      onerror: () => controller.abort(),
    });

    await vi.advanceTimersByTimeAsync(0);
    await expect(eventSource).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('an abort prevents a retry that was already armed', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
      onerror: () => 1_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(eventSource).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('an abort clears the header timer even when fetch ignores its signal', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi.fn(() => new Promise<Response>(() => {}));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
    });

    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    await expect(eventSource).resolves.toBeUndefined();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('preserves retry behavior while the input signal remains live', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
      onerror: () => 1_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    controller.abort();
    await expect(eventSource).resolves.toBeUndefined();
  });

  test('clears the header timer after a response opens', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const fetchFn = vi.fn().mockResolvedValue(eventStreamResponse(stream));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
    });

    await vi.advanceTimersByTimeAsync(0);
    // The body reader owns one timer. The completed header race owns none.
    expect(vi.getTimerCount()).toBe(1);

    controller.abort();
    await expect(eventSource).resolves.toBeUndefined();
  });

  test('an abort clears a pending body-read timer', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi.fn((_url: unknown, options?: RequestInit) => {
      const requestSignal = options?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          requestSignal?.addEventListener(
            'abort',
            () =>
              streamController.error(new DOMException('aborted', 'AbortError')),
            { once: true }
          );
        },
      });
      return Promise.resolve(eventStreamResponse(stream));
    });
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    await expect(eventSource).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
  });

  test('clears every completed body-read timer', async () => {
    vi.useFakeTimers();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.enqueue(new Uint8Array([2]));
        controller.close();
      },
    });
    const chunks: number[][] = [];

    await getBytes(stream, (chunk) => chunks.push([...chunk]), 25_000);

    expect(chunks).toEqual([[1], [2]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a 404 can abort from onerror without hanging or retrying', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const eventSource = fetchEventSource('http://example.test/events', {
      signal: controller.signal,
      responseTimeout: 25_000,
      fetch: fetchFn,
      onerror: () => controller.abort(),
    });

    await expect(eventSource).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
