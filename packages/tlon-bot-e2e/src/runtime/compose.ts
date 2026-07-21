import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import type {
  ComposeHandle,
  ComposeServiceState,
  ExecResult,
  RuntimeContext,
} from '../drivers/types.js';
import { buildComposeProcessEnv } from './env.js';

const DEFAULT_DOWN_TIMEOUT_MS = 60_000;

interface RunOptions {
  allowFailure?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  stream?: boolean;
  timeoutMs?: number;
}

export function createComposeHandle(
  ctx: RuntimeContext,
  commandRunner: typeof runCommand = runCommand
): ComposeHandle {
  const composeFiles = ctx.composeFiles.map((file) => path.resolve(file));
  for (const file of composeFiles) {
    if (!path.isAbsolute(file)) {
      throw new Error(`compose file is not absolute: ${file}`);
    }
  }

  const env = buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: ctx.composeEnv,
  });

  const runCompose = async (
    args: string[],
    opts: RunOptions = {}
  ): Promise<ExecResult> => {
    const result = await commandRunner(
      'docker',
      ['compose', ...fileArgs(composeFiles), ...args],
      {
        env: { ...env, ...(opts.env ?? {}) },
        cwd: opts.cwd ?? ctx.packageDir,
        stream: opts.stream,
        timeoutMs: opts.timeoutMs,
      }
    );
    if (result.exitCode !== 0 && !opts.allowFailure) {
      throw new Error(
        `docker compose ${args.join(' ')} failed with exit ${result.exitCode}\n` +
          result.stderr.trim()
      );
    }
    return result;
  };

  return {
    ctx,
    projectName: ctx.composeProjectName,
    composeFiles,
    env,

    async build(services = []) {
      await runCompose(['build', ...services]);
    },

    async up(services = []) {
      await runCompose(['up', '-d', ...services]);
    },

    async ps(opts = {}): Promise<ComposeServiceState[]> {
      const result = await runCompose(['ps', '--format', 'json'], {
        timeoutMs: opts.timeoutMs,
      });
      return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parsed = JSON.parse(line) as {
            Name?: string;
            Service?: string;
            State?: string;
            Status?: string;
          };
          return {
            name: parsed.Name ?? '',
            service: parsed.Service ?? '',
            state: parsed.State ?? '',
            status: parsed.Status ?? '',
          };
        });
    },

    async logs(services = [], opts = {}) {
      const tailArgs =
        typeof opts.tail === 'number' ? [`--tail=${opts.tail}`] : [];
      const result = await runCompose(['logs', ...tailArgs, ...services], {
        allowFailure: opts.allowFailure ?? true,
        stream: false,
        timeoutMs: opts.timeoutMs,
      });
      return [result.stdout, result.stderr].filter(Boolean).join('\n');
    },

    async exec(service, args, opts = {}) {
      return runCompose(
        ['exec', '-T', ...(opts.cwd ? ['-w', opts.cwd] : []), service, ...args],
        { allowFailure: true, env: opts.env, stream: false }
      );
    },

    async down(opts = {}) {
      const timeoutMs = opts.timeoutMs ?? DEFAULT_DOWN_TIMEOUT_MS;
      const failures: string[] = [];

      const downResult = await runCompose(
        ['down', ...(opts.volumes === false ? [] : ['-v'])],
        { allowFailure: true, timeoutMs }
      );
      if (downResult.exitCode !== 0 && !opts.allowFailure) {
        failures.push(
          `docker compose down failed with exit ${downResult.exitCode}\n` +
            downResult.stderr.trim()
        );
      }

      if (opts.verify) {
        const projectName = ctx.composeProjectName;
        const containerListing = await commandRunner(
          'docker',
          [
            'ps',
            '-a',
            '--filter',
            `label=com.docker.compose.project=${projectName}`,
            '--format',
            '{{.ID}}\\t{{.Names}}',
          ],
          { env, cwd: ctx.packageDir, stream: false, timeoutMs }
        );
        const volumeListing = await commandRunner(
          'docker',
          [
            'volume',
            'ls',
            '--filter',
            `label=com.docker.compose.project=${projectName}`,
            '--format',
            '{{.Name}}',
          ],
          { env, cwd: ctx.packageDir, stream: false, timeoutMs }
        );

        if (containerListing.exitCode !== 0) {
          failures.push(
            `docker ps -a (verify) failed with exit ` +
              `${containerListing.exitCode}\n` +
              containerListing.stderr.trim()
          );
        }
        if (volumeListing.exitCode !== 0) {
          failures.push(
            `docker volume ls (verify) failed with exit ` +
              `${volumeListing.exitCode}\n` +
              volumeListing.stderr.trim()
          );
        }

        const leakedContainers = nonBlankLines(containerListing.stdout);
        const leakedVolumes = nonBlankLines(volumeListing.stdout);
        const leakGroups: string[] = [];
        if (leakedContainers.length > 0) {
          leakGroups.push(`leaked containers:\n${leakedContainers.join('\n')}`);
        }
        if (leakedVolumes.length > 0) {
          leakGroups.push(`leaked volumes:\n${leakedVolumes.join('\n')}`);
        }
        if (leakGroups.length > 0) {
          failures.push(leakGroups.join('\n'));
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `compose teardown failed for project ${ctx.composeProjectName}:\n` +
            failures.join('\n')
        );
      }
    },
  };
}

function nonBlankLines(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function fileArgs(files: string[]): string[] {
  return files.flatMap((file) => ['-f', file]);
}

export function runCommand(
  command: string,
  args: string[],
  opts: {
    env: Record<string, string>;
    cwd: string;
    stream?: boolean;
    timeoutMs?: number;
  }
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let killTimeout: NodeJS.Timeout | undefined;

    const clearTimers = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (killTimeout) {
        clearTimeout(killTimeout);
      }
    };
    const finish = (result: ExecResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      reject(error);
    };

    if (opts.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        stderr +=
          `\n${command} ${args.join(' ')} timed out after ` +
          `${opts.timeoutMs}ms.`;
        child.kill('SIGTERM');
        killTimeout = setTimeout(() => {
          child.kill('SIGKILL');
        }, 1_000);
      }, opts.timeoutMs);
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (opts.stream !== false) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (opts.stream !== false) {
        process.stderr.write(chunk);
      }
    });
    child.on('error', fail);
    child.on('close', (exitCode, signal) => {
      finish({ stdout, stderr, exitCode: exitCode ?? signalExitCode(signal) });
    });
  });
}

/**
 * A signal-killed child reports exitCode null plus the signal. Translate to
 * the shell convention (128 + signal number) so callers such as the OpenClaw
 * per-file runner can detect kills via `exitCode >= 128` and stop the suite.
 */
function signalExitCode(signal: NodeJS.Signals | null): number {
  const signum = signal ? os.constants.signals[signal] : undefined;
  return signum ? 128 + signum : 1;
}
