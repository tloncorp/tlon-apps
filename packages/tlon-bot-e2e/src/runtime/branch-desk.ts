import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { RuntimeContext, ShipEndpoint } from '../drivers/types.js';
import { runCommand } from './compose.js';
import {
  copyIntoComposeService,
  execInComposeService,
  restartComposeService,
} from './docker-direct.js';
import { waitFor, waitForShipLogin } from './waiters.js';

type ShipLabel = keyof RuntimeContext['endpoints']['ships'];

const DEFAULT_DESK_SHIPS = '~zod,~ten';
const STAGED_DESK = '/tmp/tlon-bot-e2e-groups';
const COMMIT_ATTEMPTS = 4;
const ASSEMBLE_DESK_TIMEOUT_MS = 300_000;
const MOUNT_STABLE_SAMPLES = 3;
const REQUEST_TIMEOUT_MS = 10_000;
// A desk compile can occupy vere for minutes; poll patiently rather than
// mistaking a busy ship for a dead one.
const COMMIT_REQUEST_TIMEOUT_MS = 120_000;
const DESK_READY_TIMEOUT_MS = 600_000;

class ShipUnavailableError extends Error {}
// Distinct from unavailable: the ship holds the connection but has not
// answered yet. A `%groups` commit makes vere compile the desk, which is
// CPU-bound for minutes and cannot serve eyre meanwhile — treating that as a
// dead ship and rebooting kills the compile, which is exactly what the first
// live runs did. Rube imposes no request deadline at all and classifies only
// connection-level failures (ECONNREFUSED/ECONNRESET/socket hang up) as
// unavailable; this mirrors that, keeping a generous bound so nothing hangs
// for the whole CI job.
class ShipBusyError extends Error {}
class MountedDeskUnavailableError extends Error {}

export interface BranchDeskDependencies {
  runCommand: typeof runCommand;
  copyIntoComposeService: typeof copyIntoComposeService;
  execInComposeService: typeof execInComposeService;
  restartComposeService: typeof restartComposeService;
  waitFor: typeof waitFor;
  waitForShipLogin: typeof waitForShipLogin;
  fetch: typeof fetch;
  deskShips(): string | undefined;
}

const DEFAULT_DEPENDENCIES: BranchDeskDependencies = {
  runCommand,
  copyIntoComposeService,
  execInComposeService,
  restartComposeService,
  waitFor,
  waitForShipLogin,
  fetch,
  deskShips: () => process.env.TLON_BOT_E2E_DESK_SHIPS,
};

export function parseDeskShips(
  raw: string | undefined = DEFAULT_DESK_SHIPS
): ShipLabel[] {
  const supported = new Set<ShipLabel>(['zod', 'ten', 'mug']);
  const ships = raw
    .split(',')
    .map((ship) => ship.trim().replace(/^~/, ''))
    .filter(Boolean);
  if (ships.length === 0) {
    throw new Error(
      'TLON_BOT_E2E_DESK_SHIPS must select at least one of zod, ten, or mug.'
    );
  }
  const invalid = ships.filter((ship) => !supported.has(ship as ShipLabel));
  if (invalid.length > 0) {
    throw new Error(
      `TLON_BOT_E2E_DESK_SHIPS contains unsupported ships: ${invalid.join(', ')}`
    );
  }
  return [...new Set(ships as ShipLabel[])];
}

export async function withShipRebootRetry<T>(
  action: (attempt: number) => Promise<T>,
  reboot: (attempt: number, error: unknown) => Promise<void>,
  unavailable: (error: unknown) => boolean,
  maxAttempts = COMMIT_ATTEMPTS
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      if (!unavailable(error) || attempt === maxAttempts) {
        throw error;
      }
      await reboot(attempt, error);
    }
  }
  throw new Error('Unreachable desk commit retry state.');
}

export async function createDeskManifest(deskDir: string): Promise<string> {
  const files = await listFiles(deskDir);
  const lines = await Promise.all(
    files
      // assemble-desk.sh stamps HEAD, but frontend-only commits must not force
      // an otherwise identical Hoon desk through an expensive |commit.
      .filter((file) => file !== 'commit.txt')
      .sort()
      .map(async (file) => {
        const digest = createHash('sha256')
          .update(await readFile(path.join(deskDir, file)))
          .digest('hex');
        return `${digest}  ./${file.split(path.sep).join('/')}`;
      })
  );
  return `${lines.join('\n')}\n`;
}

