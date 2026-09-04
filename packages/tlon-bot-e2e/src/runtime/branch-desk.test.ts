import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type {
  ExecResult,
  RuntimeContext,
  ShipEndpoint,
} from '../drivers/types.js';
import {
  type BranchDeskDependencies,
  applyBranchDesk,
  createDeskManifest,
  parseDeskShips,
  withShipRebootRetry,
} from './branch-desk.js';
import { type WaitForOptions, waitFor } from './waiters.js';

const tempDirs: string[] = [];
const DESK_CONTENT = 'branch desk';
const DESK_MANIFEST = `${createHash('sha256').update(DESK_CONTENT).digest('hex')}  ./app.hoon\n`;
const OLD_MANIFEST = `${createHash('sha256').update('old desk').digest('hex')}  ./app.hoon\n`;

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe('branch desk ship set', () => {
  test('defaults to every running ship and normalizes configured ships', () => {
    expect(parseDeskShips()).toEqual(['zod', 'ten', 'mug']);
    expect(parseDeskShips(' zod, ~mug,~zod ')).toEqual(['zod', 'mug']);
  });

  test('rejects unsupported ships', () => {
    expect(() => parseDeskShips('~zod,~bus')).toThrow(/unsupported ships: bus/);
  });

  test.each(['~', ',', '   '])(
    'rejects an empty normalized ship set from %j',
    (raw) => {
      expect(() => parseDeskShips(raw)).toThrow(/must select at least one/);
    }
  );
});

describe('branch desk manifest', () => {
  test('hashes files deterministically while ignoring the commit stamp', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'branch-desk-test-'));
    tempDirs.push(root);
    await mkdir(path.join(root, 'app'));
    await writeFile(path.join(root, 'z.hoon'), 'z');
    await writeFile(path.join(root, 'app/a.hoon'), 'a');
    await writeFile(path.join(root, 'commit.txt'), 'frontend-only-change');

    const manifest = await createDeskManifest(root);
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    expect(manifest).toBe(
      `${hash('a')}  ./app/a.hoon\n${hash('z')}  ./z.hoon\n`
    );

    await writeFile(path.join(root, 'commit.txt'), 'another-commit');
    expect(await createDeskManifest(root)).toBe(manifest);
    await writeFile(path.join(root, 'z.hoon'), 'changed');
    expect(await createDeskManifest(root)).not.toBe(manifest);
  });

  test('ignores glob-bot rewrites of desk.docket-0', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'branch-desk-test-'));
    tempDirs.push(root);
    await writeFile(path.join(root, 'z.hoon'), 'z');
    await writeFile(path.join(root, 'desk.docket-0'), 'glob-0v1.aaaaa');

    const manifest = await createDeskManifest(root);
    await writeFile(path.join(root, 'desk.docket-0'), 'glob-0v1.bbbbb');
    expect(await createDeskManifest(root)).toBe(manifest);

    await writeFile(path.join(root, 'z.hoon'), 'changed');
    expect(await createDeskManifest(root)).not.toBe(manifest);
  });
});

