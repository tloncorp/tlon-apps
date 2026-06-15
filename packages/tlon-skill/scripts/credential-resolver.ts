import * as path from 'path';

export interface UrbitConfig {
  url: string;
  ship: string;
  /** Access code (required unless cookie is provided/cached) */
  code: string;
  /** Pre-authenticated cookie (optional, bypasses code-based auth) */
  cookie?: string;
}

export interface CachedAuth {
  url: string;
  ship: string;
  cookie: string;
  cachedAt?: number;
}

export type CredentialOrigin =
  | 'cli'
  | 'config-file'
  | 'env-cookie'
  | 'env-code'
  | 'skill-dir'
  | 'openclaw'
  | 'ship-cache'
  | 'single-cache';

export type AuthKind = 'cookie' | 'code' | 'cached-cookie';

export type ShipProvenance =
  | 'cli'
  | 'env'
  | 'cookie'
  | 'config-file'
  | 'skill-dir'
  | 'openclaw'
  | 'cache';

export interface CredentialResolution {
  config: UrbitConfig;
  origin: CredentialOrigin;
  authKind: AuthKind;
  mayReadAuthCache: boolean;
  mayWriteAuthCache: boolean;
  fallbackCode?: string;
  provenance: {
    selectedBy?: 'cli' | 'env' | 'fallback';
    ship?: ShipProvenance;
    configPath?: string;
    cachePath?: string;
    openclawPath?: string;
  };
}

export type CliCredentialOverrides =
  | { kind: 'config'; configFile: string }
  | {
      kind: 'cookie';
      url: string;
      cookie: string;
      ship?: string;
      code?: string;
    }
  | { kind: 'code'; url: string; ship: string; code: string }
  | { kind: 'ship'; ship: string };

export interface ResolverFileSystem {
  exists(filePath: string): boolean;
  readFile(filePath: string): string;
  readDir(dirPath: string): string[];
}

export interface CredentialResolverInput {
  env: Record<string, string | undefined>;
  fs: ResolverFileSystem;
  cacheDir: string;
  homeDir: string;
  cli?: CliCredentialOverrides | null;
  openclawDefaultPaths?: string[];
}

interface CachedAuthCandidate extends CachedAuth {
  cachePath: string;
}

type TopLevelConfigSource = 'config-file' | 'skill-dir';

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function normalizeShipName(ship: string): string {
  return ship.replace(/^~/, '');
}

function withSig(ship: string): string {
  return `~${normalizeShipName(ship)}`;
}

export function parseShipFromCookie(cookie: string): string | null {
  const match = cookie.match(/urbauth-~?([a-z-]+)=/);
  return match ? match[1] : null;
}