export async function applyBranchDesk(
  ctx: RuntimeContext,
  overrides: Partial<BranchDeskDependencies> = {}
): Promise<void> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const ships = parseDeskShips(dependencies.deskShips());
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tlon-bot-e2e-desk-'));
  const deskDir = path.join(tempDir, 'groups');
  const manifestPath = path.join(tempDir, 'manifest.sha256');

  try {
    console.log(
      `==> Applying branch %groups desk to ${ships.map((s) => `~${s}`).join(', ')}...`
    );
    const assembled = await dependencies.runCommand(
      'bash',
      [path.join(ctx.repoRoot, 'scripts/assemble-desk.sh'), deskDir],
      {
        cwd: ctx.repoRoot,
        env: processEnvRecord(),
        timeoutMs: ASSEMBLE_DESK_TIMEOUT_MS,
        // assemble-desk.sh spawns peru/git descendants that inherit the
        // stdio pipes; without a tree kill a hung fetch outlives the bound.
        killTree: true,
      }
    );
    requireSuccess(assembled, 'assemble branch desk');
    const manifest = await createDeskManifest(deskDir);
    await writeFile(manifestPath, manifest);

    await requireShipExec(ctx, dependencies, [
      'bash',
      '-c',
      'rm -rf -- "$1"; mkdir -p -- "$1"',
      'bash',
      STAGED_DESK,
    ]);
    await dependencies.copyIntoComposeService(
      ctx,
      ctx.services.ships,
      `${tempDir}/.`,
      STAGED_DESK
    );

    for (const ship of ships) {
      const endpoint = ctx.endpoints.ships[ship];
      let cookie = await login(endpoint, dependencies);
      await hoodCommand(ctx, ship, 'mount %groups', dependencies);
      await waitForMountedDeskStable(ctx, ship, dependencies);
      const startHash = await waitForGroupsHash(endpoint, cookie, dependencies);
      if (await deskMatches(ctx, ship, manifest, dependencies)) {
        console.log(`    ~${ship}: assembled desk unchanged; skipping commit`);
        continue;
      }

      console.log(`    ~${ship}: copying and committing assembled desk`);
      await withShipRebootRetry(
        async () => {
          // Replacement happens inside every attempt: a vere reboot re-syncs
          // the mount from Clay, wiping an uncommitted replacement (observed
          // on the first live run — the commit segfaulted, the reboot
          // restored the old desk, and the clobber guard refused). The
          // staged copy under /tmp survives the container restart, so
          // re-replacing is cheap; the mount is re-settled first, and the
          // assert directly after the copy still refuses a concurrent
          // clobber in the replace→commit window.
          await waitForMountedDeskStable(ctx, ship, dependencies);
          if (!(await deskMatches(ctx, ship, manifest, dependencies))) {
            await replaceMountedDesk(ctx, ship, dependencies);
            await assertDeskMatches(ctx, ship, manifest, dependencies);
          }
          if (
            (await groupsHash(endpoint, cookie, dependencies)) === startHash
          ) {
            await hoodCommand(ctx, ship, 'commit %groups', dependencies);
          }
          await waitForDeskReady(endpoint, cookie, startHash, dependencies);
        },
        async (attempt) => {
          // Vere can segfault in u3_readdir_r while rescanning a mounted desk.
          // Restarting this pre-bot ships service is the rube mitigation.
          console.log(
            `    ~${ship}: unavailable during commit readiness ` +
              `(attempt ${attempt}/${COMMIT_ATTEMPTS}); rebooting and retrying`
          );
          await dependencies.restartComposeService(ctx, ctx.services.ships);
          await Promise.all(
            Object.values(ctx.endpoints.ships).map((restarted) =>
              dependencies.waitForShipLogin(restarted.hostUrl, restarted.code, {
                timeoutMs: 120_000,
                intervalMs: 1_000,
                description: `${restarted.ship} reboot after desk commit`,
              })
            )
          );
          cookie = await login(endpoint, dependencies);
        },
        (error) => error instanceof ShipUnavailableError
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const child = path.join(relative, entry.name);
      return entry.isDirectory() ? listFiles(root, child) : [child];
    })
  );
  return files.flat();
}

