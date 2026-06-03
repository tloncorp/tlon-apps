import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  CLI_MATRIX_CASES,
  COMMAND_FAMILIES,
  type CliCase,
  normalizeCliOutput,
} from '../../scripts/cli-test-matrix';

const rootDir = resolve(process.cwd());
const cleanupPaths: string[] = [];
const CLI_TIMEOUT_MS = 15_000;

type RunContext = {
  tempRoot: string;
  home: string;
  cacheDir: string;
};

type RunOptions = {
  env?: Record<string, string>;
  prepare?: (context: RunContext) => {
    argsPrefix?: string[];
    cacheDir?: string;
    env?: Record<string, string>;
    cleanup?: () => void;
  } | void;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanupPaths.push(dir);
  return dir;
}

function hermeticEnv(
  home: string,
  cacheDir: string,
  openclawConfig: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR']) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  env.HOME = home;
  env.TLON_CACHE_DIR = cacheDir;
  env.OPENCLAW_CONFIG = openclawConfig;
  return env;
}

async function runBunScript(
  entrypoint: string,
  args: string[],
  options: RunOptions = {}
): Promise<CliResult> {
  const tempRoot = makeTempDir('tlon-hermetic-');
  const home = join(tempRoot, 'home');
  const cacheDir = join(tempRoot, 'cache');
  mkdirSync(home);
  mkdirSync(cacheDir);

  const context: RunContext = { tempRoot, home, cacheDir };
  const prepared = options.prepare?.(context) ?? {};
  const openclawConfig = join(home, 'missing-openclaw.json');
  const env = {
    ...hermeticEnv(home, prepared.cacheDir ?? cacheDir, openclawConfig),
    ...prepared.env,
    ...options.env,
  };

  try {
    const proc = Bun.spawn(
      [process.execPath, entrypoint, ...(prepared.argsPrefix ?? []), ...args],
      {
        cwd: rootDir,
        env,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const output = Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const timeoutFailure = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        output.catch(() => {});
        reject(
          new Error(
            `CLI timed out after ${CLI_TIMEOUT_MS}ms: ${entrypoint} ${args.join(' ')}`
          )
        );
      }, CLI_TIMEOUT_MS);
    });

    let stdout: string;
    let stderr: string;
    let exitCode: number;
    try {
      [stdout, stderr, exitCode] = await Promise.race([output, timeoutFailure]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    return {
      exitCode,
      stdout: normalizeCliOutput(stdout),
      stderr: normalizeCliOutput(stderr),
    };
  } finally {
    prepared.cleanup?.();
  }
}

async function runCli(
  args: string[],
  options: RunOptions = {}
): Promise<CliResult> {
  return runBunScript('scripts/main.ts', args, options);
}

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const dir = cleanupPaths.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function expectCliCase(result: CliResult, testCase: CliCase) {
  expect(result.exitCode).toBe(testCase.expectedExitCode);

  if (testCase.stdout !== undefined) {
    expect(result.stdout).toBe(testCase.stdout);
  }
  for (const expected of testCase.stdoutIncludes ?? []) {
    expect(result.stdout).toContain(expected);
  }
  for (const unexpected of testCase.stdoutExcludes ?? []) {
    expect(result.stdout).not.toContain(unexpected);
  }

  if (testCase.stderr !== undefined) {
    expect(result.stderr).toBe(testCase.stderr);
  }
  for (const expected of testCase.stderrIncludes ?? []) {
    expect(result.stderr).toContain(expected);
  }
  for (const unexpected of testCase.stderrExcludes ?? []) {
    expect(result.stderr).not.toContain(unexpected);
  }
}

const hostileHelpCommands = [
  { name: 'top-level', args: ['--help'] },
  ...COMMAND_FAMILIES.map((family) => ({
    name: family,
    args: [family, '--help'],
  })),
];

