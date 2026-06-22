import { describe, expect, it } from 'bun:test';
import * as path from 'path';

import {
  type CredentialResolverInput,
  type ResolverFileSystem,
  getCachePath,
  readCachedEntryForShip,
  resolveCredentials,
} from './credential-resolver';

const HOME = '/tmp/tlon-home';
const CACHE_DIR = '/tmp/tlon-cache';
const SKILL_DIR = '/tmp/tlon-skill-dir';

function json(value: unknown): string {
  return JSON.stringify(value);
}

function memoryFs(files: Record<string, string>): ResolverFileSystem {
  return {
    exists(filePath) {
      if (files[filePath] !== undefined) return true;
      return Object.keys(files).some(
        (entry) => path.dirname(entry) === filePath
      );
    },
    readFile(filePath) {
      const value = files[filePath];
      if (value === undefined) {
        throw new Error(`missing file: ${filePath}`);
      }
      return value;
    },
    readDir(dirPath) {
      return Object.keys(files)
        .filter((entry) => path.dirname(entry) === dirPath)
        .map((entry) => path.basename(entry));
    },
  };
}

function baseInput(
  files: Record<string, string> = {},
  env: Record<string, string | undefined> = {}
): CredentialResolverInput {
  return {
    env,
    fs: memoryFs(files),
    cacheDir: CACHE_DIR,
    homeDir: HOME,
  };
}

function cacheFile(
  ship: string,
  url = `https://${ship}.tlon.network`,
  cookie = `urbauth-~${ship}=0v-cache`
) {
  return json({ url, ship, cookie, cachedAt: 1 });
}