function parseJsonFile(filePath: string, fsDeps: ResolverFileSystem): unknown {
  try {
    return JSON.parse(fsDeps.readFile(filePath));
  } catch (err: any) {
    throw new Error(`Failed to parse config ${filePath}: ${err.message}`);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function makeResolution(
  config: UrbitConfig,
  origin: CredentialOrigin,
  authKind: AuthKind,
  provenance: CredentialResolution['provenance'],
  fallbackCode?: string
): CredentialResolution {
  return {
    config,
    origin,
    authKind,
    mayReadAuthCache: authKind === 'cached-cookie',
    mayWriteAuthCache: authKind === 'code' || !!fallbackCode,
    fallbackCode,
    provenance,
  };
}

function resolutionFromTopLevelConfig(
  filePath: string,
  fsDeps: ResolverFileSystem,
  origin: TopLevelConfigSource,
  selectedBy: 'cli' | 'env',
  shipProvenance: ShipProvenance = origin,
  forcedShip?: string
): CredentialResolution {
  if (!fsDeps.exists(filePath)) {
    throw new Error(`Ship config not found: ${filePath}`);
  }

  const data = asObject(parseJsonFile(filePath, fsDeps));
  if (!nonEmpty(data.url)) {
    throw new Error('Invalid config: must have url');
  }

  const code = nonEmpty(data.code) ? data.code : '';
  const cookie = nonEmpty(data.cookie) ? data.cookie : undefined;
  if (!code && !cookie) {
    throw new Error('Invalid config: must have code or cookie');
  }

  let ship = forcedShip
    ? normalizeShipName(forcedShip)
    : nonEmpty(data.ship)
      ? normalizeShipName(data.ship)
      : null;
  if (
    forcedShip &&
    nonEmpty(data.ship) &&
    normalizeShipName(data.ship) !== ship
  ) {
    throw new Error(
      `Invalid config: ship ${withSig(data.ship)} does not match requested ship ${withSig(forcedShip)}`
    );
  }
  let derivedShip = false;
  if (!ship && cookie) {
    ship = parseShipFromCookie(cookie);
    derivedShip = !!ship;
  }
  if (!ship) {
    throw new Error(
      'Invalid config: must have ship (or cookie with ship in name)'
    );
  }

  const config = {
    url: data.url,
    ship,
    code,
    cookie,
  };
  const authKind: AuthKind = cookie ? 'cookie' : 'code';
  return makeResolution(
    config,
    origin,
    authKind,
    {
      selectedBy,
      ship: forcedShip
        ? shipProvenance
        : derivedShip
          ? 'cookie'
          : shipProvenance,
      configPath: filePath,
    },
    cookie && code ? code : undefined
  );
}

function envAlias(
  env: Record<string, string | undefined>,
  urbitName: string,
  tlonName: string
): string | undefined {
  return nonEmpty(env[urbitName])
    ? env[urbitName]
    : nonEmpty(env[tlonName])
      ? env[tlonName]
      : undefined;
}

function validateAmbientPartial(
  url: string | undefined,
  ship: string | undefined,
  cookie: string | undefined,
  code: string | undefined
): void {
  const hasAnyCredential = !!url || !!ship || !!cookie || !!code;
  if (!hasAnyCredential) return;

  const shipOnly = !!ship && !url && !cookie && !code;
  const cookieForm = !!url && !!cookie;
  const codeForm = !!url && !!ship && !!code;
  if (shipOnly || cookieForm || codeForm) return;

  throw new Error(
    'Invalid ambient credentials: use URBIT_URL/TLON_URL with URBIT_COOKIE/TLON_COOKIE, ' +
      'or URL + SHIP + CODE. Ship-only env is only valid for skill-dir/cache lookup.'
  );
}

function resolutionFromCookie(
  origin: CredentialOrigin,
  url: string,
  cookie: string,
  ship: string | undefined,
  code: string | undefined,
  selectedBy: 'cli' | 'env',
  explicitShipProvenance: ShipProvenance
): CredentialResolution {
  const derivedShip = ship
    ? normalizeShipName(ship)
    : parseShipFromCookie(cookie);
  if (!derivedShip) {
    throw new Error(
      'Invalid config: must have ship (or cookie with ship in name)'
    );
  }

  const fallbackCode = code || undefined;
  return makeResolution(
    {
      url,
      ship: derivedShip,
      code: fallbackCode || '',
      cookie,
    },
    origin,
    'cookie',
    {
      selectedBy,
      ship: ship ? explicitShipProvenance : 'cookie',
    },
    fallbackCode
  );
}

function resolutionFromCode(
  origin: CredentialOrigin,
  url: string,
  ship: string,
  code: string,
  selectedBy: 'cli' | 'env',
  shipProvenance: ShipProvenance
): CredentialResolution {
  return makeResolution(
    {
      url,
      ship: normalizeShipName(ship),
      code,
    },
    origin,
    'code',
    {
      selectedBy,
      ship: shipProvenance,
    }
  );
}

export function getDefaultOpenClawConfigPaths(homeDir: string): string[] {
  return [
    path.join(homeDir, '.openclaw', 'openclaw.json'),
    path.join(homeDir, '.clawdbot', 'moltbot.json'),
    path.join(homeDir, '.moltbot', 'moltbot.json'),
  ];
}

function hasPlaceholder(value: string | undefined): boolean {
  return !!value && (value.includes('${') || /^<[^>]+>$/.test(value));
}

function parseOpenClawConfig(
  filePath: string,
  fsDeps: ResolverFileSystem
): CredentialResolution {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fsDeps.readFile(filePath));
  } catch (err: any) {
    throw new Error(
      `Failed to parse OpenClaw config ${filePath}: ${err.message}`
    );
  }

  const root = asObject(parsed);
  const channels = asObject(root.channels);
  const tlon = asObject(channels.tlon);

  if (!root.channels || !channels.tlon) {
    throw new Error(
      `OpenClaw config unusable: missing channels.tlon in ${filePath}`
    );
  }

  const url = nonEmpty(tlon.url) ? tlon.url : undefined;
  const code = nonEmpty(tlon.code) ? tlon.code : '';
  const cookie = nonEmpty(tlon.cookie) ? tlon.cookie : undefined;
  const rawShip = nonEmpty(tlon.ship) ? tlon.ship : undefined;

  if (
    hasPlaceholder(url) ||
    hasPlaceholder(code) ||
    hasPlaceholder(cookie) ||
    hasPlaceholder(rawShip)
  ) {
    throw new Error(
      `OpenClaw config unusable: contains placeholder values in ${filePath}`
    );
  }
  if (!url) {
    throw new Error(
      `OpenClaw config unusable: missing tlon.url in ${filePath}`
    );
  }
  if (!code && !cookie) {
    throw new Error(
      `OpenClaw config unusable: must have tlon.code or tlon.cookie in ${filePath}`
    );
  }

  let ship = rawShip ? normalizeShipName(rawShip) : null;
  let derivedShip = false;
  if (!ship && cookie) {
    ship = parseShipFromCookie(cookie);
    derivedShip = !!ship;
  }
  if (!ship) {
    throw new Error(
      `OpenClaw config unusable: must have tlon.ship or cookie ship in ${filePath}`
    );
  }

  return makeResolution(
    {
      url,
      ship,
      code,
      cookie,
    },
    'openclaw',
    cookie ? 'cookie' : 'code',
    {
      selectedBy: 'fallback',
      ship: derivedShip ? 'cookie' : 'openclaw',
      openclawPath: filePath,
    },
    cookie && code ? code : undefined
  );
}