async function readMountedDeskManifest(
  ctx: RuntimeContext,
  ship: ShipLabel,
  dependencies: BranchDeskDependencies
): Promise<string> {
  const result = await dependencies.execInComposeService(
    ctx,
    ctx.services.ships,
    [
      'bash',
      '-c',
      'set -euo pipefail; mount="$1"; test -d "$mount" && test -r "$mount" && test -x "$mount" || exit 20; cd "$mount"; find . -type f ! -path ./commit.txt -print0 | sort -z | xargs -0r sha256sum',
      'bash',
      `/data/${ship}/groups`,
    ]
  );
  if (result.exitCode !== 0) {
    throw new MountedDeskUnavailableError(
      `Mounted %groups desk for ~${ship} is missing or unreadable ` +
        `(exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`
    );
  }
  return result.stdout;
}

async function waitForMountedDeskStable(
  ctx: RuntimeContext,
  ship: ShipLabel,
  dependencies: BranchDeskDependencies
): Promise<void> {
  let previousManifest: string | undefined;
  let stableSamples = 0;
  await dependencies.waitFor(
    async () => {
      const manifest = await readMountedDeskManifest(ctx, ship, dependencies);
      stableSamples = manifest === previousManifest ? stableSamples + 1 : 1;
      previousManifest = manifest;
      return stableSamples >= MOUNT_STABLE_SAMPLES ? { manifest } : false;
    },
    {
      timeoutMs: 30_000,
      intervalMs: 1_000,
      description: `~${ship} %groups mount to exist and settle`,
    }
  );
}

async function deskMatches(
  ctx: RuntimeContext,
  ship: ShipLabel,
  expectedManifest: string,
  dependencies: BranchDeskDependencies
): Promise<boolean> {
  return (
    (await readMountedDeskManifest(ctx, ship, dependencies)) ===
    expectedManifest
  );
}

async function assertDeskMatches(
  ctx: RuntimeContext,
  ship: ShipLabel,
  expectedManifest: string,
  dependencies: BranchDeskDependencies
): Promise<void> {
  if (!(await deskMatches(ctx, ship, expectedManifest, dependencies))) {
    throw new Error(
      `Mounted %groups desk for ~${ship} changed after replacement; refusing to commit.`
    );
  }
}

async function replaceMountedDesk(
  ctx: RuntimeContext,
  ship: ShipLabel,
  dependencies: BranchDeskDependencies
) {
  await requireShipExec(ctx, dependencies, [
    'bash',
    '-c',
    'set -euo pipefail; target="$1"; source="$2"; mkdir -p "$target"; find "$target" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; cp -a "$source"/. "$target"/',
    'bash',
    `/data/${ship}/groups`,
    `${STAGED_DESK}/groups`,
  ]);
}

async function login(
  endpoint: ShipEndpoint,
  dependencies: BranchDeskDependencies
): Promise<string> {
  const response = await shipFetch(
    endpoint,
    'login',
    `${endpoint.hostUrl}/~/login`,
    {
      method: 'POST',
      body: new URLSearchParams({ password: endpoint.code }),
    },
    dependencies
  );
  const cookie = response.headers.get('set-cookie');
  if (!cookie?.includes('urbauth')) {
    throw new Error(
      `~${endpoint.ship.replace(/^~/, '')} login returned no urbauth cookie.`
    );
  }
  return cookie;
}

// The {source, sink} dojo payload is the lens protocol, served only by
// vere's loopback listener inside the container — the host-mapped eyre port
// 404s it (found on the first live run). Rube posts to the same loopback
// port; here the container's own node runs the request.
const HOOD_LOOPBACK_SCRIPT = [
  "const fs = require('fs');",
  'const [ship, command] = process.argv.slice(1);',
  "const lines = fs.readFileSync(`/data/${ship}/.http.ports`, 'utf8').split('\\n');",
  "const port = lines.map((l) => l.split(' ')).find((p) => p[2] === 'loopback')?.[0];",
  'if (!port) { console.error(`no loopback port for ${ship}`); process.exit(1); }',
  'fetch(`http://127.0.0.1:${port}`, {',
  "  method: 'POST',",
  "  headers: { 'Content-Type': 'application/json' },",
  '  body: JSON.stringify({ source: { dojo: `+hood/${command}` }, sink: { app: "hood" } }),',
  '}).then(async (res) => {',
  '  if (!res.ok) {',
  '    console.error(`+hood/${command} on ${ship}: HTTP ${res.status}: ${await res.text()}`);',
  '    process.exit(1);',
  '  }',
  '}, (err) => { console.error(String(err)); process.exit(1); });',
].join('\n');

