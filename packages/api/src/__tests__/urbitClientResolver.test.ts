import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BadResponseError,
  poke,
  requestJson,
  scry,
  setClientResolver,
} from '../client/urbit';
import { AuthError, type Urbit } from '../http-api';

afterEach(() => {
  setClientResolver(null);
});

describe('client resolver', () => {
  test('routes an operation through the resolved client', async () => {
    const scopedClient = {
      poke: vi.fn().mockResolvedValue(7),
      requestJson: vi.fn().mockResolvedValue({ ok: true }),
      scryWithInfo: vi.fn().mockResolvedValue({
        result: { ship: '~zod' },
        responseSizeInBytes: 0,
        responseStatus: 200,
      }),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).resolves.toBe(
      7
    );
    await expect(scry({ app: 'contacts', path: '/v1/self' })).resolves.toEqual({
      ship: '~zod',
    });
    await expect(requestJson('/notes', 'GET')).resolves.toEqual({ ok: true });
  });

  test('does not run singleton reauthentication for a scoped client', async () => {
    const rejection = Object.assign(new Error('forbidden'), { status: 403 });
    const scopedClient = {
      requestJson: vi.fn().mockRejectedValue(rejection),
    };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(requestJson('/notes', 'GET')).rejects.toEqual(
      expect.objectContaining<Partial<BadResponseError>>({ status: 403 })
    );
    expect(scopedClient.requestJson).toHaveBeenCalledTimes(1);
  });

  test('does not run singleton reauthentication for a scoped poke', async () => {
    const rejection = new AuthError('forbidden');
    const scopedClient = { poke: vi.fn().mockRejectedValue(rejection) };
    setClientResolver(() => scopedClient as unknown as Urbit);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).rejects.toBe(
      rejection
    );
    expect(scopedClient.poke).toHaveBeenCalledOnce();
  });

  test('an empty scope does not fall through to the configured client', async () => {
    setClientResolver(() => null);

    await expect(poke({ app: 'chat', mark: 'test', json: {} })).rejects.toThrow(
      'Client not initialized'
    );
  });
});
