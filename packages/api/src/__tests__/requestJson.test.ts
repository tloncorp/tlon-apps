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
