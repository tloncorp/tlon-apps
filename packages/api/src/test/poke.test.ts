import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { poke, configureClient, internalRemoveClient } from '../client/urbit';
import { AuthError, Urbit } from '../http-api';

describe('poke operations', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    internalRemoveClient();
    vi.restoreAllMocks();
  });

  it('pokes successfully when underlying client poke resolves', async () => {
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
    const pokeSpy = vi.spyOn(Urbit.prototype, 'poke').mockResolvedValue(undefined as never);

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    await expect(
      poke({
        app: 'hood',
        mark: 'helm-hi',
        json: 'test from @tloncorp/api',
      })
    ).resolves.toBeUndefined();

    expect(pokeSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-auth errors from poke', async () => {
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(Urbit.prototype, 'poke').mockRejectedValue(new Error('poke failed'));

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    await expect(
      poke({
        app: 'hood',
        mark: 'helm-hi',
        json: 'test from @tloncorp/api',
      })
    ).rejects.toThrow('poke failed');
  });

  it('fails auth recovery when no getCode handler is configured', async () => {
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
    vi.spyOn(Urbit.prototype, 'poke').mockRejectedValue(new AuthError('expired auth'));

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    await expect(
      poke({
        app: 'hood',
        mark: 'helm-hi',
        json: 'test from @tloncorp/api',
      })
    ).rejects.toThrow('Unable to authenticate with urbit');
  });
});
