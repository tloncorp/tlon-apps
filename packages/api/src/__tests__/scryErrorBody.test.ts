import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BadResponseError,
  internalConfigureClient,
  internalRemoveClient,
  scry,
  scryNoun,
} from '../client/urbit';

// The airlock rejects a failed scry with the `Response` itself, whose
// `toString()` is the literal `[object Response]`. These cover the message the
// wrapper builds from it (JAVASCRIPT-REACT-1M and friends).
function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    delete: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

function configure(client: Record<string, unknown>) {
  internalConfigureClient({
    shipName: '~zod',
    shipUrl: 'http://example.test',
    client: client as any,
  });
}

afterEach(() => {
  internalRemoveClient();
});

describe('scry error bodies', () => {
  test('a failed scry reports the status and the response body', async () => {
    configure(
      fakeClient({
        scryWithInfo: vi
          .fn()
          .mockRejectedValue(
            new Response('gall: agent not running', { status: 503 })
          ),
      })
    );

    const rejection = (await scry({
      app: 'groups',
      path: '/v1/groups',
    }).catch((e) => e)) as BadResponseError;

    expect(rejection).toBeInstanceOf(BadResponseError);
    expect(rejection.message).toBe('HTTP 503: gall: agent not running');
    expect(rejection.message).not.toContain('[object Response]');
    expect(rejection.status).toBe(503);
  });

  test('a failed scryNoun reports the status and the response body', async () => {
    configure(
      fakeClient({
        scryNounWithInfo: vi
          .fn()
          .mockRejectedValue(new Response('no such path', { status: 404 })),
      })
    );

    const rejection = (await scryNoun({
      app: 'lanyard',
      path: '/v1/records',
    }).catch((e) => e)) as BadResponseError;

    expect(rejection).toBeInstanceOf(BadResponseError);
    expect(rejection.message).toBe('HTTP 404: no such path');
    expect(rejection.message).not.toContain('[object Response]');
    expect(rejection.status).toBe(404);
  });

  test('an empty error body leaves the status as the whole message', async () => {
    configure(
      fakeClient({
        scryWithInfo: vi
          .fn()
          .mockRejectedValue(new Response('', { status: 502 })),
      })
    );

    await expect(
      scry({ app: 'groups', path: '/v1/groups' })
    ).rejects.toMatchObject({ status: 502, message: 'HTTP 502' });
  });
});
