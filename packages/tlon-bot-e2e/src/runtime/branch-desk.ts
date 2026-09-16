import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { RuntimeContext } from '../drivers/types.js';
import { runCommand } from './compose.js';
import {
  copyIntoComposeService,
  execInComposeService,
} from './docker-direct.js';

type ShipLabel = keyof RuntimeContext['endpoints']['ships'];

// Every running ship, not just the two the scenarios drive directly. ~mug is
// the reel/lure provider, so leaving it on its pier's desk makes a mixed-version
// fleet — harmless until a change bumps the negotiated %groups protocol version,
// at which point ~zod/~ten treat ~mug as a certain-mismatch and negotiate's
// poke path crashes outright (`%poke-to-mismatching-gill`) rather than deferring.
const DEFAULT_DESK_SHIPS = '~zod,~ten,~mug';
const STAGED_DESK = '/tmp/tlon-bot-e2e-groups';
const ASSEMBLE_DESK_TIMEOUT_MS = 300_000;

// The repo is bind-mounted read-only into the ships service (see
// docker/docker-compose.base.yml). desk-push has to run in there rather than on
// the host because seeding a desk that does not yet carry the push threads goes
// through the pier's conn.sock.
const DESK_PUSH_SCRIPT = '/workspace/tlon-apps/scripts/desk-push.mjs';

// The glob bot rewrites the glob hash in desk.docket-0 several times a day on
// develop. It changes no Hoon the harness exercises, and these piers have no
// route to fetch the glob it names, so it is held back entirely.
const IGNORED_PATHS = ['desk.docket-0'];

// assemble-desk.sh restamps commit.txt on every run, so letting it count as a
// change would commit and reload every agent on all three ships for nothing.
// It cannot simply be ignored either: desk/app/groups.hoon and
// desk/app/logs.hoon both import /commit/txt, groups putting it in crash
// traces and logs attaching it to telemetry, so a stale stamp makes an E2E
// failure name the pier's archived revision instead of the code under test.
// Carrying it along with any commit that happens anyway gets both.
const INCIDENTAL_PATHS = ['commit.txt'];

// A commit to a live %groups advances clay in one event, but gall reloads the
// desk's agents over the events after it. run.ts hands the ships straight to
// the bot and then to the scenarios, so without waiting for an agent on the
// desk to answer again the suite races the reload — worst on the last ship
// pushed. The old mount-based path polled this same scry before returning.
const READY_SCRY = '/~/scry/groups/groups/light.json';

// A first push to a pier whose %groups predates the push threads seeds the
// whole desk, compiles it, and reloads every agent on it. Native CI runners
// manage that in a few minutes; amd64 vere emulated under qemu (arm64 Docker
// hosts) took ~8 minutes per ship when this was measured, so the ceiling has
// to leave real headroom above that rather than sit just over it. Steady-state
// pushes are seconds. Raise it further via env instead of editing the default.
// Read lazily — the harness loads its .env file after this module is imported.
export function deskPushTimeoutMs(): number {
  const raw = process.env.TLON_BOT_E2E_DESK_READY_TIMEOUT_MS;
  if (raw === undefined || raw === '') {
    return 1_200_000;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `TLON_BOT_E2E_DESK_READY_TIMEOUT_MS must be a positive integer of milliseconds, got: ${raw}`
    );
  }
  return parsed;
}

export interface BranchDeskDependencies {
  runCommand: typeof runCommand;
  copyIntoComposeService: typeof copyIntoComposeService;
  execInComposeService: typeof execInComposeService;
  deskShips(): string | undefined;
}

const DEFAULT_DEPENDENCIES: BranchDeskDependencies = {
  runCommand,
  copyIntoComposeService,
  execInComposeService,
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

export function deskPushArgv(ship: ShipLabel): string[] {
  return [
    'node',
    DESK_PUSH_SCRIPT,
    STAGED_DESK,
    'groups',
    '--pier',
    `/data/${ship}`,
    '--wait-scry',
    READY_SCRY,
    // every ship-side phase lives inside the script — the seed, the push, and
    // the readiness poll — so the ceiling has to reach them rather than only
    // bounding the exec around them
    '--timeout',
    String(deskPushTimeoutMs()),
    ...IGNORED_PATHS.flatMap((file) => ['--ignore', file]),
    ...INCIDENTAL_PATHS.flatMap((file) => ['--incidental', file]),
  ];
}

export async function applyBranchDesk(
  ctx: RuntimeContext,
  overrides: Partial<BranchDeskDependencies> = {}
): Promise<void> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const ships = parseDeskShips(dependencies.deskShips());
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tlon-bot-e2e-desk-'));
  const deskDir = path.join(tempDir, 'groups');

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
      `${deskDir}/.`,
      STAGED_DESK
    );

    for (const ship of ships) {
      // Nothing is printed until the exec returns, and a first push to a pier
      // that predates the threads can run for minutes, so name the ship first.
      console.log(`    ~${ship}: pushing...`);
      // desk-push reports what it did and exits non-zero on a failed build,
      // carrying the compile trace, so there is nothing here to poll for.
      const result = await dependencies.execInComposeService(
        ctx,
        ctx.services.ships,
        deskPushArgv(ship),
        // A backstop against a wedged `docker exec`, not a functional limit:
        // the script bounds each of its own phases with the value passed as
        // --timeout, and reports which one gave up. A first push to a
        // pre-thread pier can run three of them back to back — seed, then the
        // delta push, then the readiness poll — with hash reads on their own
        // fixed budget in between, so this has to sit well clear of all of it
        // or it, rather than the configured budget, becomes what fails.
        { timeoutMs: deskPushTimeoutMs() * 4 }
      );
      for (const line of result.stdout.split('\n').filter(Boolean)) {
        console.log(`    ~${ship}: ${line}`);
      }
      requireSuccess(result, `push branch desk to ~${ship}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
