import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  internalConfigureClient,
  internalRemoveClient,
  scry,
  scryNoun,
} from '../client/urbit';
import { ThreadResponseBodyError, Urbit } from '../http-api/Urbit';

// Mimics real fetch behavior for a response whose headers arrive but whose
// body never completes: the returned stream only errors when the request's
// abort signal fires. Regression coverage for TLON-6148, where an un-timed
// body read left the create-group spinner hanging forever.
function stalledBodyFetch(status = 200): typeof fetch {
  return async (_input: any, init?: any) => {
    const stream = new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => {
          controller.error(
            new DOMException('The operation was aborted.', 'AbortError')
          );
        });
      },
    });
    return new Response(stream, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

// Stalls only the scry itself, so tearing the client down (which POSTs a
// channel delete) doesn't hit the stalled response too.
function stalledScryFetch(status: number): typeof fetch {
  const stalled = stalledBodyFetch(status);
  return async (input: any, init?: any) =>
    String(input).includes('/~/scry/')
      ? stalled(input, init)
      : new Response('', { status: 200 });
}

function completingFetch(body: string): typeof fetch {
  return async () =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
}

describe('Urbit request timeouts cover the response body read', () => {
  it('thread rejects when the response body stalls after headers', async () => {
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch());
    await expect(
      client.thread({
        inputMark: 'group-create-thread',
        outputMark: 'group-ui-2',
        threadName: 'group-create-1',
        body: {},
        timeout: 50,
      })
    ).rejects.toBeInstanceOf(ThreadResponseBodyError);
  });

  it('thread resolves with a readable response when the body completes', async () => {
    const client = new Urbit(
      '',
      undefined,
      'groups',
      completingFetch('{"ok":true}')
    );
    const response = await client.thread({
      inputMark: 'group-create-thread',
      outputMark: 'group-ui-2',
      threadName: 'group-create-1',
      body: {},
      timeout: 1000,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('thread preserves an error status when the error body stalls', async () => {
    // A stalled body on a non-OK response must not surface as a transport
    // error: callers distinguish backend failures from lost responses by
    // status, and the status already arrived with the headers.
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch(500));
    const response = await client.thread({
      inputMark: 'group-create-thread',
      outputMark: 'group-ui-2',
      threadName: 'group-create-1',
      body: {},
      timeout: 50,
    });
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('');
  });

  it('thread preserves non-UTF-8 body bytes when buffering', async () => {
    // includes bytes that are invalid UTF-8 and would be corrupted by a
    // text() decode/re-encode round trip
    const bytes = new Uint8Array([0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28]);
    const fetchFn: typeof fetch = async () =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'application/x-urb-jam' },
      });
    const client = new Urbit('', undefined, 'groups', fetchFn);
    const response = await client.thread({
      inputMark: 'noun',
      outputMark: 'noun',
      threadName: 'some-thread',
      body: {},
      timeout: 1000,
    });
    const buffer = await response.arrayBuffer();
    expect(new Uint8Array(buffer)).toEqual(bytes);
  });

  it('scry rejects when the response body stalls after headers', async () => {
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch());
    await expect(
      client.scry({ app: 'groups', path: '/v3/groups', timeout: 50 })
    ).rejects.toThrow();
  });

  it('request rejects when the response body stalls after headers', async () => {
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch());
    await expect(client.request('/some/path', {}, 50)).rejects.toThrow();
  });
});

describe('the client wrapper bounds its diagnostic error-body read', () => {
  afterEach(() => {
    internalRemoveClient();
    vi.useRealTimers();
  });

  // The status arrives with the headers, but `scryWithInfo` disarms the
  // request's timeout in its `finally` before the rejection reaches the
  // wrapper -- so reading the body for the error message has to carry its own
  // deadline, or a stalled error body hangs a scry that has already failed.
  function configureStalledClient(status: number) {
    vi.useFakeTimers();
    internalConfigureClient({
      shipName: '~zod',
      shipUrl: '',
      client: new Urbit('', undefined, 'groups', stalledScryFetch(status)),
    });
  }

  it('scry rejects with the status when the error body stalls', async () => {
    configureStalledClient(503);

    const rejection = scry({
      app: 'groups',
      path: '/v3/groups',
      timeout: 10,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(rejection).resolves.toMatchObject({
      status: 503,
      message: 'HTTP 503',
    });
  });

  it('scryNoun rejects with the status when the error body stalls', async () => {
    configureStalledClient(504);

    const rejection = scryNoun({
      app: 'lanyard',
      path: '/v1/records',
      timeout: 10,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(rejection).resolves.toMatchObject({
      status: 504,
      message: 'HTTP 504',
    });
  });
});