function resolveOpenClaw(
  input: CredentialResolverInput
): CredentialResolution | null {
  const explicitPath = input.env.OPENCLAW_CONFIG;
  if (nonEmpty(explicitPath)) {
    if (!input.fs.exists(explicitPath)) return null;
    return parseOpenClawConfig(explicitPath, input.fs);
  }

  const paths =
    input.openclawDefaultPaths ?? getDefaultOpenClawConfigPaths(input.homeDir);
  for (const configPath of paths) {
    if (!input.fs.exists(configPath)) continue;
    try {
      return parseOpenClawConfig(configPath, input.fs);
    } catch {
      // Default OpenClaw discovery is best-effort. Explicit OPENCLAW_CONFIG is authoritative.
    }
  }

  return null;
}

export function getCachePath(cacheDir: string, ship: string): string {
  return path.join(cacheDir, `${normalizeShipName(ship)}.json`);
}

function cacheError(message: string): Error {
  return new Error(`Invalid cache entry: ${message}`);
}

function parseCacheFile(
  filePath: string,
  raw: string,
  expected?: { ship?: string; url?: string }
): CachedAuthCandidate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    throw cacheError(`${filePath} is not valid JSON: ${err.message}`);
  }

  const data = asObject(parsed);
  if (!nonEmpty(data.url) || !nonEmpty(data.ship) || !nonEmpty(data.cookie)) {
    throw cacheError(`${filePath} must have url, ship, and cookie`);
  }

  const storedShip = normalizeShipName(data.ship);
  const fileShip = normalizeShipName(path.basename(filePath, '.json'));
  if (fileShip !== storedShip) {
    throw cacheError(
      `${filePath} filename ship ${withSig(fileShip)} does not match stored ship ${withSig(storedShip)}`
    );
  }

  if (expected?.ship && storedShip !== normalizeShipName(expected.ship)) {
    throw cacheError(
      `${filePath} stored ship ${withSig(storedShip)} does not match requested ship ${withSig(expected.ship)}`
    );
  }

  if (expected?.url && data.url !== expected.url) {
    throw cacheError(
      `${filePath} stored URL ${data.url} does not match requested URL ${expected.url}`
    );
  }

  return {
    url: data.url,
    ship: storedShip,
    cookie: data.cookie,
    cachedAt: typeof data.cachedAt === 'number' ? data.cachedAt : undefined,
    cachePath: filePath,
  };
}

