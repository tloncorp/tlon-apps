import { afterEach, describe, expect, it, vi } from 'vitest';

import { BadResponseError, configureClient, internalRemoveClient, scry } from '../client/urbit';
import { Urbit } from '../http-api';

describe('scry operations', () => {
  afterEach(() => {
    internalRemoveClient();
    vi.restoreAllMocks();
  });

  it('returns result from scryWithInfo', async () => {
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(Urbit.prototype, 'scryWithInfo').mockResolvedValue({
      result: { app: 'hood' },
      responseSizeInBytes: 42,
      responseStatus: 200,
    });

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    const result = await scry<{ app: string }>({
      app: 'hood',
      path: '/kiln/pikes',
    });

    expect(result).toEqual({ app: 'hood' });
  });

  it('throws BadResponseError for non-403 failures', async () => {
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(Urbit.prototype, 'scryWithInfo').mockRejectedValue({
      status: 500,
      message: 'server error',
      toString: () => 'server error',
    });

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    await expect(
      scry({ app: 'contacts', path: '/all' })
    ).rejects.toBeInstanceOf(BadResponseError);
  });
});