describe('CLI hermetic subprocess behavior', () => {
  it('prints source CLI version without host credentials', async () => {
    const result = await runCli(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('dev\n');
    expect(result.stderr).toBe('');
  });

  for (const testCase of CLI_MATRIX_CASES) {
    it(testCase.name, async () => {
      const result = await runCli(testCase.args);
      expectCliCase(result, testCase);
    });
  }

  for (const command of hostileHelpCommands) {
    it(`prints ${command.name} help with nonexistent TLON_CONFIG_FILE`, async () => {
      const result = await runCli(command.args, {
        prepare: ({ home }) => ({
          env: { TLON_CONFIG_FILE: join(home, 'missing-ship.json') },
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stderr).toBe('');
    });

    it(`prints ${command.name} help with CLI --config /nonexistent`, async () => {
      const result = await runCli(command.args, {
        prepare: ({ home }) => ({
          argsPrefix: ['--config', join(home, 'missing-ship.json')],
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stderr).toBe('');
    });
  }

  describe('global credential flag validation', () => {
    it('fails malformed global credential flags before activity dispatch', async () => {
      const result = await runCli([
        '--url',
        'https://cli.tlon.network',
        'activity',
        '--help',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Invalid credential flags');
      expect(result.stderr).not.toContain('Usage: tlon activity');
      expect(result.stderr).not.toContain('Missing Urbit config');
    });

    for (const command of ['activity', 'upload'] as const) {
      it(`strips valid global credential flags before ${command} help dispatch`, async () => {
        const result = await runCli(
          [
            '--url',
            'https://cli.tlon.network',
            '--cookie',
            'urbauth-~zod=0v-cookie',
            command,
            '--help',
          ],
          {
            prepare: ({ home }) => ({
              env: { TLON_CONFIG_FILE: join(home, 'missing-ship.json') },
            }),
          }
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(`Usage: tlon ${command}`);
        expect(result.stderr).toBe('');
      });
    }

    it('fails partial CLI credential flags before merging ambient env', async () => {
      const result = await runCli(
        ['--url', 'https://cli.tlon.network', 'contacts', 'self'],
        {
          env: {
            URBIT_COOKIE: 'urbauth-~zod=0v-cookie',
            URBIT_SHIP: '~zod',
            URBIT_CODE: 'code',
          },
        }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Invalid credential flags');
      expect(result.stderr).not.toContain('Missing Urbit config');
    });

    it('fails conflicting credential forms before command import/auth lookup', async () => {
      const result = await runCli([
        '--config',
        'ship.json',
        '--url',
        'https://zod.tlon.network',
        '--cookie',
        'urbauth-~zod=0v-cookie',
        'contacts',
        'self',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('--config cannot be combined');
    });

    it('fails duplicate credential flags', async () => {
      const result = await runCli([
        '--ship',
        '~zod',
        '--ship',
        '~bus',
        'contacts',
        'self',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Duplicate credential flag: --ship');
    });

    it('fails empty credential flag values', async () => {
      const result = await runCli(['--cookie=', 'contacts', 'self']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Missing value for --cookie');
    });

    it('fails missing values when the next token is absent or the command', async () => {
      const absent = await runCli(['--url']);
      const command = await runCli(['--url', 'contacts', 'self']);

      expect(absent.exitCode).toBe(1);
      expect(absent.stderr).toContain('Missing value for --url');
      expect(command.exitCode).toBe(1);
      expect(command.stderr).toContain('Missing value for --url');
    });

    it('accepts valid CLI credentials while ignoring ambient TLON_CONFIG_FILE during parsing', async () => {
      const result = await runCli(
        [
          '--url',
          'https://cli.tlon.network',
          '--cookie',
          'urbauth-~zod=0v-cookie',
          'definitely-not-a-command',
        ],
        {
          prepare: ({ home }) => ({
            env: { TLON_CONFIG_FILE: join(home, 'missing-ship.json') },
          }),
        }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Unknown command: definitely-not-a-command'
      );
      expect(result.stderr).not.toContain('Ship config not found');
    });
  });
});
