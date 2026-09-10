import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { RuntimeContext } from '../drivers/types.js';
import {
  type CronCleanupTarget,
  cleanupCronJobAndArtifacts,
  listCronJobs,
  settleCronJobCreation,
  waitForCronJobCreated,
  waitForCronJobRemoved,
} from '../scenarios/shared/cron.js';

const docker = vi.hoisted(() => ({
  execInContainer: vi.fn(),
  resolveComposeContainer: vi.fn(),
}));

vi.mock('../runtime/docker-direct.js', () => docker);

const context = {
  packageDir: '/repo/packages/tlon-bot-e2e',
  composeProjectName: 'tlon-bot-e2e-unit',
  composeEnv: {},
  services: { bot: 'bot' },
} as RuntimeContext;

describe('cron scenario lifecycle helpers', () => {
  beforeEach(() => {
    docker.execInContainer.mockReset();
    docker.resolveComposeContainer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('lists all OpenClaw jobs with the deadline-derived CLI timeout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    docker.execInContainer.mockResolvedValueOnce(
      result({ jobs: [{ id: 'one', name: 'job' }] })
    );

    await expect(
      listCronJobs(context, 'openclaw', {
        containerId: 'container-id',
        deadlineAtMs: 11_000,
        commandTimeoutMs: 10_000,
      })
    ).resolves.toEqual([{ id: 'one', name: 'job' }]);
    expect(docker.execInContainer).toHaveBeenCalledWith(
      context,
      'container-id',
      ['openclaw', 'cron', 'list', '--all', '--json', '--timeout', '10000'],
      { timeoutMs: 10_000 }
    );
  });

  test('rejects a bare OpenClaw list array so CLI contract drift is visible', async () => {
    docker.execInContainer.mockResolvedValueOnce(
      result([{ id: 'one', name: 'job' }])
    );

    await expect(
      listCronJobs(context, 'openclaw', {
        containerId: 'container-id',
        deadlineAtMs: Date.now() + 10_000,
        commandTimeoutMs: 10_000,
      })
    ).rejects.toThrow(/JSON object with a jobs array/);
  });

  test('treats disabled jobs as present while waiting for removal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'disabled-id', name: 'job', enabled: false }] })
      )
      .mockResolvedValueOnce(result({ jobs: [] }));

    const wait = waitForCronJobRemoved(
      context,
      'openclaw',
      'disabled-id',
      2_000
    );
    await vi.advanceTimersByTimeAsync(500);
    await expect(wait).resolves.toBeUndefined();
    expect(docker.execInContainer).toHaveBeenCalledTimes(2);
    expect(docker.resolveComposeContainer).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['creation', waitForCronJobCreated, 'job'],
    ['removal', waitForCronJobRemoved, 'job-id'],
  ] as const)(
    'clips each %s poll to the remaining deadline and resolves once',
    async (_kind, waitForJob, needle) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      docker.resolveComposeContainer.mockImplementation(async () => {
        vi.setSystemTime(40);
        return 'container-id';
      });
      docker.execInContainer.mockImplementation(
        async (_ctx, _id, _argv, opts) => {
          expect(opts.timeoutMs).toBe(10);
          vi.setSystemTime(50);
          return result({
            jobs: _kind === 'removal' ? [{ id: 'job-id', name: 'job' }] : [],
          });
        }
      );

      await expect(waitForJob(context, 'openclaw', needle, 50)).rejects.toThrow(
        /Timeout waiting|deadline expired/
      );
      expect(docker.resolveComposeContainer).toHaveBeenCalledTimes(1);
      expect(docker.execInContainer).toHaveBeenCalledTimes(1);
    }
  );

  test.each(['prompt-first', 'lookup-first'])(
    'prioritizes the creation prompt failure regardless of rejection order (%s)',
    async (order) => {
      const target: CronCleanupTarget = {
        name: 'job',
        creationSettled: Promise.resolve(),
      };
      const prompt = deferred<never>();
      const lookup = deferred<never>();
      const combined = settleCronJobCreation(
        target,
        prompt.promise,
        lookup.promise
      );
      let settled = false;
      void combined.catch(() => {
        settled = true;
      });

      if (order === 'prompt-first') {
        prompt.reject(new Error('visible reply timed out'));
      } else {
        lookup.reject(new Error('job was not listed'));
      }
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);

      if (order === 'prompt-first') {
        lookup.reject(new Error('job was not listed'));
      } else {
        prompt.reject(new Error('visible reply timed out'));
      }
      await expect(combined).rejects.toMatchObject({
        message: 'cron creation prompt failed: visible reply timed out',
        cause: {
          message: 'cron job lookup failed: job was not listed',
        },
      });
      await expect(target.creationSettled).resolves.toBeUndefined();
    }
  );

  test('surfaces a lookup failure when the creation prompt succeeds', async () => {
    const target: CronCleanupTarget = {
      name: 'job',
      creationSettled: Promise.resolve(),
    };

    await expect(
      settleCronJobCreation(
        target,
        Promise.resolve('visible reply'),
        Promise.reject(new Error('job was not listed'))
      )
    ).rejects.toThrow('cron job lookup failed: job was not listed');
  });

  test('lists a present OpenClaw job before disabling, removing, and verifying its artifact', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'disabled-id', name: 'original-name' }] })
      )
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({ exists: false }));
    const target: CronCleanupTarget = {
      name: 'original-name',
      id: 'disabled-id',
      creationSettled: Promise.resolve(),
    };

    await cleanupCronJobAndArtifacts(context, 'openclaw', target, {
      timeoutMs: 35_000,
    });

    expect(docker.resolveComposeContainer).toHaveBeenCalledTimes(1);
    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv[0]).toEqual([
      'openclaw',
      'cron',
      'list',
      '--all',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(argv[1]).toEqual([
      'openclaw',
      'cron',
      'disable',
      'disabled-id',
      '--timeout',
      '10000',
    ]);
    expect(argv[2]).toEqual([
      'openclaw',
      'cron',
      'rm',
      'disabled-id',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(argv[3]).toEqual(openClawArtifactRemovalArgv('disabled-id'));
    expect(argv[4]).toEqual([
      'openclaw',
      'cron',
      'list',
      '--all',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(argv[5]).toEqual(openClawArtifactProbeArgv('disabled-id'));
  });

  test('OpenClaw cleanup after a successful deleteAfterRun run performs no gateway WRITE commands', async () => {
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({ exists: false }));

    await expect(
      cleanupCronJobAndArtifacts(context, 'openclaw', {
        name: 'job',
        id: 'delete-after-run-id',
        creationSettled: Promise.resolve(),
      })
    ).resolves.toBeUndefined();

    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv[0]).toEqual([
      'openclaw',
      'cron',
      'list',
      '--all',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(openClawGatewayWriteCommands(argv)).toEqual([]);
    expect(argv[1]).toEqual(openClawArtifactRemovalArgv('delete-after-run-id'));
    expect(argv[2]).toEqual([
      'openclaw',
      'cron',
      'list',
      '--all',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(argv[3]).toEqual(openClawArtifactProbeArgv('delete-after-run-id'));
  });

  test('surfaces an OpenClaw WRITE-scope pairing failure when the job remains present', async () => {
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'still-present', name: 'job' }] })
      )
      .mockResolvedValueOnce({
        stdout: '',
        stderr:
          'GatewayTransportError: gateway closed (1008): pairing required',
        exitCode: 1,
      });

    await expect(
      cleanupCronJobAndArtifacts(context, 'openclaw', {
        name: 'job',
        id: 'still-present',
        creationSettled: Promise.resolve(),
      })
    ).rejects.toThrow(
      /disable OpenClaw cron job still-present failed with exit 1/
    );

    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv).toHaveLength(2);
    expect(argv[0]).toEqual([
      'openclaw',
      'cron',
      'list',
      '--all',
      '--json',
      '--timeout',
      '10000',
    ]);
    expect(argv[1]).toEqual([
      'openclaw',
      'cron',
      'disable',
      'still-present',
      '--timeout',
      '10000',
    ]);
  });

  test('captures a late pre-ID job by name and removes it by the captured ID', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'late-id', name: 'late-job' }] })
      )
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'late-id', name: 'late-job' }] })
      )
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({ exists: false }));
    const target: CronCleanupTarget = {
      name: 'late-job',
      creationSettled: Promise.resolve(),
    };

    const cleanup = cleanupCronJobAndArtifacts(context, 'openclaw', target, {
      lateCaptureWaitMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(500);
    await expect(cleanup).resolves.toBeUndefined();

    expect(target.id).toBe('late-id');
    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv[3]).toContain('late-id');
    expect(argv[4]).toContain('late-id');
  });

  test('clips a late capture listing started near its deadline to the remaining phase time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    let invocation = 0;
    docker.execInContainer.mockImplementation(
      async (_ctx, _id, _argv, opts) => {
        invocation += 1;
        if (invocation === 1) {
          expect(opts.timeoutMs).toBe(1_000);
          return result({ jobs: [] });
        }
        if (invocation === 2) {
          expect(opts.timeoutMs).toBe(500);
          return result({ jobs: [{ id: 'late-id', name: 'late-job' }] });
        }
        if (invocation === 3) {
          return result({ jobs: [{ id: 'late-id', name: 'late-job' }] });
        }
        if (invocation === 7) {
          return result({ jobs: [] });
        }
        if (invocation === 8) {
          return result({ exists: false });
        }
        return result({});
      }
    );

    const cleanup = cleanupCronJobAndArtifacts(
      context,
      'openclaw',
      { name: 'late-job', creationSettled: Promise.resolve() },
      { lateCaptureWaitMs: 1_000 }
    );
    await vi.advanceTimersByTimeAsync(500);
    await expect(cleanup).resolves.toBeUndefined();
  });

  test('waits for a pending creation lifecycle and uses its ID for cleanup', async () => {
    const creation = deferred<void>();
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'created-id', name: 'late-job' }] })
      )
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({ exists: false }));
    const target: CronCleanupTarget = {
      name: 'late-job',
      creationSettled: creation.promise,
    };

    const cleanup = cleanupCronJobAndArtifacts(context, 'openclaw', target);
    await Promise.resolve();
    expect(docker.resolveComposeContainer).not.toHaveBeenCalled();
    target.id = 'created-id';
    creation.resolve();
    await expect(cleanup).resolves.toBeUndefined();
    expect(docker.execInContainer.mock.calls[1]?.[2]).toContain('created-id');
  });

  test('uses one cleanup deadline and never starts a command after expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    docker.resolveComposeContainer.mockImplementation(async () => {
      vi.setSystemTime(4);
      return 'container-id';
    });
    docker.execInContainer
      .mockImplementationOnce(async (_ctx, _id, _argv, opts) => {
        expect(opts.timeoutMs).toBe(6);
        vi.setSystemTime(9);
        return result({ jobs: [{ id: 'deadline-id', name: 'job' }] });
      })
      .mockImplementationOnce(async (_ctx, _id, _argv, opts) => {
        expect(opts.timeoutMs).toBe(1);
        vi.setSystemTime(10);
        return result({ ok: true });
      });

    await expect(
      cleanupCronJobAndArtifacts(
        context,
        'openclaw',
        {
          name: 'job',
          id: 'deadline-id',
          creationSettled: Promise.resolve(),
        },
        { timeoutMs: 10, commandTimeoutMs: 8 }
      )
    ).rejects.toThrow(/deadline expired/);
    expect(docker.resolveComposeContainer).toHaveBeenCalledTimes(1);
    expect(docker.execInContainer).toHaveBeenCalledTimes(2);
  });

  test('tolerates an auto-removed Hermes job and missing output artifact', async () => {
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(result(null))
      .mockResolvedValueOnce(result(false))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result({ exists: false }));

    await expect(
      cleanupCronJobAndArtifacts(context, 'hermes', {
        name: 'job',
        id: 'hermes-id',
        creationSettled: Promise.resolve(),
      })
    ).resolves.toBeUndefined();

    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv[0]?.[2]).toContain('pause_job');
    expect(argv[1]?.[2]).toContain('remove_job');
    expect(argv[2]).toEqual(hermesArtifactRemovalArgv('hermes-id'));
    expect(argv[4]).toEqual(hermesArtifactProbeArgv('hermes-id'));
  });

  test.each([
    ['openclaw', 'leftover-openclaw'] as const,
    ['hermes', 'leftover-hermes'] as const,
  ])(
    'rejects when the %s artifact remains after deletion',
    async (driverName, jobId) => {
      docker.resolveComposeContainer.mockResolvedValue('container-id');
      if (driverName === 'openclaw') {
        docker.execInContainer
          .mockResolvedValueOnce(result({ jobs: [{ id: jobId, name: 'job' }] }))
          .mockResolvedValueOnce(result({ ok: true }))
          .mockResolvedValueOnce(result({ ok: true }))
          .mockResolvedValueOnce(result({}))
          .mockResolvedValueOnce(result({ jobs: [] }))
          .mockResolvedValueOnce(result({ exists: true }));
      } else {
        docker.execInContainer
          .mockResolvedValueOnce(result(null))
          .mockResolvedValueOnce(result(false))
          .mockResolvedValueOnce(result({}))
          .mockResolvedValueOnce(result([]))
          .mockResolvedValueOnce(result({ exists: true }));
      }

      await expect(
        cleanupCronJobAndArtifacts(context, driverName, {
          name: 'job',
          id: jobId,
          creationSettled: Promise.resolve(),
        })
      ).rejects.toThrow(
        `Cron cleanup left artifact for ${driverName} job ${jobId}.`
      );
    }
  );

  test.each([
    ['openclaw', 'blocked-openclaw'] as const,
    ['hermes', 'blocked-hermes'] as const,
  ])(
    'does not tolerate a non-not-found artifact deletion failure for %s',
    async (driverName, jobId) => {
      docker.resolveComposeContainer.mockResolvedValue('container-id');
      if (driverName === 'openclaw') {
        docker.execInContainer
          .mockResolvedValueOnce(result({ jobs: [{ id: jobId, name: 'job' }] }))
          .mockResolvedValueOnce(result({ ok: true }))
          .mockResolvedValueOnce(result({ ok: true }));
      } else {
        docker.execInContainer
          .mockResolvedValueOnce(result(null))
          .mockResolvedValueOnce(result(false));
      }
      docker.execInContainer.mockResolvedValueOnce({
        stdout: '',
        stderr: 'permission denied',
        exitCode: 1,
      });

      await expect(
        cleanupCronJobAndArtifacts(context, driverName, {
          name: 'job',
          id: jobId,
          creationSettled: Promise.resolve(),
        })
      ).rejects.toThrow(
        `remove ${driverName} cron artifact ${jobId} failed with exit 1: permission denied`
      );
      expect(docker.execInContainer).toHaveBeenCalledTimes(
        driverName === 'openclaw' ? 4 : 3
      );
    }
  );

  test('rejects when a cleanup postcondition finds a remaining job', async () => {
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'still-here', name: 'job' }] })
      )
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({ ok: true }))
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(
        result({ jobs: [{ id: 'still-here', name: 'job' }] })
      );

    await expect(
      cleanupCronJobAndArtifacts(context, 'openclaw', {
        name: 'job',
        id: 'still-here',
        creationSettled: Promise.resolve(),
      })
    ).rejects.toThrow(/left job still-here/);
  });

  test('tolerates a missing OpenClaw job and run log artifact', async () => {
    docker.resolveComposeContainer.mockResolvedValue('container-id');
    docker.execInContainer
      .mockResolvedValueOnce(result({ jobs: [{ id: 'gone', name: 'job' }] }))
      .mockResolvedValueOnce({
        stdout: '',
        stderr: 'unknown cron job id: gone',
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        stdout: '',
        stderr: 'Error: invalid cron.remove params: id not found',
        exitCode: 1,
      })
      .mockResolvedValueOnce(result({}))
      .mockResolvedValueOnce(result({ jobs: [] }))
      .mockResolvedValueOnce(result({ exists: false }));

    await expect(
      cleanupCronJobAndArtifacts(context, 'openclaw', {
        name: 'job',
        id: 'gone',
        creationSettled: Promise.resolve(),
      })
    ).resolves.toBeUndefined();

    const argv = docker.execInContainer.mock.calls.map((call) => call[2]);
    expect(argv[3]).toEqual(openClawArtifactRemovalArgv('gone'));
    expect(argv[5]).toEqual(openClawArtifactProbeArgv('gone'));
  });

  test.each([
    [
      'a different cron.remove validation error',
      'Error: invalid cron.remove params: missing id',
    ],
    ['an unrelated gateway error', 'Error: gateway connection refused'],
  ])(
    'does not tolerate %s while removing an OpenClaw job',
    async (_kind, stderr) => {
      docker.resolveComposeContainer.mockResolvedValue('container-id');
      docker.execInContainer
        .mockResolvedValueOnce(result({ jobs: [{ id: 'gone', name: 'job' }] }))
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'unknown cron job id: gone',
          exitCode: 1,
        })
        .mockResolvedValueOnce({ stdout: '', stderr, exitCode: 1 });

      await expect(
        cleanupCronJobAndArtifacts(context, 'openclaw', {
          name: 'job',
          id: 'gone',
          creationSettled: Promise.resolve(),
        })
      ).rejects.toThrow(/remove OpenClaw cron job gone failed with exit 1/);
      expect(docker.execInContainer).toHaveBeenCalledTimes(3);
    }
  );
});

