import { getCurrentUserId, poke, requestJson, scry } from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, createHttpPokeApi, urbitFetch } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createHttpPokeApi: vi.fn(),
  urbitFetch: vi.fn(),
}));

vi.mock('./auth.js', () => ({ authenticate }));
vi.mock('./http-poke.js', () => ({ createHttpPokeApi }));
vi.mock('./fetch.js', () => ({ urbitFetch }));

describe('scoped API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps concurrent monitor clients isolated', async () => {
    const { runWithTlonApiScope, setScopedTlonApiWithPoke } =
      await import('./api-client.js');

    const readShip = (ship: string) =>
      runWithTlonApiScope(async () => {
        setScopedTlonApiWithPoke(vi.fn(), ship, `http://${ship.slice(1)}`);
        await Promise.resolve();
        return getCurrentUserId();
      });

    await expect(
      Promise.all([readShip('~zod'), readShip('~nec')])
    ).resolves.toEqual(['~zod', '~nec']);
  });

  it('runs gateway pokes through the normal API path in a local scope', async () => {
    const transport = vi.fn().mockResolvedValue(42);
    const { withTlonApiPoke } = await import('./api-client.js');

    await expect(
      withTlonApiPoke(transport, () =>
        poke({ app: 'steward', mark: 'gateway', json: {} })
      )
    ).resolves.toBe(42);
    expect(transport).toHaveBeenCalledOnce();
  });

  it('fails unsupported gateway operations with descriptive shim errors', async () => {
    const { withTlonApiPoke } = await import('./api-client.js');
    const transport = vi.fn();

    await expect(
      withTlonApiPoke(transport, () => requestJson('/notes', 'GET'))
    ).rejects.toThrow('JSON requests not supported on this client shim');
    await expect(
      withTlonApiPoke(transport, () => scry({ app: 'contacts', path: '/self' }))
    ).rejects.toThrow('Scry not supported on this client shim');
  });

  it('forwards request abort options through a configured monitor scope', async () => {
    const { runWithTlonApiScope, setScopedTlonApiWithPoke } =
      await import('./api-client.js');
    const transport = vi.fn().mockResolvedValue({ ok: true });
    const controller = new AbortController();

    await expect(
      runWithTlonApiScope(async () => {
        setScopedTlonApiWithPoke(
          vi.fn(),
          '~zod',
          'http://zod',
          undefined,
          transport
        );
        return requestJson('/notes', 'GET', undefined, {
          signal: controller.signal,
        });
      })
    ).resolves.toEqual({ ok: true });
    expect(transport).toHaveBeenCalledWith('/notes', 'GET', undefined, {
      signal: controller.signal,
    });
  });

  it('runs an authenticated full client only inside its operation', async () => {
    authenticate
      .mockResolvedValueOnce('cookie-old')
      .mockResolvedValueOnce('cookie-new');
    createHttpPokeApi.mockResolvedValue({
      poke: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    urbitFetch
      .mockResolvedValueOnce({
        response: { ok: false, status: 401 },
        release: vi.fn().mockResolvedValue(undefined),
      })
      .mockResolvedValueOnce({
        response: {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('{"ok":true}'),
        },
        release: vi.fn().mockResolvedValue(undefined),
      });

    const { withAuthenticatedTlonApi } = await import('./api-client.js');

    const result = await withAuthenticatedTlonApi(
      {
        url: 'http://ships:8080',
        code: 'lidlut-tabwed-pillex-ridrup',
        ship: '~zod',
      },
      async () => ({
        ship: getCurrentUserId(),
        response: await requestJson('/notes', 'GET'),
      })
    );

    expect(result).toEqual({ ship: '~zod', response: { ok: true } });
    expect(authenticate).toHaveBeenCalledTimes(2);
    expect(urbitFetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        init: expect.objectContaining({ headers: { Cookie: 'cookie-old' } }),
      })
    );
    expect(urbitFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        init: expect.objectContaining({ headers: { Cookie: 'cookie-new' } }),
      })
    );
  });

  it('restores the monitor client after nested outbound work', async () => {
    authenticate.mockResolvedValue('cookie');
    createHttpPokeApi.mockResolvedValue({
      poke: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const {
      runWithTlonApiScope,
      setScopedTlonApiWithPoke,
      withAuthenticatedTlonApi,
    } = await import('./api-client.js');

    const ships = await runWithTlonApiScope(async () => {
      setScopedTlonApiWithPoke(vi.fn(), '~zod', 'http://zod');
      const before = getCurrentUserId();
      const nested = await withAuthenticatedTlonApi(
        { url: 'http://nec', code: 'lit', ship: '~nec' },
        async () => getCurrentUserId()
      );
      return [before, nested, getCurrentUserId()];
    });

    expect(ships).toEqual(['~zod', '~nec', '~zod']);
  });

  it('can re-enter a configured scope from a later lifecycle callback', async () => {
    const {
      captureTlonApiScope,
      runWithTlonApiScope,
      setScopedTlonApiWithPoke,
    } = await import('./api-client.js');

    const runCaptured = await runWithTlonApiScope(async () => {
      setScopedTlonApiWithPoke(vi.fn(), '~zod', 'http://zod');
      return captureTlonApiScope();
    });

    expect(runCaptured).toBeTypeOf('function');
    await expect(
      runCaptured!(() => Promise.resolve(getCurrentUserId()))
    ).resolves.toBe('~zod');
  });
});
