import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { __resetApiClientForTests } from './api-client';
// `@tloncorp/api` is mocked by `tloncorp-api-mock`, which bunfig.toml
// preloads for every `bun test` run — see that module's doc for why a
// per-file `mock.module` registration would be unsafe.
import { createSurfaceDeps } from './surface-runtime';

/**
 * Tests for the dev-storage guard: the rule that
 * `TLON_SURFACE_DEV_STORAGE` engages a local bundle store instead of the
 * ship's S3, and refuses when either end of that arrangement is not local.
 *
 * The guard's whole job is to keep a variable left in a shell profile from
 * following a developer onto a real ship and writing a `127.0.0.1` assetRef
 * into a channel other people read. The refusal is therefore the security
 * property, and `refuses dev storage against a real ship` below is the test
 * that carries it. Its FULCRUM is `getConfig().url` — the resolved ship URL
 * is the only thing in this test's world that moves the observed value, and
 * the test moves it by setting TLON_URL and dropping the api-client's config
 * cache. Delete the `isLoopbackUrl(shipUrl)` check in surface-runtime.ts and
 * that test fails; nothing else here does.
 *
 * Everything runs through the real `createSurfaceDeps()` rather than the
 * private factory, so the assembly is under test too: dev storage has to
 * replace BOTH halves — preflight and upload — or a publish would pass a
 * gate that reads a bucket nothing is going to be written to.
 */

const OWNED_ENV = [
  'TLON_SURFACE_DEV_STORAGE',
  'TLON_URL',
  'TLON_SHIP',
  'TLON_CODE',
  'TLON_COOKIE',
  'URBIT_URL',
  'URBIT_SHIP',
  'URBIT_CODE',
  'URBIT_COOKIE',
  'TLON_CONFIG_FILE',
  'TLON_SKILL_DIR',
  'TLON_CACHE_DIR',
] as const;

const savedEnv = new Map<string, string | undefined>();
let emptyCacheDir: string | null = null;

/**
 * Points credential resolution at a ship and (optionally) a dev store, with
 * every other credential source neutralised: an empty cache dir and no
 * config file, so the resolver cannot silently fall through to whatever
 * ships the developer running the suite happens to have cached.
 */
function configure(options: { ship: string; devStorage?: string }): void {
  for (const key of OWNED_ENV) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  emptyCacheDir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'surface-runtime-'));
  process.env.TLON_CACHE_DIR = emptyCacheDir;
  process.env.TLON_URL = options.ship;
  process.env.TLON_SHIP = '~zod';
  process.env.TLON_CODE = 'lidlut-tabwed-pillex-ridrup';
  if (options.devStorage !== undefined) {
    process.env.TLON_SURFACE_DEV_STORAGE = options.devStorage;
  }
  __resetApiClientForTests();
}

/** Runs `body` with stderr captured, so the engagement banner is assertable. */
async function withCapturedStderr(body: () => Promise<void>): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    await body();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

async function rejection(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
  __resetApiClientForTests();
});

describe('dev storage guard', () => {
  it('refuses dev storage against a real ship', async () => {
    configure({
      ship: 'https://sampel-palnet.tlon.network',
      devStorage: 'http://127.0.0.1:4323',
    });
    const deps = createSurfaceDeps();

    // Both halves refuse. Only the preflight refusing would let a publish
    // that skipped the gate still upload; only the upload refusing would
    // let the gate pass and fail later, after the revision was derived.
    for (const call of [
      () => deps.storagePreflight(),
      () =>
        deps.uploadBundle({
          fileName: `${'0'.repeat(64)}.js`,
          bytes: new Uint8Array([1]),
          contentType: 'application/javascript',
        }),
    ]) {
      const error = await rejection(call());
      expect(error.code).toBe('storage-unavailable');
      expect(error.message).toContain('https://sampel-palnet.tlon.network');
      expect(error.message).toContain('not a local ship');
    }
  });

  it('refuses a non-loopback store even when the ship is local', async () => {
    configure({
      ship: 'http://127.0.0.1:35453',
      devStorage: 'https://bundles.example.com',
    });
    const error = await rejection(createSurfaceDeps().storagePreflight());
    expect(error.code).toBe('storage-unavailable');
    expect(error.message).toContain('bundles.example.com');
    expect(error.message).toContain('not loopback');
  });

  it('refuses a value that is not an http(s) URL', async () => {
    for (const value of ['not-a-url', 'file:///tmp/bundles']) {
      configure({ ship: 'http://127.0.0.1:35453', devStorage: value });
      const error = await rejection(createSurfaceDeps().storagePreflight());
      expect(error.code).toBe('storage-unavailable');
      expect(error.message).toContain(value);
    }
  });

  it('engages when the store and the ship are both loopback', async () => {
    // The three spellings a local ship is reached by, including the one the
    // 6a container uses: with `network_mode: host` the container shares the
    // host's loopback, so `http://127.0.0.1:<manifest port>` is the ship's
    // real address there, not a stand-in for one.
    for (const ship of [
      'http://127.0.0.1:35453',
      'http://localhost:35453',
      'http://[::1]:35453',
    ]) {
      configure({ ship, devStorage: 'http://127.0.0.1:4323' });
      const deps = createSurfaceDeps();
      const banner = await withCapturedStderr(async () => {
        await expect(deps.storagePreflight()).resolves.toEqual({
          canStore: true,
        });
      });
      // Announced on stderr, never stdout: `--json` owns stdout, and a
      // publisher reading the output must not be able to mistake which
      // storage they hit.
      expect(banner).toContain('DEV STORAGE ENGAGED');
      expect(banner).toContain('http://127.0.0.1:4323');
      expect(banner).toContain(ship);
    }
  });

  it('is never reached because real storage was missing', async () => {
    // Unset, the guard is not merely inert — it is not consulted. A ship
    // with no bucket has to fail its own way, so that dev storage can only
    // ever be an act, never a fallback.
    configure({ ship: 'https://sampel-palnet.tlon.network' });
    const deps = createSurfaceDeps();
    const banner = await withCapturedStderr(async () => {
      await deps.storagePreflight().catch(() => undefined);
    });
    expect(banner).not.toContain('DEV STORAGE ENGAGED');
  });

  it('treats a whitespace-only value as unset', async () => {
    configure({ ship: 'https://sampel-palnet.tlon.network', devStorage: '  ' });
    const banner = await withCapturedStderr(async () => {
      await createSurfaceDeps()
        .storagePreflight()
        .catch(() => undefined);
    });
    expect(banner).not.toContain('DEV STORAGE ENGAGED');
  });
});