export function readCachedEntryForShip(
  cacheDir: string,
  ship: string,
  fsDeps: ResolverFileSystem,
  expectedUrl?: string
): CachedAuthCandidate | null {
  const normalizedShip = normalizeShipName(ship);
  const cachePath = getCachePath(cacheDir, normalizedShip);
  if (!fsDeps.exists(cachePath)) return null;
  return parseCacheFile(cachePath, fsDeps.readFile(cachePath), {
    ship: normalizedShip,
    url: expectedUrl,
  });
}

export function readCachedShipCandidates(
  cacheDir: string,
  fsDeps: ResolverFileSystem,
  options: { ignoreInvalid?: boolean } = {}
): CachedAuthCandidate[] {
  if (!fsDeps.exists(cacheDir)) return [];

  let files: string[];
  try {
    files = fsDeps
      .readDir(cacheDir)
      .filter((file) => file.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }

  const candidates: CachedAuthCandidate[] = [];
  const seenShips = new Map<string, string>();

  for (const file of files) {
    const filePath = path.join(cacheDir, file);
    let candidate: CachedAuthCandidate;
    try {
      candidate = parseCacheFile(filePath, fsDeps.readFile(filePath));
    } catch (err) {
      if (options.ignoreInvalid) continue;
      throw err;
    }

    const previousPath = seenShips.get(candidate.ship);
    if (previousPath) {
      throw new Error(
        `Duplicate cached credentials for ${withSig(candidate.ship)}: ${previousPath} and ${candidate.cachePath}`
      );
    }
    seenShips.set(candidate.ship, candidate.cachePath);
    candidates.push(candidate);
  }

  return candidates;
}

function resolutionFromCachedEntry(
  entry: CachedAuthCandidate,
  origin: 'ship-cache' | 'single-cache',
  selectedBy: 'cli' | 'env' | 'fallback' = origin === 'ship-cache'
    ? 'env'
    : 'fallback'
): CredentialResolution {
  return makeResolution(
    {
      url: entry.url,
      ship: entry.ship,
      code: '',
      cookie: entry.cookie,
    },
    origin,
    'cached-cookie',
    {
      selectedBy,
      ship: 'cache',
      cachePath: entry.cachePath,
    }
  );
}

function resolveShipOnly(
  input: CredentialResolverInput,
  ship: string,
  selectedBy: 'cli' | 'env',
  terminalOnCacheMiss: boolean
): CredentialResolution | null {
  const normalizedShip = normalizeShipName(ship);
  const skillDir = input.env.TLON_SKILL_DIR;
  if (nonEmpty(skillDir)) {
    const skillConfigPath = path.join(
      skillDir,
      'ships',
      `${normalizedShip}.json`
    );
    if (input.fs.exists(skillConfigPath)) {
      return resolutionFromTopLevelConfig(
        skillConfigPath,
        input.fs,
        'skill-dir',
        selectedBy,
        selectedBy === 'cli' ? 'cli' : 'env',
        normalizedShip
      );
    }
  }

  const cached = readCachedEntryForShip(
    input.cacheDir,
    normalizedShip,
    input.fs
  );
  if (cached) {
    return resolutionFromCachedEntry(cached, 'ship-cache', selectedBy);
  }

  if (terminalOnCacheMiss) {
    throw new Error(
      `No cached credentials found for ${withSig(normalizedShip)}. ` +
        'Authenticate with --url + --ship + --code, or configure TLON_SKILL_DIR.'
    );
  }
  return null;
}

function resolveCli(
  input: CredentialResolverInput,
  cli: CliCredentialOverrides
): CredentialResolution {
  switch (cli.kind) {
    case 'config':
      return resolutionFromTopLevelConfig(
        cli.configFile,
        input.fs,
        'config-file',
        'cli',
        'config-file'
      );
    case 'cookie':
      return resolutionFromCookie(
        'cli',
        cli.url,
        cli.cookie,
        cli.ship,
        cli.code,
        'cli',
        'cli'
      );
    case 'code':
      return resolutionFromCode(
        'cli',
        cli.url,
        cli.ship,
        cli.code,
        'cli',
        'cli'
      );
    case 'ship':
      return resolveShipOnly(
        input,
        cli.ship,
        'cli',
        true
      ) as CredentialResolution;
  }
}

function missingConfigError(): Error {
  return new Error(
    'Missing Urbit config. Either:\n' +
      '  - Use CLI flags: --config <file>, --url + --cookie, --url + --ship + --code, or --ship <ship> when available in TLON_SKILL_DIR or cache\n' +
      '  - Set TLON_CONFIG_FILE to a JSON config file\n' +
      '  - Set URBIT_URL/TLON_URL with URBIT_COOKIE/TLON_COOKIE\n' +
      '  - Set URL + SHIP + CODE via URBIT_* or TLON_* env vars\n' +
      '  - Set TLON_SHIP + TLON_SKILL_DIR for ships/<ship>.json\n' +
      '  - Configure Tlon channel in OpenClaw JSON (~/.openclaw/openclaw.json)'
  );
}

export function resolveCredentials(
  input: CredentialResolverInput
): CredentialResolution {
  if (input.cli) {
    return resolveCli(input, input.cli);
  }

  const configFile = input.env.TLON_CONFIG_FILE;
  if (nonEmpty(configFile)) {
    return resolutionFromTopLevelConfig(
      configFile,
      input.fs,
      'config-file',
      'env',
      'config-file'
    );
  }

  const url = envAlias(input.env, 'URBIT_URL', 'TLON_URL');
  const ship = envAlias(input.env, 'URBIT_SHIP', 'TLON_SHIP');
  const cookie = envAlias(input.env, 'URBIT_COOKIE', 'TLON_COOKIE');
  const code = envAlias(input.env, 'URBIT_CODE', 'TLON_CODE');

  validateAmbientPartial(url, ship, cookie, code);

  if (url && cookie) {
    return resolutionFromCookie(
      'env-cookie',
      url,
      cookie,
      ship,
      code,
      'env',
      ship ? 'env' : 'cookie'
    );
  }

  if (url && ship && code) {
    return resolutionFromCode('env-code', url, ship, code, 'env', 'env');
  }

  if (ship) {
    const shipResolution = resolveShipOnly(input, ship, 'env', false);
    if (shipResolution) return shipResolution;
  }

  const openclawResolution = resolveOpenClaw(input);
  if (openclawResolution) return openclawResolution;

  const cachedShips = readCachedShipCandidates(input.cacheDir, input.fs, {
    ignoreInvalid: true,
  });
  if (cachedShips.length === 1) {
    return resolutionFromCachedEntry(cachedShips[0], 'single-cache');
  }
  if (cachedShips.length > 1) {
    const shipList = cachedShips
      .map((entry) => `  ${withSig(entry.ship)}`)
      .join('\n');
    throw new Error(
      `Multiple cached ships found. Specify which with --ship:\n${shipList}`
    );
  }

  throw missingConfigError();
}
