import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type {
  ExecResult,
  RuntimeContext,
  ShipEndpoint,
} from '../drivers/types.js';
import {
  type BranchDeskDependencies,
  applyBranchDesk,
  deskPushArgv,
  deskPushTimeoutMs,
  parseDeskShips,
} from './branch-desk.js';

type ShipLabel = 'zod' | 'ten' | 'mug';

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.TLON_BOT_E2E_DESK_READY_TIMEOUT_MS;
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

describe('desk push command', () => {
  test('targets the ship pier and leaves the churn files to the ship', () => {
    const argv = deskPushArgv('ten');

    expect(argv.slice(0, 2)).toEqual([
      'node',
      '/workspace/tlon-apps/scripts/desk-push.mjs',
    ]);
    expect(argv).toContain('groups');
    expect(argv.slice(argv.indexOf('--pier'))).toContain('/data/ten');
    // the glob bot rewrites desk.docket-0 on develop several times a day, and
    // these piers cannot fetch the glob it names, so it is held back outright
    expect(flagValues(argv, '--ignore')).toEqual(['desk.docket-0']);
    // the stamp must not cause a commit by itself, but groups and logs import
    // it, so it has to ride along with any commit that does happen
    expect(flagValues(argv, '--incidental')).toEqual(['commit.txt']);
  });

  test('gives the readiness poll the configured budget, and the exec more', () => {
    // the poll runs inside the script, so bounding only the exec would let a
    // slow ship fail at the script's own default no matter what is configured
    const argv = deskPushArgv('zod');
    expect(argv[argv.indexOf('--wait-timeout') + 1]).toBe(
      String(deskPushTimeoutMs())
    );
  });

  test('waits for a desk agent to serve again before returning', () => {
    // a commit to a live desk reloads every agent on it; clay advancing is not
    // the same as the desk being usable, and run.ts starts scenarios next
    const argv = deskPushArgv('zod');
    expect(argv[argv.indexOf('--wait-scry') + 1]).toBe(
      '/~/scry/groups/groups/light.json'
    );
  });
});

describe('desk push timeout', () => {
  test('defaults generously and accepts an override', () => {
    expect(deskPushTimeoutMs()).toBe(1_200_000);
    process.env.TLON_BOT_E2E_DESK_READY_TIMEOUT_MS = '90000';
    expect(deskPushTimeoutMs()).toBe(90_000);
  });

  test.each(['0', '-1', 'soon', '1.5'])('rejects %j', (raw) => {
    process.env.TLON_BOT_E2E_DESK_READY_TIMEOUT_MS = raw;
    expect(() => deskPushTimeoutMs()).toThrow(/positive integer/);
  });
});

describe('applyBranchDesk', () => {
  test('assembles once, stages once, then pushes to every selected ship', async () => {
    const execs: string[][] = [];
    const copies: [string, string][] = [];
    const ctx = context();

    await applyBranchDesk(ctx, {
      ...dependencies(),
      runCommand: vi.fn(async () => success()) as never,
      copyIntoComposeService: vi.fn(async (_c, _s, from, to) => {
        copies.push([from, to]);
      }) as never,
      execInComposeService: vi.fn(async (_c, _s, argv) => {
        execs.push(argv);
        return success({
          stdout: 'committed %groups at revision 9 (abc) in 1s',
        });
      }) as never,
    });

    // one staging copy, not one per ship
    expect(copies).toHaveLength(1);
    expect(copies[0][1]).toBe('/tmp/tlon-bot-e2e-groups');

    const pushes = execs.filter((argv) => argv.includes('--pier'));
    expect(pushes.map((argv) => argv[argv.indexOf('--pier') + 1])).toEqual([
      '/data/zod',
      '/data/ten',
      '/data/mug',
    ]);
  });

  test('honours the configured ship subset', async () => {
    const execs: string[][] = [];

    await applyBranchDesk(context(), {
      ...dependencies(),
      deskShips: () => '~zod',
      execInComposeService: vi.fn(async (_c, _s, argv) => {
        execs.push(argv);
        return success();
      }) as never,
    });

    const pushes = execs.filter((argv) => argv.includes('--pier'));
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toContain('/data/zod');
  });

  test('fails the run when a push fails, surfacing the compile trace', async () => {
    const trace = '/app/groups/hoon:<[42 5].[42 9]>\n-find.$';

    await expect(
      applyBranchDesk(context(), {
        ...dependencies(),
        execInComposeService: vi.fn(async (_c, _s, argv) =>
          argv.includes('--pier')
            ? success({ exitCode: 1, stderr: trace })
            : success()
        ) as never,
      })
    ).rejects.toThrow(
      /push branch desk to ~zod failed with exit 1[\s\S]*-find\.\$/
    );
  });

  test('stops at the first failing ship rather than pushing the rest', async () => {
    const pushed: string[] = [];

    await expect(
      applyBranchDesk(context(), {
        ...dependencies(),
        execInComposeService: vi.fn(async (_c, _s, argv) => {
          if (!argv.includes('--pier')) return success();
          pushed.push(argv[argv.indexOf('--pier') + 1]);
          return success({ exitCode: 1, stderr: 'boom' });
        }) as never,
      })
    ).rejects.toThrow(/push branch desk to ~zod/);

    expect(pushed).toEqual(['/data/zod']);
  });

  test('fails before touching any ship when the desk will not assemble', async () => {
    const exec = vi.fn(async () => success());

    await expect(
      applyBranchDesk(context(), {
        ...dependencies(),
        runCommand: vi.fn(async () =>
          success({ exitCode: 2, stderr: 'peru: fetch failed' })
        ) as never,
        execInComposeService: exec as never,
      })
    ).rejects.toThrow(/assemble branch desk failed with exit 2/);

    expect(exec).not.toHaveBeenCalled();
  });
});

function flagValues(argv: string[], flag: string): string[] {
  return argv.flatMap((arg, i) => (arg === flag ? [argv[i + 1]] : []));
}

function dependencies(): BranchDeskDependencies {
  return {
    runCommand: vi.fn(async () => success()) as never,
    copyIntoComposeService: vi.fn(async () => {}) as never,
    execInComposeService: vi.fn(async () => success()) as never,
    deskShips: () => undefined,
  };
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

function success(overrides: Partial<ExecResult> = {}): ExecResult {
  return { stdout: '', stderr: '', exitCode: 0, ...overrides };
}
