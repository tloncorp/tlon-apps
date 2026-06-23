import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  type CredentialResolution,
  type EnsureClientDeps,
  __resetApiClientForTests,
  ensureClient,
} from './api-client';

function resolution(
  overrides: Omit<Partial<CredentialResolution>, 'config'> & {
    config?: Partial<CredentialResolution['config']>;
  } = {}
): CredentialResolution {
  const { config: _config, ...rest } = overrides;
  const cfg = {
    url: 'https://zod.tlon.network',
    ship: 'zod',
    code: '',
    ..._config,
  } as CredentialResolution['config'];

  return {
    config: cfg,
    origin: 'cli',
    authKind: cfg.cookie ? 'cookie' : 'code',
    mayReadAuthCache: false,
    mayWriteAuthCache: !!cfg.code || !!overrides.fallbackCode,
    provenance: { selectedBy: 'cli', ship: 'cli' },
    ...rest,
  };
}

function makeDeps(
  resolved: CredentialResolution,
  options: { cookieValid?: boolean; freshCookie?: string } = {}
) {
  const configureCalls: unknown[] = [];
  const cacheWrites: Array<{ url: string; ship: string; cookie: string }> = [];

  const deps: EnsureClientDeps = {
    resolve: () => resolved,
    configureClient: async (params) => {
      configureCalls.push(params);
    },
    createCookieClient: () => ({}) as any,
    validateCookie: async () => options.cookieValid ?? true,
    getAuthenticatedCookie: () =>
      options.freshCookie ?? 'urbauth-~zod=0v-fresh',
    cacheCookie: (url, ship, cookie) => {
      cacheWrites.push({ url, ship, cookie });
    },
    setupSubscriptions: async () => {},
  };

  return { deps, configureCalls, cacheWrites };
}

const originalConsoleError = console.error;

beforeEach(() => {
  console.error = () => {};
});

afterEach(() => {
  console.error = originalConsoleError;
  __resetApiClientForTests();
});

describe('ensureClient auth/cache policy', () => {
  it('uses provided cookie first and does not cache it when validation succeeds', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback-code' },
      authKind: 'cookie',
      fallbackCode: 'fallback-code',
      mayWriteAuthCache: true,
    });
    const { deps, configureCalls, cacheWrites } = makeDeps(resolved, {
      cookieValid: true,
    });

    await ensureClient([], deps);

    expect(configureCalls).toHaveLength(1);
    expect(cacheWrites).toEqual([]);
  });

  it('uses fallback code after a provided cookie expires and caches the fresh cookie', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback-code' },
      authKind: 'cookie',
      fallbackCode: 'fallback-code',
      mayWriteAuthCache: true,
    });
    const { deps, configureCalls, cacheWrites } = makeDeps(resolved, {
      cookieValid: false,
      freshCookie: 'urbauth-~zod=0v-fresh',
    });

    await ensureClient([], deps);

    expect(configureCalls).toHaveLength(2);
    expect(cacheWrites).toEqual([
      {
        url: 'https://zod.tlon.network',
        ship: 'zod',
        cookie: 'urbauth-~zod=0v-fresh',
      },
    ]);
  });

  it('does not cache provided-cookie flows without fresh code auth', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie' },
      authKind: 'cookie',
      mayWriteAuthCache: false,
    });
    const { deps, cacheWrites } = makeDeps(resolved, { cookieValid: true });

    await ensureClient([], deps);

    expect(cacheWrites).toEqual([]);
  });

  it('uses source-aware errors for expired provided cookies without fallback code', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie' },
      origin: 'config-file',
      authKind: 'cookie',
      mayWriteAuthCache: false,
      provenance: {
        selectedBy: 'env',
        ship: 'cookie',
        configPath: '/tmp/zod.json',
      },
    });
    const { deps } = makeDeps(resolved, { cookieValid: false });

    await expect(ensureClient([], deps)).rejects.toThrow(
      'Cookie credentials for ~zod from config file /tmp/zod.json'
    );
  });

  it('identifies expired cached cookies as cache sourced', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cache' },
      origin: 'ship-cache',
      authKind: 'cached-cookie',
      mayReadAuthCache: true,
      mayWriteAuthCache: false,
      provenance: {
        selectedBy: 'env',
        ship: 'cache',
        cachePath: '/tmp/cache/zod.json',
      },
    });
    const { deps } = makeDeps(resolved, { cookieValid: false });

    await expect(ensureClient([], deps)).rejects.toThrow(
      'Cached cookie for ~zod has expired'
    );
  });

  it('caches fresh cookies after code login', async () => {
    const resolved = resolution({
      config: { code: 'code' },
      authKind: 'code',
      mayWriteAuthCache: true,
    });
    const { deps, configureCalls, cacheWrites } = makeDeps(resolved, {
      freshCookie: 'urbauth-~zod=0v-fresh',
    });

    await ensureClient([], deps);

    expect(configureCalls).toHaveLength(1);
    expect(cacheWrites).toEqual([
      {
        url: 'https://zod.tlon.network',
        ship: 'zod',
        cookie: 'urbauth-~zod=0v-fresh',
      },
    ]);
  });

  it('keeps config-file, skill-dir, and OpenClaw cookies out of cache when they validate', async () => {
    for (const origin of ['config-file', 'skill-dir', 'openclaw'] as const) {
      __resetApiClientForTests();
      const resolved = resolution({
        config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback' },
        origin,
        authKind: 'cookie',
        fallbackCode: 'fallback',
        mayWriteAuthCache: true,
      });
      const { deps, cacheWrites } = makeDeps(resolved, { cookieValid: true });

      await ensureClient([], deps);

      expect(cacheWrites).toEqual([]);
    }
  });

  it('uses fallback code and caches fresh cookies for expired file-backed cookies', async () => {
    for (const origin of ['config-file', 'skill-dir', 'openclaw'] as const) {
      __resetApiClientForTests();
      const resolved = resolution({
        config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback' },
        origin,
        authKind: 'cookie',
        fallbackCode: 'fallback',
        mayWriteAuthCache: true,
      });
      const { deps, cacheWrites } = makeDeps(resolved, {
        cookieValid: false,
        freshCookie: 'urbauth-~zod=0v-fresh',
      });

      await ensureClient([], deps);

      expect(cacheWrites).toEqual([
        {
          url: 'https://zod.tlon.network',
          ship: 'zod',
          cookie: 'urbauth-~zod=0v-fresh',
        },
      ]);
    }
  });

  it('reset hook clears initialized state for isolated tests', async () => {
    const first = makeDeps(
      resolution({
        config: { code: 'first' },
        authKind: 'code',
        mayWriteAuthCache: true,
      })
    );
    await ensureClient([], first.deps);

    __resetApiClientForTests();

    const second = makeDeps(
      resolution({
        config: { code: 'second' },
        authKind: 'code',
        mayWriteAuthCache: true,
      })
    );
    await ensureClient([], second.deps);

    expect(first.configureCalls).toHaveLength(1);
    expect(second.configureCalls).toHaveLength(1);
  });
});
