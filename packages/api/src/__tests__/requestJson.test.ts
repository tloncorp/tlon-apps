import { describe, expect, test, vi } from 'vitest';

import { Urbit } from '../http-api/Urbit';

describe('Urbit.requestJson', () => {
  test('returns parsed JSON for a successful JSON response', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}'));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/notes/~/v1/notebooks')).resolves.toEqual({
      ok: true,
    });
  });

  test('returns undefined for successful empty responses', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(
      urbit.requestJson('/notes/~/v1/notebooks/~zod/blog/notes/12', 'DELETE')
    ).resolves.toBeUndefined();
  });

  test('rejects non-OK responses without parsing their body', async () => {
    const response = new Response('not found', { status: 404 });
    const fetch = vi.fn(async () => response);
    const urbit = new Urbit('http://example.test', undefined, undefined, fetch);

    await expect(urbit.requestJson('/missing', 'GET')).rejects.toBe(response);
  });
});
