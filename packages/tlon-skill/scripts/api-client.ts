/**
 * API client setup for CLI usage.
 * Adapts real process/env/filesystem state into the credential resolver and
 * initializes @tloncorp/api according to the resolver's auth/cache policy.
 */
import {
  Urbit,
  client,
  configureClient as configureApiClient,
  internalRemoveClient,
  preSig,
  scry,
  subscribe,
} from '@tloncorp/api';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  type CachedAuth,
  type CliCredentialOverrides,
  type CredentialResolution,
  type ResolverFileSystem,
  type UrbitConfig,
  getCachePath,
  normalizeShipName,
  readCachedEntryForShip,
  readCachedShipCandidates,
  resolveCredentials,
} from './credential-resolver';

export type {
  AuthKind,
  CachedAuth,
  CliCredentialOverrides,
  CredentialOrigin,
  CredentialResolution,
  UrbitConfig,
} from './credential-resolver';

type SubscriptionApp = 'groups' | 'channels' | 'chat' | 'lanyard';

let initialized = false;
let subscribed = false;
let cachedConfig: UrbitConfig | null = null;
let cachedResolution: CredentialResolution | null = null;
let cliCredentialOverrides: CliCredentialOverrides | null = null;

const nodeFs: ResolverFileSystem = {
  exists: (filePath) => fs.existsSync(filePath),
  readFile: (filePath) => fs.readFileSync(filePath, 'utf-8'),
  readDir: (dirPath) => fs.readdirSync(dirPath),
};