describe('applyBranchDesk control flow', () => {
  test('waits for a stable mount and skips an unchanged desk', async () => {
    const harness = new BranchDeskHarness({ mountedManifest: DESK_MANIFEST });

    await harness.apply();

    expect(
      harness.events.filter((event) => event === 'read-mount:zod')
    ).toHaveLength(4);
    expect(harness.events).toContain('hash:zod:old-hash');
    expect(harness.events).not.toContain('replace:zod');
    expect(harness.events).not.toContain('commit:zod');
    expect(harness.events).toContain('suspend-groups:zod');
    expect(harness.events).toContain('revive-tlon:zod');
    expect(harness.events).toContain('health:zod');
    expect(harness.assembleOptions?.timeoutMs).toBe(300_000);
  });

  test('replaces a changed desk, re-hashes it, commits, and waits for app health', async () => {
    const harness = new BranchDeskHarness({ mountedManifest: OLD_MANIFEST });

    await harness.apply();

    const replaceIndex = harness.events.indexOf('replace:zod');
    const commitIndex = harness.events.indexOf('commit:zod');
    expect(replaceIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(replaceIndex);
    expect(harness.events.slice(replaceIndex + 1, commitIndex)).toContain(
      'read-mount:zod'
    );
    expect(harness.events).toContain('health:zod');
    expect(harness.restartComposeService).not.toHaveBeenCalled();
  });

  test('refuses to commit when a late mount clobber changes the replacement', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: OLD_MANIFEST,
      clobberAfterReplace: true,
    });

    await expect(harness.apply()).rejects.toThrow(
      /changed after replacement; refusing to commit/
    );
    expect(harness.events).not.toContain('commit:zod');
  });

  test('routes a commit-time connection failure into the reboot retry', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: OLD_MANIFEST,
      commitConnectionFailures: 1,
    });

    await harness.apply();

    expect(harness.restartComposeService).toHaveBeenCalledTimes(1);
    expect(
      harness.events.filter((event) => event === 'commit:zod')
    ).toHaveLength(2);
  });

  test('retries when the ship becomes unavailable during final readiness', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: OLD_MANIFEST,
      healthUnavailable: 1,
    });

    await harness.apply();

    expect(harness.restartComposeService).toHaveBeenCalledTimes(1);
    expect(
      harness.events.filter((event) => event === 'commit:zod')
    ).toHaveLength(1);
    expect(
      harness.events.filter((event) => event === 'health:zod')
    ).toHaveLength(2);
  });

  test('waits for zod, ten, and mug after restarting the shared ships service', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: OLD_MANIFEST,
      healthUnavailable: 1,
    });

    await harness.apply();

    expect(harness.waitedShipUrls).toEqual([
      'http://zod.test',
      'http://ten.test',
      'http://mug.test',
    ]);
  });

  test('treats a missing mount as unavailable instead of as a mismatch', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: DESK_MANIFEST,
      mountReads: ['missing'],
    });

    await harness.apply();

    const firstHashIndex = harness.events.findIndex((event) =>
      event.startsWith('hash:zod:')
    );
    expect(harness.events.slice(0, firstHashIndex)).toContain(
      'mount-unavailable:zod'
    );
    expect(harness.events).not.toContain('replace:zod');
  });

  test('surfaces the unavailable error after the fourth readiness attempt', async () => {
    const harness = new BranchDeskHarness({
      mountedManifest: OLD_MANIFEST,
      healthUnavailable: Number.POSITIVE_INFINITY,
    });

    await expect(harness.apply()).rejects.toThrow(
      /became unavailable while attempting to check %groups app health/
    );
    expect(harness.restartComposeService).toHaveBeenCalledTimes(3);
    expect(
      harness.events.filter((event) => event === 'health:zod')
    ).toHaveLength(4);
    expect(
      harness.events.filter((event) => event === 'commit:zod')
    ).toHaveLength(1);
  });

  test('bounds desk assembly and reports its action when the command times out', async () => {
    const harness = new BranchDeskHarness({
      assemblyResult: {
        exitCode: 143,
        stderr: 'assemble-desk.sh timed out after 300000ms',
      },
    });

    await expect(harness.apply()).rejects.toThrow(
      /assemble branch desk failed.*timed out after 300000ms/
    );
    expect(harness.assembleOptions?.timeoutMs).toBe(300_000);
  });
});

describe('branch desk commit retry', () => {
  test('reboots only for unavailable failures and stops after success', async () => {
    const unavailable = { unavailable: true };
    const attempts: number[] = [];
    const reboots: number[] = [];
    const action = vi.fn(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) throw unavailable;
      return 'ok';
    });
    const reboot = vi.fn(async (attempt: number) => {
      reboots.push(attempt);
    });

    await expect(
      withShipRebootRetry(action, reboot, (error) => error === unavailable)
    ).resolves.toBe('ok');
    expect(attempts).toEqual([1, 2, 3]);
    expect(reboots).toEqual([1, 2]);
  });

  test('does not reboot for an ordinary commit error or after the final try', async () => {
    const ordinary = new Error('compile failed');
    const reboot = vi.fn(async () => {});
    await expect(
      withShipRebootRetry(
        async () => {
          throw ordinary;
        },
        reboot,
        () => false
      )
    ).rejects.toBe(ordinary);
    expect(reboot).not.toHaveBeenCalled();

    const unavailable = new Error('gone');
    await expect(
      withShipRebootRetry(
        async () => {
          throw unavailable;
        },
        reboot,
        () => true,
        3
      )
    ).rejects.toBe(unavailable);
    expect(reboot).toHaveBeenCalledTimes(2);
  });
});

