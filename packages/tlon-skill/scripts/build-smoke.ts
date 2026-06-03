import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  CLI_MATRIX_CASES,
  COMMAND_FAMILIES,
  type CliCase,
  normalizeCliOutput,
} from './cli-test-matrix';

const rootDir = resolve(process.cwd());
const binaryPath = join(rootDir, 'dist', 'tlon-run');
const SMOKE_TIMEOUT_MS = 15_000;
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8')
) as { version: string };

type RunOptions = {
  argsPrefix?: string[];
  env?: Record<string, string>;
  prepare?: (tempRoot: string) => {
    argsPrefix?: string[];
    env?: Record<string, string>;
  } | void;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function hermeticEnv(
  tempRoot: string,
  extraEnv: Record<string, string> = {}
): Record<string, string> {
  const home = join(tempRoot, 'home');
  const cacheDir = join(tempRoot, 'cache');
  mkdirSync(home);
  mkdirSync(cacheDir);

  const env: Record<string, string> = {};
  for (const key of ['PATH', 'SystemRoot', 'WINDIR']) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  env.HOME = home;
  env.TLON_CACHE_DIR = cacheDir;
  env.OPENCLAW_CONFIG = join(home, 'missing-openclaw.json');
  return { ...env, ...extraEnv };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function runBuiltCli(args: string[], options: RunOptions = {}): CliResult {
  const tempRoot = mkdtempSync(join(tmpdir(), 'tlon-build-smoke-'));
  try {
    const prepared = options.prepare?.(tempRoot) ?? {};
    const argsPrefix = prepared.argsPrefix ?? options.argsPrefix ?? [];
    const env = {
      ...(options.env ?? {}),
      ...(prepared.env ?? {}),
    };
    const result = spawnSync(binaryPath, [...argsPrefix, ...args], {
      cwd: rootDir,
      env: hermeticEnv(tempRoot, env),
      encoding: 'utf-8',
      timeout: SMOKE_TIMEOUT_MS,
    });

    if (result.error) {
      fail(`failed to run binary: ${result.error.message}`);
    }

    return {
      exitCode: result.status ?? 1,
      stdout: normalizeCliOutput(result.stdout),
      stderr: normalizeCliOutput(result.stderr),
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertCliCase(testCase: CliCase, result: CliResult): void {
  if (result.exitCode !== testCase.expectedExitCode) {
    fail(
      `${testCase.name}: expected exit ${testCase.expectedExitCode}, got ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  if (testCase.stdout !== undefined && result.stdout !== testCase.stdout) {
    fail(
      `${testCase.name}: unexpected stdout\nexpected:\n${testCase.stdout}\nactual:\n${result.stdout}`
    );
  }
  for (const expected of testCase.stdoutIncludes ?? []) {
    if (!result.stdout.includes(expected)) {
      fail(
        `${testCase.name}: stdout did not include ${JSON.stringify(expected)}\nstdout:\n${result.stdout}`
      );
    }
  }
  for (const unexpected of testCase.stdoutExcludes ?? []) {
    if (result.stdout.includes(unexpected)) {
      fail(
        `${testCase.name}: stdout included ${JSON.stringify(unexpected)}\nstdout:\n${result.stdout}`
      );
    }
  }

  if (testCase.stderr !== undefined && result.stderr !== testCase.stderr) {
    fail(
      `${testCase.name}: unexpected stderr\nexpected:\n${testCase.stderr}\nactual:\n${result.stderr}`
    );
  }
  for (const expected of testCase.stderrIncludes ?? []) {
    if (!result.stderr.includes(expected)) {
      fail(
        `${testCase.name}: stderr did not include ${JSON.stringify(expected)}\nstderr:\n${result.stderr}`
      );
    }
  }
  for (const unexpected of testCase.stderrExcludes ?? []) {
    if (result.stderr.includes(unexpected)) {
      fail(
        `${testCase.name}: stderr included ${JSON.stringify(unexpected)}\nstderr:\n${result.stderr}`
      );
    }
  }
}

function assertCase(testCase: CliCase, options: RunOptions = {}): void {
  const result = runBuiltCli(testCase.args, options);
  assertCliCase(testCase, result);
  console.log(`ok - ${testCase.name}`);
}

assertCase({
  name: 'tlon-run --version',
  args: ['--version'],
  expectedExitCode: 0,
  stdout: `${packageJson.version}\n`,
  stderr: '',
});

for (const testCase of CLI_MATRIX_CASES) {
  assertCase(testCase);
}

const hostileHelpCommands = [
  { name: 'top-level', args: ['--help'] },
  ...COMMAND_FAMILIES.map((family) => ({
    name: family,
    args: [family, '--help'],
  })),
];

for (const command of hostileHelpCommands) {
  assertCase(
    {
      name: `${command.name} help with nonexistent TLON_CONFIG_FILE`,
      args: command.args,
      expectedExitCode: 0,
      stderr: '',
      stdoutIncludes: ['Usage:'],
    },
    {
      prepare: (tempRoot) => ({
        env: {
          TLON_CONFIG_FILE: join(tempRoot, `${command.name}-ship.json`),
        },
      }),
    }
  );

  assertCase(
    {
      name: `${command.name} help with CLI --config /nonexistent`,
      args: command.args,
      expectedExitCode: 0,
      stderr: '',
      stdoutIncludes: ['Usage:'],
    },
    {
      prepare: (tempRoot) => ({
        argsPrefix: ['--config', join(tempRoot, `${command.name}-ship.json`)],
      }),
    }
  );
}
