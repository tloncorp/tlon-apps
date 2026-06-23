import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { normalizeCliOutput } from './cli-test-matrix';

export const TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
] as const;

export type Target = (typeof TARGETS)[number];

export const PLATFORM_PACKAGES: Record<Target, string> = {
  'darwin-arm64': '@tloncorp/tlon-skill-darwin-arm64',
  'darwin-x64': '@tloncorp/tlon-skill-darwin-x64',
  'linux-x64': '@tloncorp/tlon-skill-linux-x64',
  'linux-arm64': '@tloncorp/tlon-skill-linux-arm64',
};

export const CLI_TIMEOUT_MS = 15_000;
export const NPM_TIMEOUT_MS = 120_000;

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function isTarget(value: string): value is Target {
  return TARGETS.includes(value as Target);
}

export function currentTarget(): Target {
  const target = `${process.platform}-${process.arch}`;
  if (!isTarget(target)) {
    fail(`Unsupported runtime target: ${target}`);
  }
  return target;
}

export function npmPackFilename(packageName: string, version: string): string {
  return `${packageName.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
}

export function nodeModulesPackagePath(
  projectDir: string,
  packageName: string
): string {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.split('/');
    if (!scope || !name) {
      fail(`Invalid scoped package name: ${packageName}`);
    }
    return join(projectDir, 'node_modules', scope, name);
  }
  return join(projectDir, 'node_modules', packageName);
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function assertExecutableFile(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }
  const stat = statSync(path);
  if (!stat.isFile()) {
    fail(`${label} is not a file: ${path}`);
  }
  if ((stat.mode & 0o111) === 0) {
    fail(`${label} is not executable: ${path}`);
  }
}

export function baseEnv(
  _tempRoot: string,
  extraEnv: Record<string, string> = {}
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of [
    'PATH',
    'HOME',
    'SystemRoot',
    'WINDIR',
    'ASDF_DIR',
    'ASDF_DATA_DIR',
  ]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  return { ...env, ...extraEnv };
}

export function hermeticCliEnv(
  tempRoot: string,
  extraEnv: Record<string, string> = {}
): Record<string, string> {
  const home = join(tempRoot, 'home');
  const cacheDir = join(tempRoot, 'cache');
  mkdirSync(home, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  return {
    ...baseEnv(tempRoot),
    HOME: home,
    TLON_CACHE_DIR: cacheDir,
    OPENCLAW_CONFIG: join(home, 'missing-openclaw.json'),
    ...extraEnv,
  };
}

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    allowFailure?: boolean;
  }
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? NPM_TIMEOUT_MS,
  });

  if (result.error) {
    fail(`Failed to run ${command} ${args.join(' ')}: ${result.error.message}`);
  }

  const commandResult = {
    exitCode: result.status ?? 1,
    stdout: normalizeCliOutput(result.stdout),
    stderr: normalizeCliOutput(result.stderr),
  };

  if (!options.allowFailure && commandResult.exitCode !== 0) {
    fail(
      `${command} ${args.join(' ')} exited ${commandResult.exitCode}\nstdout:\n${commandResult.stdout}\nstderr:\n${commandResult.stderr}`
    );
  }

  return commandResult;
}

export function runCli(
  binaryPath: string,
  args: string[],
  options: {
    cwd: string;
    tempRoot: string;
  }
): CommandResult {
  return runCommand(binaryPath, args, {
    cwd: options.cwd,
    env: hermeticCliEnv(options.tempRoot),
    timeoutMs: CLI_TIMEOUT_MS,
    allowFailure: true,
  });
}

export function assertCliSuccess(
  name: string,
  result: CommandResult,
  assertions: {
    stdout?: string;
    stderr?: string;
    stdoutIncludes?: string[];
  } = {}
): void {
  if (result.exitCode !== 0) {
    fail(
      `${name}: expected exit 0, got ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  if (assertions.stdout !== undefined && result.stdout !== assertions.stdout) {
    fail(
      `${name}: unexpected stdout\nexpected:\n${assertions.stdout}\nactual:\n${result.stdout}`
    );
  }
  if (assertions.stderr !== undefined && result.stderr !== assertions.stderr) {
    fail(
      `${name}: unexpected stderr\nexpected:\n${assertions.stderr}\nactual:\n${result.stderr}`
    );
  }
  for (const expected of assertions.stdoutIncludes ?? []) {
    if (!result.stdout.includes(expected)) {
      fail(
        `${name}: stdout did not include ${JSON.stringify(expected)}\nstdout:\n${result.stdout}`
      );
    }
  }
}

export function smokeCliBinary(
  binaryPath: string,
  expectedVersion: string,
  cwd: string
): void {
  assertExecutableFile(binaryPath, 'CLI binary');

  const tempRoot = mkdtempSync(join(tmpdir(), 'tlon-release-cli-'));
  try {
    assertCliSuccess(
      `${basename(binaryPath)} --version`,
      runCli(binaryPath, ['--version'], { cwd, tempRoot }),
      {
        stdout: `${expectedVersion}\n`,
        stderr: '',
      }
    );
    assertCliSuccess(
      `${basename(binaryPath)} --help`,
      runCli(binaryPath, ['--help'], { cwd, tempRoot }),
      {
        stderr: '',
        stdoutIncludes: ['Usage:'],
      }
    );
    assertCliSuccess(
      `${basename(binaryPath)} activity --help`,
      runCli(binaryPath, ['activity', '--help'], { cwd, tempRoot }),
      {
        stderr: '',
        stdoutIncludes: ['Usage: tlon activity'],
      }
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function listTarballFiles(tarballPath: string, cwd: string): string[] {
  const result = runCommand('tar', ['-tzf', tarballPath], {
    cwd,
    timeoutMs: 30_000,
  });
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ''))
    .filter(Boolean)
    .sort();
}

export function assertRootTarball(tarballPath: string, cwd: string): void {
  const files = listTarballFiles(tarballPath, cwd);
  if (!files.includes('bin/tlon.js')) {
    fail(`Root tarball is missing bin/tlon.js: ${tarballPath}`);
  }
  if (files.includes('bin/tlon')) {
    fail(`Root tarball must not contain bin/tlon: ${tarballPath}`);
  }

  const unexpected = files.filter((file) => {
    if (
      file === 'package.json' ||
      file === 'README.md' ||
      file === 'LICENSE' ||
      file === 'SKILL.md' ||
      file === 'bin/tlon.js' ||
      file === 'scripts/postinstall.js'
    ) {
      return false;
    }
    return !file.startsWith('references/');
  });

  if (unexpected.length > 0) {
    fail(
      `Root tarball contains unexpected files:\n${unexpected
        .map((file) => `  - ${file}`)
        .join('\n')}`
    );
  }
}

export function assertPlatformTarball(
  tarballPath: string,
  cwd: string,
  target: Target
): void {
  const files = listTarballFiles(tarballPath, cwd);
  for (const required of ['package.json', 'tlon']) {
    if (!files.includes(required)) {
      fail(`${target} tarball is missing ${required}: ${tarballPath}`);
    }
  }

  const unexpected = files.filter(
    (file) =>
      file !== 'package.json' &&
      file !== 'tlon' &&
      file !== 'README.md' &&
      file !== 'LICENSE'
  );
  if (unexpected.length > 0) {
    fail(
      `${target} tarball contains unexpected files:\n${unexpected
        .map((file) => `  - ${file}`)
        .join('\n')}`
    );
  }
}