async function hoodCommand(
  ctx: RuntimeContext,
  ship: ShipLabel,
  command: string,
  dependencies: BranchDeskDependencies
) {
  await requireShipExec(ctx, dependencies, [
    'node',
    '-e',
    HOOD_LOOPBACK_SCRIPT,
    ship,
    command,
  ]);
}

async function groupsHash(
  endpoint: ShipEndpoint,
  cookie: string,
  dependencies: BranchDeskDependencies,
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const data = await shipJson(
    endpoint,
    cookie,
    'read %groups desk hash',
    '/~/scry/hood/kiln/pikes.json',
    dependencies,
    timeoutMs
  );
  const hash = (data as { groups?: { hash?: unknown } }).groups?.hash;
  if (typeof hash !== 'string') {
    throw new Error(`No %groups desk hash returned by ${endpoint.ship}.`);
  }
  return hash;
}

async function waitForGroupsHash(
  endpoint: ShipEndpoint,
  cookie: string,
  dependencies: BranchDeskDependencies
) {
  return dependencies.waitFor(
    () => groupsHash(endpoint, cookie, dependencies),
    {
      timeoutMs: 30_000,
      intervalMs: 1_000,
      description: `${endpoint.ship} %groups desk in kiln`,
    }
  );
}

async function waitForDeskReady(
  endpoint: ShipEndpoint,
  cookie: string,
  startHash: string,
  dependencies: BranchDeskDependencies
) {
  await dependencies.waitFor(
    async () => {
      try {
        if (
          (await groupsHash(
            endpoint,
            cookie,
            dependencies,
            COMMIT_REQUEST_TIMEOUT_MS
          )) === startHash
        ) {
          return false;
        }
        await shipJson(
          endpoint,
          cookie,
          'check %groups app health',
          '/~/scry/groups/groups/light.json',
          dependencies,
          COMMIT_REQUEST_TIMEOUT_MS
        );
        return true;
      } catch (error) {
        // Busy compiling is progress, not death: keep polling. Only a
        // connection-level failure means vere actually went away, and that
        // rethrows to the reboot retry.
        if (error instanceof ShipBusyError) {
          return false;
        }
        throw error;
      }
    },
    {
      timeoutMs: DESK_READY_TIMEOUT_MS,
      intervalMs: 2_000,
      description: `${endpoint.ship} %groups desk ready after commit`,
      rethrowError: (error) => error instanceof ShipUnavailableError,
    }
  );
}

async function shipJson(
  endpoint: ShipEndpoint,
  cookie: string,
  action: string,
  pathname: string,
  dependencies: BranchDeskDependencies,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<unknown> {
  const response = await shipFetch(
    endpoint,
    action,
    `${endpoint.hostUrl}${pathname}`,
    {
      headers: { Cookie: cookie },
    },
    dependencies,
    timeoutMs
  );
  return response.json();
}

function isAbortTimeout(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

async function shipFetch(
  endpoint: ShipEndpoint,
  action: string,
  url: string,
  init: RequestInit,
  dependencies: BranchDeskDependencies,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  let response: Response;
  try {
    response = await dependencies.fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isAbortTimeout(error)) {
      throw new ShipBusyError(
        `${endpoint.ship} did not answer within ${timeoutMs}ms while attempting to ${action}`,
        { cause: error }
      );
    }
    throw new ShipUnavailableError(
      `${endpoint.ship} became unavailable while attempting to ${action}`,
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new Error(
      `${endpoint.ship} ${action} failed with HTTP ${response.status}: ${await response.text()}`
    );
  }
  return response;
}

async function requireShipExec(
  ctx: RuntimeContext,
  dependencies: BranchDeskDependencies,
  argv: string[]
) {
  const result = await dependencies.execInComposeService(
    ctx,
    ctx.services.ships,
    argv
  );
  requireSuccess(result, `exec in ${ctx.services.ships}`);
}

function requireSuccess(
  result: { exitCode: number; stderr: string; stdout: string },
  action: string
) {
  if (result.exitCode !== 0) {
    throw new Error(
      `${action} failed with exit ${result.exitCode}: ${(result.stderr || result.stdout).trim()}`
    );
  }
}

function processEnvRecord(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
}