describe('branch desk readiness polling', () => {
  test('rethrows classified unavailable errors without converting them to timeouts', async () => {
    const unavailable = new Error('ship unavailable');

    await expect(
      waitFor(
        async () => {
          throw unavailable;
        },
        {
          timeoutMs: 1_000,
          description: 'ship readiness',
          rethrowError: (error) => error === unavailable,
        }
      )
    ).rejects.toBe(unavailable);
  });
});

type ShipLabel = keyof RuntimeContext['endpoints']['ships'];
type MountRead = string | 'missing';

interface HarnessOptions {
  mountedManifest?: string;
  mountReads?: MountRead[];
  clobberAfterReplace?: boolean;
  healthUnavailable?: number;
  assemblyResult?: Partial<ExecResult>;
  commitConnectionFailures?: number;
}

class BranchDeskHarness {
  readonly ctx = context();
  readonly events: string[] = [];
  readonly waitedShipUrls: string[] = [];
  readonly restartComposeService = vi.fn(async () => {
    this.events.push('restart-ships');
  });
  assembleOptions:
    | {
        env: Record<string, string>;
        cwd: string;
        stream?: boolean;
        timeoutMs?: number;
      }
    | undefined;

  private readonly options: HarnessOptions;
  private readonly mountReads: MountRead[];
  private mountedManifests: Record<ShipLabel, string>;
  private hashes: Record<ShipLabel, string> = {
    zod: 'old-hash',
    ten: 'old-hash',
    mug: 'old-hash',
  };
  private unavailableHealthChecks = 0;
  private commitConnectionFailuresRemaining: number;

  constructor(options: HarnessOptions = {}) {
    this.options = options;
    this.mountReads = [...(options.mountReads ?? [])];
    const mounted = options.mountedManifest ?? OLD_MANIFEST;
    this.mountedManifests = { zod: mounted, ten: mounted, mug: mounted };
    this.commitConnectionFailuresRemaining =
      options.commitConnectionFailures ?? 0;
  }

  async apply(): Promise<void> {
    await applyBranchDesk(this.ctx, this.dependencies());
  }

  private dependencies(): Partial<BranchDeskDependencies> {
    return {
      deskShips: () => '~zod',
      runCommand: this.runCommand,
      execInComposeService: this.execInComposeService,
      copyIntoComposeService: vi.fn(async () => {
        this.events.push('copy-stage');
      }),
      restartComposeService: this.restartComposeService,
      waitFor: immediateWaitFor,
      waitForShipLogin: vi.fn(async (url: string) => {
        this.waitedShipUrls.push(url);
      }),
      fetch: this.shipFetch,
    };
  }

  private readonly runCommand: BranchDeskDependencies['runCommand'] = async (
    _command,
    args,
    opts
  ) => {
    this.assembleOptions = opts;
    this.events.push('assemble');
    if (this.options.assemblyResult) {
      return success(this.options.assemblyResult);
    }
    await mkdir(args[1], { recursive: true });
    await writeFile(path.join(args[1], 'app.hoon'), DESK_CONTENT);
    return success();
  };