function isVerbose(): boolean {
  const value = process.env.TLON_VERBOSE?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function logSubscriptionUpdate(label: string, event: unknown): void {
  if (!isVerbose()) return;
  console.log(`${label} update:`, event);
}

/**
 * Get the cache directory, configurable via TLON_CACHE_DIR env var.
 */
function getCacheDir(): string {
  return (
    process.env.TLON_CACHE_DIR || path.join(os.homedir(), '.tlon', 'cache')
  );
}

export function setCliCredentialOverrides(
  overrides: CliCredentialOverrides | null
): void {
  cliCredentialOverrides = overrides;
  cachedConfig = null;
  cachedResolution = null;
}

export function getCredentialResolution(): CredentialResolution {
  if (cachedResolution) return cachedResolution;

  cachedResolution = resolveCredentials({
    env: process.env,
    fs: nodeFs,
    cacheDir: getCacheDir(),
    homeDir: os.homedir(),
    cli: cliCredentialOverrides,
  });
  cachedConfig = cachedResolution.config;
  return cachedResolution;
}

/**
 * Get config from CLI overrides, environment, config files, OpenClaw, or cache.
 */
export function getConfig(): UrbitConfig {
  if (cachedConfig) return cachedConfig;
  return getCredentialResolution().config;
}

/**
 * Get all valid cached ship entries.
 * Invalid cache files are ignored for single-cache discovery, but duplicates fail.
 */
export function getCachedShips(): CachedAuth[] {
  return readCachedShipCandidates(getCacheDir(), nodeFs, {
    ignoreInvalid: true,
  }).map(({ cachePath: _cachePath, ...entry }) => entry);
}

/**
 * Get cached cookie for a ship+url combo.
 * Existing invalid, mismatched, or wrong-URL cache files fail clearly.
 */
export function getCachedCookie(url: string, ship: string): string | null {
  const entry = readCachedEntryForShip(getCacheDir(), ship, nodeFs, url);
  return entry?.cookie ?? null;
}

/**
 * Get cached entry for a ship.
 * Existing invalid or mismatched cache files fail clearly.
 */
export function getCachedEntry(ship: string): CachedAuth | null {
  const entry = readCachedEntryForShip(getCacheDir(), ship, nodeFs);
  if (!entry) return null;
  const { cachePath: _cachePath, ...cached } = entry;
  return cached;
}

/**
 * Cache cookie for future use.
 */
function cacheCookie(url: string, ship: string, cookie: string): void {
  try {
    fs.mkdirSync(getCacheDir(), { recursive: true, mode: 0o700 });
    const normalizedShip = normalizeShipName(ship);
    const cachePath = getCachePath(getCacheDir(), normalizedShip);
    const data: CachedAuth = {
      url,
      ship: normalizedShip,
      cookie,
      cachedAt: Date.now(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch {
    // Cache write failure is non-fatal.
  }
}

/**
 * Set up subscriptions required for trackedPoke to receive acks.
 * Only subscribes to requested apps to minimize overhead.
 */
async function setupSubscriptions(subs: SubscriptionApp[]): Promise<void> {
  if (subscribed) return;

  if (subs.includes('groups')) {
    await subscribe({ app: 'groups', path: '/v1/groups' }, (e) =>
      logSubscriptionUpdate('groups', e)
    );
  }

  if (subs.includes('channels')) {
    await subscribe({ app: 'channels', path: '/v4' }, (e) =>
      logSubscriptionUpdate('channels', e)
    );
  }

  if (subs.includes('chat')) {
    await subscribe({ app: 'chat', path: '/v4' }, (e) =>
      logSubscriptionUpdate('chat', e)
    );
  }

  if (subs.includes('lanyard')) {
    await subscribe({ app: 'lanyard', path: '/v1/records' }, (e) =>
      logSubscriptionUpdate('lanyard', e)
    );
  }

  subscribed = true;
}

function createCookieClient(cfg: UrbitConfig, cookie: string): Urbit {
  const urbit = new Urbit(cfg.url);
  urbit.cookie = cookie;
  urbit.nodeId = preSig(cfg.ship);
  return urbit;
}

async function validateConfiguredCookie(): Promise<boolean> {
  try {
    await scry({ app: 'hood', path: '/kiln/pikes' });
    return true;
  } catch (err: any) {
    const is401 =
      err?.status === 401 ||
      (typeof err?.message === 'string' && err.message.includes('401'));
    return !is401;
  }
}

function getAuthenticatedCookie(): string | undefined {
  try {
    return client.cookie;
  } catch {
    return undefined;
  }
}

export interface EnsureClientDeps {
  resolve: () => CredentialResolution;
  configureClient: typeof configureApiClient;
  createCookieClient: (cfg: UrbitConfig, cookie: string) => Urbit;
  validateCookie: () => Promise<boolean>;
  getAuthenticatedCookie: () => string | undefined;
  cacheCookie: (url: string, ship: string, cookie: string) => void;
  setupSubscriptions: (subs: SubscriptionApp[]) => Promise<void>;
}

const defaultEnsureClientDeps: EnsureClientDeps = {
  resolve: getCredentialResolution,
  configureClient: configureApiClient,
  createCookieClient,
  validateCookie: validateConfiguredCookie,
  getAuthenticatedCookie,
  cacheCookie,
  setupSubscriptions,
};

function describeOrigin(resolution: CredentialResolution): string {
  switch (resolution.origin) {
    case 'cli':
      return 'CLI flags';
    case 'config-file':
      return resolution.provenance.configPath
        ? `config file ${resolution.provenance.configPath}`
        : 'config file';
    case 'env-cookie':
    case 'env-code':
      return 'environment variables';
    case 'skill-dir':
      return resolution.provenance.configPath
        ? `skill-dir config ${resolution.provenance.configPath}`
        : 'skill-dir config';
    case 'openclaw':
      return resolution.provenance.openclawPath
        ? `OpenClaw config ${resolution.provenance.openclawPath}`
        : 'OpenClaw config';
    case 'ship-cache':
    case 'single-cache':
      return resolution.provenance.cachePath
        ? `cache ${resolution.provenance.cachePath}`
        : 'cache';
  }
}

function cookieValidationError(resolution: CredentialResolution): Error {
  const ship = preSig(resolution.config.ship);
  if (resolution.authKind === 'cached-cookie') {
    return new Error(
      `Cached cookie for ${ship} has expired and no access code is available to re-authenticate. ` +
        'Provide --url + --ship + --code to refresh credentials.'
    );
  }

  return new Error(
    `Cookie credentials for ${ship} from ${describeOrigin(resolution)} failed validation ` +
      'and no fallback code is available. Provide --code or set URBIT_CODE/TLON_CODE.'
  );
}

/**
 * Ensure @tloncorp/api client is configured, connected, and subscribed.
 * Pass required subscription apps to minimize connection overhead.
 */
export async function ensureClient(
  subs: SubscriptionApp[] = [],
  depsOverride: Partial<EnsureClientDeps> = {}
): Promise<UrbitConfig> {
  const deps: EnsureClientDeps = {
    ...defaultEnsureClientDeps,
    ...depsOverride,
  };
  const resolution = deps.resolve();
  const cfg = resolution.config;

  if (!initialized) {
    let didFreshAuth = false;

    if (cfg.cookie) {
      await deps.configureClient({
        shipName: cfg.ship,
        shipUrl: cfg.url,
        client: deps.createCookieClient(cfg, cfg.cookie),
        getCode: resolution.fallbackCode
          ? async () => resolution.fallbackCode as string
          : undefined,
      });

      const cookieValid = await deps.validateCookie();
      if (!cookieValid) {
        const fallbackCode = resolution.fallbackCode || cfg.code;
        if (!fallbackCode) {
          throw cookieValidationError(resolution);
        }

        await deps.configureClient({
          shipName: cfg.ship,
          shipUrl: cfg.url,
          getCode: async () => fallbackCode,
        });
        didFreshAuth = true;
      }
    } else if (cfg.code) {
      await deps.configureClient({
        shipName: cfg.ship,
        shipUrl: cfg.url,
        getCode: async () => cfg.code,
      });
      didFreshAuth = true;
    } else {
      throw new Error('No cookie or code available for authentication');
    }

    if (didFreshAuth && resolution.mayWriteAuthCache) {
      const freshCookie = deps.getAuthenticatedCookie();
      if (freshCookie) {
        deps.cacheCookie(cfg.url, cfg.ship, freshCookie);
        console.error(
          `Note: Credentials cached for ${preSig(cfg.ship)}. Next time run: tlon --ship ${preSig(cfg.ship)} <command>`
        );
      }
    }

    await deps.setupSubscriptions(subs);
    initialized = true;
  }

  return cfg;
}

export function __resetApiClientForTests(): void {
  initialized = false;
  subscribed = false;
  cachedConfig = null;
  cachedResolution = null;
  cliCredentialOverrides = null;
  internalRemoveClient();
}

/**
 * Get current ship name (with ~).
 */
export async function getCurrentShip(): Promise<string> {
  const cfg = await ensureClient([]);
  return preSig(cfg.ship);
}

/**
 * Normalize ship name to include ~.
 */
export function normalizeShip(ship: string): string {
  return preSig(ship);
}
