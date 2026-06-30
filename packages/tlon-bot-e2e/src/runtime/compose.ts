import { spawn } from 'node:child_process';
import path from 'node:path';

import type {
  ComposeHandle,
  ComposeServiceState,
  ExecResult,
  RuntimeContext,
} from '../drivers/types.js';
import { buildComposeProcessEnv } from './env.js';

interface RunOptions {
  allowFailure?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  stream?: boolean;
  timeoutMs?: number;
}

export function createComposeHandle(ctx: RuntimeContext): ComposeHandle {
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
    const result = await runCommand(
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
        allowFailure: true,
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
      await runCompose(['down', ...(opts.volumes === false ? [] : ['-v'])], {
        allowFailure: true,
      });
    },
  };
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
    child.on('close', (exitCode) => {
      finish({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
}