  private readonly execInComposeService: BranchDeskDependencies['execInComposeService'] =
    async (_ctx, _service, argv) => {
      const script = argv[2] ?? '';
      if (
        argv[1] === '-c' &&
        script.includes('tlon-bot-e2e-revive.log') &&
        argv[6] === 'clay/revive %tlon'
      ) {
        this.events.push(`revive-tlon:${argv[5] as ShipLabel}`);
        return success();
      }
      if (argv[1] === '-e' && script.includes('+hood/')) {
        const ship = argv[3] as ShipLabel;
        const command = argv[4] ?? '';
        if (command === 'mount %tlon') {
          this.events.push(`mount:${ship}`);
          return success();
        }
        if (command === 'clay/suspend %groups') {
          this.events.push(`suspend-groups:${ship}`);
          return success();
        }
        if (command === 'commit %tlon') {
          this.events.push(`commit:${ship}`);
          if (this.commitConnectionFailuresRemaining > 0) {
            this.commitConnectionFailuresRemaining -= 1;
            // The loopback script's connection-level exit: vere died while
            // the +hood/commit request was in flight.
            return success({
              exitCode: 21,
              stderr: 'TypeError: fetch failed (ECONNREFUSED)',
            });
          }
          this.hashes[ship] = 'new-hash';
          return success();
        }
        throw new Error(`unexpected hood command: ${command}`);
      }
      if (script.startsWith('rm -rf')) {
        this.events.push('clear-stage');
        return success();
      }
      if (script.includes('mount="$1"')) {
        const ship = shipFromPath(argv[4]);
        this.events.push(`read-mount:${ship}`);
        const reading = this.mountReads.shift();
        if (reading === 'missing') {
          this.events.push(`mount-unavailable:${ship}`);
          return success({ exitCode: 1, stderr: 'mount missing' });
        }
        return success({ stdout: reading ?? this.mountedManifests[ship] });
      }
      if (script.includes('target="$1"; source="$2"')) {
        const ship = shipFromPath(argv[4]);
        this.events.push(`replace:${ship}`);
        this.mountedManifests[ship] = this.options.clobberAfterReplace
          ? OLD_MANIFEST
          : DESK_MANIFEST;
        return success();
      }
      throw new Error(`Unexpected ship exec: ${argv.join(' ')}`);
    };

  private readonly shipFetch: BranchDeskDependencies['fetch'] = async (
    input,
    init
  ) => {
    const url = String(input);
    const ship = shipFromUrl(url);
    if (url.endsWith('/~/login')) {
      this.events.push(`login:${ship}`);
      return new Response('', {
        status: 200,
        headers: { 'set-cookie': 'urbauth-test=1' },
      });
    }
    if (url.endsWith('/~/scry/hood/kiln/pikes.json')) {
      this.events.push(`hash:${ship}:${this.hashes[ship]}`);
      return jsonResponse({ tlon: { hash: this.hashes[ship] } });
    }
    if (url.endsWith('/~/scry/groups/groups/light.json')) {
      this.events.push(`health:${ship}`);
      if (
        this.unavailableHealthChecks < (this.options.healthUnavailable ?? 0)
      ) {
        this.unavailableHealthChecks += 1;
        throw new Error('vere unavailable');
      }
      return jsonResponse({ ok: true });
    }
    throw new Error(`Unexpected ship fetch: ${url}`);
  };
}

async function immediateWaitFor<T>(
  fn: () => Promise<T | undefined | false | null>,
  opts: WaitForOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      if (opts.rethrowError?.(error)) {
        throw error;
      }
      lastError = error;
    }
  }
  throw new Error(
    `Test wait exhausted for ${opts.description}: ${String(lastError ?? '')}`
  );
}

function context(): RuntimeContext {
  const endpoint = (ship: ShipLabel): ShipEndpoint => ({
    ship: `~${ship}`,
    code: `${ship}-code`,
    containerUrl: `http://${ship}:8080`,
    hostUrl: `http://${ship}.test`,
    hostPort: 8080,
  });
  return {
    repoRoot: '/repo',
    packageDir: '/repo/packages/tlon-bot-e2e',
    composeProjectName: 'branch-desk-unit',
    composeFiles: [],
    composeEnv: {},
    services: {
      ships: 'ships',
      bot: 'bot',
      fakeModel: 'fake-model',
      logServices: [],
    },
    endpoints: {
      ships: {
        zod: endpoint('zod'),
        ten: endpoint('ten'),
        mug: endpoint('mug'),
      },
    },
  } as unknown as RuntimeContext;
}

function shipFromPath(value: string): ShipLabel {
  const ship = value.split('/')[2];
  if (ship === 'zod' || ship === 'ten' || ship === 'mug') {
    return ship;
  }
  throw new Error(`Unexpected ship path: ${value}`);
}

function shipFromUrl(value: string): ShipLabel {
  const ship = new URL(value).hostname.split('.')[0];
  if (ship === 'zod' || ship === 'ten' || ship === 'mug') {
    return ship;
  }
  throw new Error(`Unexpected ship URL: ${value}`);
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function success(overrides: Partial<ExecResult> = {}): ExecResult {
  return { stdout: '', stderr: '', exitCode: 0, ...overrides };
}
