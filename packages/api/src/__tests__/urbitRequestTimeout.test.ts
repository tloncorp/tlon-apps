import { describe, expect, it } from 'vitest';

import { Urbit } from '../http-api/Urbit';

// Mimics real fetch behavior for a response whose headers arrive but whose
// body never completes: the returned stream only errors when the request's
// abort signal fires. Regression coverage for TLON-6148, where an un-timed
// body read left the create-group spinner hanging forever.
function stalledBodyFetch(): typeof fetch {
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
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
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
    ).rejects.toThrow();
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

  it('scry rejects when the response body stalls after headers', async () => {
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch());
    await expect(
      client.scry({ app: 'groups', path: '/v2/ui/groups', timeout: 50 })
    ).rejects.toThrow();
  });

  it('request rejects when the response body stalls after headers', async () => {
    const client = new Urbit('', undefined, 'groups', stalledBodyFetch());
    await expect(client.request('/some/path', {}, 50)).rejects.toThrow();
  });
});
