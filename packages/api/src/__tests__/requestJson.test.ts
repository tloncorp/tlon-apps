import { describe, expect, test, vi } from 'vitest';

import {
  BadResponseError,
  internalConfigureClient,
  internalRemoveClient,
  requestJson,
} from '../client/urbit';
import { Urbit } from '../http-api/Urbit';

describe('Urbit.requestJson', () => {
  test('returns parsed JSON for a successful JSON response', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}'));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/api/items')).resolves.toEqual({
      ok: true,
    });
  });

  test('returns undefined for successful empty responses', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(
      urbit.requestJson('/api/items/12', 'DELETE')
    ).resolves.toBeUndefined();
  });

  test('rejects non-OK responses without parsing their body', async () => {
    const response = new Response('not found', { status: 404 });
    const fetch = vi.fn(async () => response);
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/missing', 'GET')).rejects.toBe(response);
  });
});

describe('client requestJson wrapper', () => {
  test.each([401, 403])(
    'can opt into one %i reauth and replay a POST body',
    async (status) => {
      const path = '/notes/~/v1/import';
      const method = 'POST';
      const body = {
        notebooks: [
          { title: 'Imported Notes', description: 'Keep this on replay' },
        ],
      };
      const client = {
        requestJson: vi
          .fn()
          .mockRejectedValueOnce(new Response('', { status }))
          .mockResolvedValueOnce({ ok: true }),
        cookie: 'urbauth=old',
        delete: vi.fn(),
        on: vi.fn(),
      };
      const loginFetch = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: { 'set-cookie': 'urbauth=refreshed; Path=/' },
        })
      );
      vi.stubGlobal('fetch', loginFetch);

      internalConfigureClient({
        shipName: '~zod',
        shipUrl: 'http://example.test',
        getCode: vi.fn(async () => 'code'),
        client: client as any,
      });

      try {
        await expect(
          requestJson(path, method, body, {
            reauthStatuses: [401, 403],
          })
        ).resolves.toEqual({ ok: true });
        expect(client.requestJson).toHaveBeenCalledTimes(2);
        expect(client.requestJson).toHaveBeenNthCalledWith(
          1,
          path,
          method,
          body
        );
        expect(client.requestJson).toHaveBeenNthCalledWith(
          2,
          path,
          method,
          body
        );
        expect(client.cookie).toBe('urbauth=refreshed');
      } finally {
        vi.unstubAllGlobals();
        internalRemoveClient();
      }
    }
  );

  test('a persistent auth failure surfaces the raw Response after exactly one replay', async () => {
    const rejection = new Response('', { status: 401 });
    const client = {
      requestJson: vi.fn().mockRejectedValue(rejection),
      cookie: 'urbauth=old',
      delete: vi.fn(),
      on: vi.fn(),
    };
    const loginFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'set-cookie': 'urbauth=refreshed; Path=/' },
      })
    );
    vi.stubGlobal('fetch', loginFetch);

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      getCode: vi.fn(async () => 'code'),
      client: client as any,
    });

    try {
      // The post-reauth retry is deliberately not wrapped in BadResponseError.
      await expect(
        requestJson('/notes/~/v1', 'POST', {}, { reauthStatuses: [401, 403] })
      ).rejects.toBe(rejection);
      expect(client.requestJson).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      internalRemoveClient();
    }
  });

  test('turns blank HTTP failures into a nonblank BadResponseError message', async () => {
    const client = {
      requestJson: vi.fn(async () => {
        throw new Response('', { status: 404 });
      }),
      delete: vi.fn(),
      on: vi.fn(),
    };

    internalConfigureClient({
      shipName: '~zod',
      shipUrl: 'http://example.test',
      client: client as any,
    });

    try {
      await expect(requestJson('/missing', 'GET')).rejects.toMatchObject({
        status: 404,
        body: '',
        message: 'HTTP 404',
      });
      await expect(requestJson('/missing', 'GET')).rejects.toBeInstanceOf(
        BadResponseError
      );
    } finally {
      internalRemoveClient();
    }
  });
});
