import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  type CredentialResolution,
  type EnsureClientDeps,
  __resetApiClientForTests,
  ensureClient,
  validateConfiguredCookie,
} from './api-client';
import { mockedScry } from './tloncorp-api-mock';

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
  const subscriptionSetups: unknown[] = [];

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
    setupSubscriptions: async (subs) => {
      subscriptionSetups.push(subs);
    },
  };

  return { deps, configureCalls, cacheWrites, subscriptionSetups };
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
  // OpenClaw pipes stderr and relays it verbatim into an owner DM on failure
  // (migrate-command.ts). Advice about shortening the next shell invocation is
  // noise there, so the note is for a terminal only.
  it('does not print the cached-credentials note when stderr is not a TTY', async () => {
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback-code' },
      authKind: 'cookie',
      fallbackCode: 'fallback-code',
      mayWriteAuthCache: true,
    });
    const { deps, cacheWrites } = makeDeps(resolved, {
      cookieValid: false,
      freshCookie: 'urbauth-~zod=0v-fresh',
    });

    const originalIsTTY = process.stderr.isTTY;
    const originalError = console.error;
    const written: string[] = [];
    console.error = (...args: unknown[]) => {
      written.push(args.map(String).join(' '));
    };
    try {
      Object.defineProperty(process.stderr, 'isTTY', {
        value: false,
        configurable: true,
      });
      await ensureClient([], deps);
    } finally {
      console.error = originalError;
      Object.defineProperty(process.stderr, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    }

    // The cookie is still cached; only the advisory is suppressed.
    expect(cacheWrites).toHaveLength(1);
    expect(written.join('\n')).not.toContain('Credentials cached');
  });

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

  it('never hands the cookie-validation client a code to reauth with', async () => {
    // With getCode present, the api layer silently re-logs-in on a 403 during
    // validation, swapping in a fresh cookie without setting didFreshAuth —
    // bypassing the identity check. Fallback code may appear only in the
    // explicit (checked) second configureClient call.
    const resolved = resolution({
      config: { cookie: 'urbauth-~zod=0v-cookie', code: 'fallback-code' },
      authKind: 'cookie',
      fallbackCode: 'fallback-code',
      mayWriteAuthCache: true,
    });

    const valid = makeDeps(resolved, { cookieValid: true });
    await ensureClient([], valid.deps);
    expect(valid.configureCalls).toHaveLength(1);
    expect(
      (valid.configureCalls[0] as { getCode?: unknown }).getCode
    ).toBeUndefined();

    __resetApiClientForTests();

    const expired = makeDeps(resolved, { cookieValid: false });
    await ensureClient([], expired.deps);
    expect(expired.configureCalls).toHaveLength(2);
    expect(
      (expired.configureCalls[0] as { getCode?: unknown }).getCode
    ).toBeUndefined();
    expect(
      (expired.configureCalls[1] as { getCode?: unknown }).getCode
    ).toBeDefined();
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

  it('rejects a fresh code login that authenticates as another ship', async () => {
    // A ship-config file (or env triple) naming one ship but holding another's
    // code would otherwise act, and cache, under the wrong identity.
    const resolved = resolution({
      config: { ship: 'ten', code: 'code' },
      authKind: 'code',
      mayWriteAuthCache: true,
    });
    const { deps, cacheWrites, subscriptionSetups } = makeDeps(resolved, {
      freshCookie: 'urbauth-~zod=0v-bot',
    });

    await expect(ensureClient([], deps)).rejects.toThrow(
      'Authentication identity mismatch: credentials for ~ten authenticated as ~zod'
    );
    expect(cacheWrites).toEqual([]);
    expect(subscriptionSetups).toEqual([]);
  });

  it('rejects a cookie-to-code fallback that authenticates as another ship', async () => {
    // The check keys on the fresh-auth event, not the resolver's authKind, so
    // the fallback path is covered as well as a direct code login.
    const resolved = resolution({
      config: {
        ship: 'ten',
        cookie: 'urbauth-~ten=0v-cookie',
        code: 'fallback-code',
      },
      authKind: 'cookie',
      fallbackCode: 'fallback-code',
      mayWriteAuthCache: true,
    });
    const { deps, configureCalls, cacheWrites, subscriptionSetups } = makeDeps(
      resolved,
      { cookieValid: false, freshCookie: 'urbauth-~zod=0v-bot' }
    );

    await expect(ensureClient([], deps)).rejects.toThrow(
      'credentials for ~ten authenticated as ~zod'
    );
    expect(configureCalls).toHaveLength(2);
    expect(cacheWrites).toEqual([]);
    expect(subscriptionSetups).toEqual([]);
  });

  it('leaves valid provided-cookie flows unchecked', async () => {
    // No fresh authentication happened, so the identity check does not run —
    // provided cookies keep the resolver's own ship/cookie consistency rules.
    const resolved = resolution({
      config: { ship: 'ten', cookie: 'urbauth-~zod=0v-cookie' },
      authKind: 'cookie',
      mayWriteAuthCache: false,
    });
    const { deps, cacheWrites, subscriptionSetups } = makeDeps(resolved, {
      cookieValid: true,
    });

    await ensureClient(['groups'], deps);

    expect(cacheWrites).toEqual([]);
    expect(subscriptionSetups).toEqual([['groups']]);
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

describe('validateConfiguredCookie classification', () => {
  const originalScry = mockedScry.impl;
  afterEach(() => {
    mockedScry.impl = originalScry;
  });

  const failingWith = (error: unknown) => {
    mockedScry.impl = async () => {
      throw error;
    };
  };

  it('accepts a cookie when the probe scry succeeds', async () => {
    mockedScry.impl = async () => ({});
    expect(await validateConfiguredCookie()).toBe(true);
  });

  it('rejects on 401 and 403 auth failures', async () => {
    failingWith({ status: 401, message: 'HTTP 401' });
    expect(await validateConfiguredCookie()).toBe(false);
    failingWith({ status: 403, message: 'HTTP 403' });
    expect(await validateConfiguredCookie()).toBe(false);
  });

  it('rejects when the codeless client cannot reauthenticate', async () => {
    // The api layer's failed 403-reauth surfaces as this error because the
    // validation client deliberately carries no code.
    failingWith(new Error('Unable to authenticate with urbit'));
    expect(await validateConfiguredCookie()).toBe(false);
  });

  it('presumes validity on transient non-auth failures', async () => {
    failingWith(new Error('fetch failed'));
    expect(await validateConfiguredCookie()).toBe(true);
  });
});