function result(value: unknown) {
  return { stdout: JSON.stringify(value), stderr: '', exitCode: 0 };
}

function openClawGatewayWriteCommands(argv: string[][]) {
  return argv.filter(
    (command) =>
      command[0] === 'openclaw' &&
      command[1] === 'cron' &&
      (command[2] === 'disable' || command[2] === 'rm')
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function openClawArtifactRemovalArgv(jobId: string) {
  return [
    'node',
    '-e',
    String.raw`
const fs = require('node:fs/promises');
fs.unlink('/root/.openclaw/cron/runs/' + process.argv[1] + '.jsonl').catch((error) => {
  if (error && error.code !== 'ENOENT') throw error;
});
`,
    jobId,
  ];
}

function openClawArtifactProbeArgv(jobId: string) {
  return [
    'node',
    '-e',
    String.raw`
const fs = require('node:fs/promises');
const path = '/root/.openclaw/cron/runs/' + process.argv[1] + '.jsonl';
fs.access(path).then(() => {
  console.log(JSON.stringify({ exists: true }));
}).catch((error) => {
  if (error && error.code === 'ENOENT') {
    console.log(JSON.stringify({ exists: false }));
  } else {
    throw error;
  }
});
`,
    jobId,
  ];
}

function hermesArtifactRemovalArgv(jobId: string) {
  return [
    'python3',
    '-c',
    String.raw`
import os
import shutil
import sys
from pathlib import Path

path = Path(os.environ['HERMES_HOME']) / 'cron' / 'output' / sys.argv[1]
try:
    shutil.rmtree(path)
except FileNotFoundError:
    pass
`,
    jobId,
  ];
}

function hermesArtifactProbeArgv(jobId: string) {
  return [
    'python3',
    '-c',
    String.raw`
import json
import os
import sys
from pathlib import Path

path = Path(os.environ['HERMES_HOME']) / 'cron' / 'output' / sys.argv[1]
print(json.dumps({"exists": path.exists()}))
`,
    jobId,
  ];
}
