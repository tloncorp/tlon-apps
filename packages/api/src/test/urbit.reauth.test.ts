import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { client, configureClient, internalRemoveClient, poke, scry } from '../client/urbit';
import { AuthError, Urbit } from '../http-api';
import { getLandscapeAuthCookie } from '../lib/auth';

vi.mock('../lib/auth', () => ({
  getLandscapeAuthCookie: vi.fn(),
}));

describe('urbit reauth behavior', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Urbit.prototype, 'delete').mockResolvedValue(undefined);
  });

  afterEach(() => {
    internalRemoveClient();
    vi.restoreAllMocks();
  });

  it('retries poke after auth failure and applies refreshed cookie', async () => {
    const getCookieMock = vi.mocked(getLandscapeAuthCookie);
    getCookieMock.mockResolvedValue('urbauth-~zod=abc123');

    const pokeSpy = vi.spyOn(Urbit.prototype, 'poke');
    pokeSpy.mockRejectedValueOnce(new AuthError('expired auth'));
    pokeSpy.mockResolvedValueOnce(undefined as never);

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
      getCode: async () => 'lidlut-tabwed',
    });

    await poke({ app: 'hood', mark: 'helm-hi', json: 'test' });

    expect(pokeSpy).toHaveBeenCalledTimes(2);
    expect(getCookieMock).toHaveBeenCalledWith(
      'http://localhost:8080',
      'lidlut-tabwed'
    );
    expect((client as unknown as { cookie?: string }).cookie).toBe(
      'urbauth-~zod=abc123'
    );
  });

  it('throws when reauth is required but no getCode handler is configured', async () => {
    const pokeSpy = vi.spyOn(Urbit.prototype, 'poke');
    pokeSpy.mockRejectedValueOnce(new AuthError('expired auth'));

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
    });

    await expect(
      poke({ app: 'hood', mark: 'helm-hi', json: 'test' })
    ).rejects.toThrow('Unable to authenticate with urbit');
    expect(pokeSpy).toHaveBeenCalledTimes(1);
  });

  it('reauthenticates and retries scry after a 403 response', async () => {
    const getCookieMock = vi.mocked(getLandscapeAuthCookie);
    getCookieMock.mockResolvedValue('urbauth-~zod=fresh-cookie');

    const scrySpy = vi.spyOn(Urbit.prototype, 'scryWithInfo');
    scrySpy.mockRejectedValueOnce({
      status: 403,
      message: 'forbidden',
      toString: () => 'forbidden',
    });
    scrySpy.mockResolvedValueOnce({
      result: { ok: true },
      responseSizeInBytes: 12,
      responseStatus: 200,
    });

    configureClient({
      shipName: '~zod',
      shipUrl: 'http://localhost:8080',
      getCode: async () => 'lidlut-tabwed',
    });

    const result = await scry<{ ok: boolean }>({ app: 'hood', path: '/foo' });

    expect(result).toEqual({ ok: true });
    expect(scrySpy).toHaveBeenCalledTimes(2);
    expect(getCookieMock).toHaveBeenCalledWith(
      'http://localhost:8080',
      'lidlut-tabwed'
    );
    expect((client as unknown as { cookie?: string }).cookie).toBe(
      'urbauth-~zod=fresh-cookie'
    );
  });
});