describe('credential resolver', () => {
  it('lets CLI URL+cookie beat ambient TLON_CONFIG_FILE', () => {
    const result = resolveCredentials({
      ...baseInput({}, { TLON_CONFIG_FILE: '/tmp/missing.json' }),
      cli: {
        kind: 'cookie',
        url: 'https://cli.tlon.network',
        cookie: 'urbauth-~zod=0v-cookie',
      },
    });

    expect(result.origin).toBe('cli');
    expect(result.authKind).toBe('cookie');
    expect(result.config).toMatchObject({
      url: 'https://cli.tlon.network',
      ship: 'zod',
    });
    expect(result.mayReadAuthCache).toBe(false);
  });

  it('lets CLI --ship beat ambient URBIT_SHIP for targeted cache lookup', () => {
    const files = {
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile('zod'),
      [getCachePath(CACHE_DIR, 'bus')]: cacheFile('bus'),
    };

    const result = resolveCredentials({
      ...baseInput(files, { URBIT_SHIP: '~bus' }),
      cli: { kind: 'ship', ship: '~zod' },
    });

    expect(result.origin).toBe('ship-cache');
    expect(result.config.ship).toBe('zod');
    expect(result.authKind).toBe('cached-cookie');
    expect(result.provenance.selectedBy).toBe('cli');
  });

  it('lets CLI --ship plus TLON_SKILL_DIR beat ambient TLON_CONFIG_FILE and ship cache', () => {
    const files = {
      '/tmp/env-config.json': json({
        url: 'https://env.tlon.network',
        cookie: 'urbauth-~env=0v-cookie',
      }),
      [path.join(SKILL_DIR, 'ships', 'zod.json')]: json({
        url: 'https://skill.tlon.network',
        cookie: 'urbauth-~zod=0v-skill',
      }),
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
        'zod',
        'https://cache.tlon.network'
      ),
    };

    const result = resolveCredentials({
      ...baseInput(files, {
        TLON_CONFIG_FILE: '/tmp/env-config.json',
        TLON_SKILL_DIR: SKILL_DIR,
      }),
      cli: { kind: 'ship', ship: '~zod' },
    });

    expect(result.origin).toBe('skill-dir');
    expect(result.config.url).toBe('https://skill.tlon.network');
    expect(result.provenance.ship).toBe('cli');
    expect(result.mayReadAuthCache).toBe(false);
  });

  it('lets CLI --ship use cache when TLON_SKILL_DIR is set but the ship file is missing', () => {
    const files = {
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
        'zod',
        'https://cache.tlon.network'
      ),
    };

    const result = resolveCredentials({
      ...baseInput(files, { TLON_SKILL_DIR: SKILL_DIR }),
      cli: { kind: 'ship', ship: '~zod' },
    });

    expect(result.origin).toBe('ship-cache');
    expect(result.config.url).toBe('https://cache.tlon.network');
    expect(result.provenance.selectedBy).toBe('cli');
  });

  it('fails when CLI --ship finds an invalid TLON_SKILL_DIR file even if cache exists', () => {
    const files = {
      [path.join(SKILL_DIR, 'ships', 'zod.json')]: json({
        url: 'https://skill.tlon.network',
      }),
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
        'zod',
        'https://cache.tlon.network'
      ),
    };

    expect(() =>
      resolveCredentials({
        ...baseInput(files, { TLON_SKILL_DIR: SKILL_DIR }),
        cli: { kind: 'ship', ship: '~zod' },
      })
    ).toThrow('Invalid config');
  });

  it('preserves URBIT_* alias precedence while allowing mixed aliases for cookie auth', () => {
    const result = resolveCredentials(
      baseInput(
        {},
        {
          URBIT_URL: 'https://urbit-url.tlon.network',
          TLON_URL: 'https://tlon-url.tlon.network',
          TLON_COOKIE: 'urbauth-~zod=0v-cookie',
        }
      )
    );

    expect(result.origin).toBe('env-cookie');
    expect(result.config.url).toBe('https://urbit-url.tlon.network');
    expect(result.config.ship).toBe('zod');
  });

  it('preserves mixed aliases for URL + ship + code auth', () => {
    const result = resolveCredentials(
      baseInput(
        {},
        {
          TLON_URL: 'https://tlon-url.tlon.network',
          URBIT_SHIP: '~bus',
          TLON_CODE: 'code-from-tlon',
        }
      )
    );

    expect(result.origin).toBe('env-code');
    expect(result.authKind).toBe('code');
    expect(result.config).toMatchObject({
      url: 'https://tlon-url.tlon.network',
      ship: 'bus',
      code: 'code-from-tlon',
    });
  });

  it('fails partial ambient credential env instead of falling through', () => {
    expect(() =>
      resolveCredentials(
        baseInput({}, { URBIT_URL: 'https://zod.tlon.network' })
      )
    ).toThrow('Invalid ambient credentials');
    expect(() =>
      resolveCredentials(
        baseInput({}, { TLON_COOKIE: 'urbauth-~zod=0v-cookie' })
      )
    ).toThrow('Invalid ambient credentials');
    expect(() =>
      resolveCredentials(
        baseInput({}, { TLON_SHIP: '~zod', TLON_CODE: 'code' })
      )
    ).toThrow('Invalid ambient credentials');
  });

  it('allows ship-only ambient env for targeted cache lookup', () => {
    const files = { [getCachePath(CACHE_DIR, 'zod')]: cacheFile('zod') };

    const result = resolveCredentials(baseInput(files, { TLON_SHIP: '~zod' }));

    expect(result.origin).toBe('ship-cache');
    expect(result.config.ship).toBe('zod');
    expect(result.provenance.selectedBy).toBe('env');
  });

  it('loads TLON_CONFIG_FILE with cookie credentials', () => {
    const files = {
      '/tmp/zod.json': json({
        url: 'https://zod.tlon.network',
        cookie: 'urbauth-~zod=0v-cookie',
      }),
    };

    const result = resolveCredentials(
      baseInput(files, { TLON_CONFIG_FILE: '/tmp/zod.json' })
    );

    expect(result.origin).toBe('config-file');
    expect(result.authKind).toBe('cookie');
    expect(result.config.ship).toBe('zod');
  });

  it('does not read cache when TLON_CONFIG_FILE provides code credentials', () => {
    const files = {
      '/tmp/zod.json': json({
        url: 'https://zod.tlon.network',
        ship: '~zod',
        code: 'code',
      }),
      [getCachePath(CACHE_DIR, 'zod')]: 'not json',
    };

    const result = resolveCredentials(
      baseInput(files, { TLON_CONFIG_FILE: '/tmp/zod.json' })
    );

    expect(result.origin).toBe('config-file');
    expect(result.authKind).toBe('code');
    expect(result.mayReadAuthCache).toBe(false);
  });

  it('derives ship from URL+cookie and lets explicit ship override the cookie ship', () => {
    const derived = resolveCredentials(
      baseInput(
        {},
        {
          URBIT_URL: 'https://zod.tlon.network',
          URBIT_COOKIE: 'urbauth-~zod=0v-cookie',
        }
      )
    );
    const explicit = resolveCredentials({
      ...baseInput(),
      cli: {
        kind: 'cookie',
        url: 'https://bus.tlon.network',
        ship: '~bus',
        cookie: 'urbauth-~zod=0v-cookie',
      },
    });

    expect(derived.config.ship).toBe('zod');
    expect(derived.provenance.ship).toBe('cookie');
    expect(explicit.config.ship).toBe('bus');
    expect(explicit.provenance.ship).toBe('cli');
  });

  it('does not read cache for URL + ship + code credentials', () => {
    const files = { [getCachePath(CACHE_DIR, 'zod')]: 'not json' };

    const result = resolveCredentials(
      baseInput(files, {
        URBIT_URL: 'https://zod.tlon.network',
        URBIT_SHIP: '~zod',
        URBIT_CODE: 'code',
      })
    );

    expect(result.origin).toBe('env-code');
    expect(result.authKind).toBe('code');
    expect(result.mayReadAuthCache).toBe(false);
  });

  it('records fallback code for explicit cookie credentials', () => {
    const result = resolveCredentials({
      ...baseInput(),
      cli: {
        kind: 'cookie',
        url: 'https://zod.tlon.network',
        cookie: 'urbauth-~zod=0v-cookie',
        code: 'fallback-code',
      },
    });

    expect(result.authKind).toBe('cookie');
    expect(result.fallbackCode).toBe('fallback-code');
    expect(result.mayWriteAuthCache).toBe(true);
  });

  it('lets TLON_SHIP + TLON_SKILL_DIR beat an existing cache entry', () => {
    const files = {
      [path.join(SKILL_DIR, 'ships', 'zod.json')]: json({
        url: 'https://skill.tlon.network',
        cookie: 'urbauth-~zod=0v-skill',
      }),
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
        'zod',
        'https://cache.tlon.network'
      ),
    };

    const result = resolveCredentials(
      baseInput(files, { TLON_SHIP: '~zod', TLON_SKILL_DIR: SKILL_DIR })
    );

    expect(result.origin).toBe('skill-dir');
    expect(result.config.url).toBe('https://skill.tlon.network');
  });

  it('lets TLON_SHIP use cache when TLON_SKILL_DIR is set but the ship file is missing', () => {
    const files = {
      [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
        'zod',
        'https://cache.tlon.network'
      ),
    };

    const result = resolveCredentials(
      baseInput(files, { TLON_SHIP: '~zod', TLON_SKILL_DIR: SKILL_DIR })
    );

    expect(result.origin).toBe('ship-cache');
    expect(result.config.url).toBe('https://cache.tlon.network');
    expect(result.provenance.selectedBy).toBe('env');
  });

  it('loads OpenClaw JSON fallback and preserves legacy JSON fallbacks', () => {
    const openclawJson = path.join(HOME, '.openclaw', 'openclaw.json');
    const clawdbotLegacyJson = path.join(HOME, '.clawdbot', 'moltbot.json');
    const moltbotLegacyJson = path.join(HOME, '.moltbot', 'moltbot.json');

    const direct = resolveCredentials(
      baseInput({
        [openclawJson]: json({
          channels: {
            tlon: {
              url: 'https://zod.tlon.network',
              cookie: 'urbauth-~zod=0v-openclaw',
            },
          },
        }),
      })
    );
    const clawdbotLegacy = resolveCredentials(
      baseInput({
        [clawdbotLegacyJson]: json({
          channels: {
            tlon: {
              url: 'https://bus.tlon.network',
              ship: '~bus',
              code: 'legacy-code',
            },
          },
        }),
      })
    );
    const moltbotLegacy = resolveCredentials(
      baseInput({
        [moltbotLegacyJson]: json({
          channels: {
            tlon: {
              url: 'https://nec.tlon.network',
              ship: '~nec',
              code: 'moltbot-code',
            },
          },
        }),
      })
    );

    expect(direct.origin).toBe('openclaw');
    expect(direct.authKind).toBe('cookie');
    expect(clawdbotLegacy.origin).toBe('openclaw');
    expect(clawdbotLegacy.config.ship).toBe('bus');
    expect(moltbotLegacy.origin).toBe('openclaw');
    expect(moltbotLegacy.config.ship).toBe('nec');
  });

  it('skips unusable default OpenClaw JSON and continues to later defaults', () => {
    const files = {
      [path.join(HOME, '.openclaw', 'openclaw.json')]: json({ channels: {} }),
      [path.join(HOME, '.clawdbot', 'moltbot.json')]: json({
        channels: {
          tlon: {
            url: 'https://bus.tlon.network',
            ship: '~bus',
            code: 'legacy-code',
          },
        },
      }),
    };

    const result = resolveCredentials(baseInput(files));

    expect(result.origin).toBe('openclaw');
    expect(result.provenance.openclawPath).toBe(
      path.join(HOME, '.clawdbot', 'moltbot.json')
    );
    expect(result.config.ship).toBe('bus');
  });

  it('treats explicit OPENCLAW_CONFIG parse errors and unusable JSON as local errors', () => {
    expect(() =>
      resolveCredentials(
        baseInput(
          { '/tmp/openclaw.txt': 'not json' },
          { OPENCLAW_CONFIG: '/tmp/openclaw.txt' }
        )
      )
    ).toThrow('Failed to parse OpenClaw config');

    expect(() =>
      resolveCredentials(
        baseInput(
          { '/tmp/openclaw.json': json({ channels: {} }) },
          { OPENCLAW_CONFIG: '/tmp/openclaw.json' }
        )
      )
    ).toThrow('missing channels.tlon');

    expect(() =>
      resolveCredentials(
        baseInput(
          {
            '/tmp/openclaw.json': json({
              channels: {
                tlon: { url: '${TLON_URL}', ship: '~zod', code: 'code' },
              },
            }),
          },
          { OPENCLAW_CONFIG: '/tmp/openclaw.json' }
        )
      )
    ).toThrow('placeholder');

    expect(() =>
      resolveCredentials(
        baseInput(
          {
            '/tmp/openclaw.json': json({
              channels: {
                tlon: { url: 'https://zod.tlon.network', code: 'code' },
              },
            }),
          },
          { OPENCLAW_CONFIG: '/tmp/openclaw.json' }
        )
      )
    ).toThrow('must have tlon.ship');

    expect(() =>
      resolveCredentials(
        baseInput(
          {
            '/tmp/openclaw.json': json({
              channels: {
                tlon: { url: 'https://zod.tlon.network', ship: '~zod' },
              },
            }),
          },
          { OPENCLAW_CONFIG: '/tmp/openclaw.json' }
        )
      )
    ).toThrow('must have tlon.code or tlon.cookie');
  });

  it('does not let stale default YAML mask the real OpenClaw JSON path', () => {
    const files = {
      [path.join(HOME, '.openclaw', 'openclaw.yaml')]: 'not json',
      [path.join(HOME, '.openclaw', 'openclaw.json')]: json({
        channels: {
          tlon: {
            url: 'https://zod.tlon.network',
            ship: '~zod',
            code: 'json-code',
          },
        },
      }),
    };

    const result = resolveCredentials(baseInput(files));

    expect(result.origin).toBe('openclaw');
    expect(result.config.code).toBe('json-code');
  });

  it('fails targeted cache lookup when the cache file is invalid or mismatched', () => {
    expect(() =>
      readCachedEntryForShip(
        CACHE_DIR,
        '~zod',
        memoryFs({ [getCachePath(CACHE_DIR, 'zod')]: 'not json' })
      )
    ).toThrow('Invalid cache entry');
    expect(() =>
      readCachedEntryForShip(
        CACHE_DIR,
        '~zod',
        memoryFs({
          [getCachePath(CACHE_DIR, 'zod')]: json({
            url: 'https://zod.tlon.network',
            ship: 'zod',
          }),
        })
      )
    ).toThrow('must have url, ship, and cookie');
    expect(() =>
      readCachedEntryForShip(
        CACHE_DIR,
        '~zod',
        memoryFs({
          [getCachePath(CACHE_DIR, 'zod')]: json({
            url: 'https://zod.tlon.network',
            ship: 'bus',
            cookie: 'c',
          }),
        })
      )
    ).toThrow('does not match');
    expect(() =>
      readCachedEntryForShip(
        CACHE_DIR,
        '~zod',
        memoryFs({
          [getCachePath(CACHE_DIR, 'zod')]: cacheFile(
            'zod',
            'https://old.tlon.network'
          ),
        }),
        'https://new.tlon.network'
      )
    ).toThrow('stored URL');
  });

  it('auto-selects exactly one cached ship and errors on multiple or duplicate cached ships', () => {
    const single = resolveCredentials(
      baseInput({ [getCachePath(CACHE_DIR, 'zod')]: cacheFile('zod') })
    );
    expect(single.origin).toBe('single-cache');

    const singleWithInvalid = resolveCredentials(
      baseInput({
        [path.join(CACHE_DIR, 'invalid.json')]: json({
          url: 'https://invalid.tlon.network',
          ship: 'invalid',
        }),
        [getCachePath(CACHE_DIR, 'zod')]: cacheFile('zod'),
      })
    );
    expect(singleWithInvalid.origin).toBe('single-cache');
    expect(singleWithInvalid.config.ship).toBe('zod');

    expect(() =>
      resolveCredentials(
        baseInput({
          [getCachePath(CACHE_DIR, 'zod')]: cacheFile('zod'),
          [getCachePath(CACHE_DIR, 'bus')]: cacheFile('bus'),
        })
      )
    ).toThrow('Multiple cached ships');

    expect(() =>
      resolveCredentials(
        baseInput({
          [path.join(CACHE_DIR, 'zod.json')]: cacheFile('zod'),
          [path.join(CACHE_DIR, '~zod.json')]: cacheFile('~zod'),
        })
      )
    ).toThrow('Duplicate cached credentials');
  });

  it('reports missing config when no source resolves', () => {
    expect(() => resolveCredentials(baseInput())).toThrow(
      'Missing Urbit config'
    );
  });
});
