import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  CLI_MATRIX_CASES,
  type CliCase,
  HOSTILE_HELP_COMMANDS,
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

for (const command of HOSTILE_HELP_COMMANDS) {
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

/* ------------------------------------------------------------------ */
/* Discoverability, in the ARTIFACT                                    */
/* ------------------------------------------------------------------ */

/**
 * `surface show` is discoverable from the compiled binary, without
 * credentials.
 *
 * A subcommand that exists in the dispatcher and is named nowhere a reader
 * looks is the defect this command was written to close, one level up: the
 * skill told a reviser to read its `recipe` back for four sessions while no
 * command returned one. A unit test over `SURFACE_SUBCOMMANDS` proves the
 * switch has an arm; it does not prove anybody can find it. These two cases
 * are the finding path — the group's usage, and the command's own help —
 * asserted against the artifact that actually ships.
 */
assertCase({
  name: 'surface usage lists show',
  args: ['surface'],
  expectedExitCode: 0,
  stderr: '',
  stdoutIncludes: [
    'show        Read back a channel',
    'Revising an app starts with "show"',
  ],
});

assertCase({
  name: 'surface show --help explains itself without a ship',
  args: ['surface', 'show', '--help'],
  expectedExitCode: 0,
  stderr: '',
  stdoutIncludes: [
    'Usage: tlon surface show <channel>',
    '--bundle-out <path>',
    'sha256 the definition pins',
  ],
});

/**
 * The two halves of a fork have to be findable from the help, because a bot
 * that stages a copy and cannot see what to run next has a bundle on disk and
 * no way to land it. Both forms are asserted, and so is the sentence that says
 * provenance is a claim — the one line of this command that must survive every
 * later edit to its help.
 */
assertCase({
  name: 'surface fork --help names both halves and the claim',
  args: ['surface', 'fork', '--help'],
  expectedExitCode: 0,
  stderr: '',
  stdoutIncludes: [
    'Usage: tlon surface fork <source-channel>',
    '--stage-bundle <path>',
    '--surface-id <id>',
    'Provenance is a CLAIM, not an attestation',
    'The recipe is NOT copied',
  ],
});

/* ------------------------------------------------------------------ */
/* The skill's documents, served by the COMPILED binary                */
/* ------------------------------------------------------------------ */

/**
 * These belong here rather than in the unit tests because source mode masks
 * the whole defect: from source, `__dirname` is real and every path resolves,
 * so a green unit test says nothing about the artifact that ships. The three
 * cases below are the ones that can only be answered by the binary —
 *
 *   1. it serves the document byte-for-byte from the directory it was
 *      pointed at (so nothing is truncated, reformatted, or summarized);
 *   2. the three commands are not interchangeable (each prints ITS file);
 *   3. pointed at a directory without the document, it refuses loudly —
 *      which is also the mutation proving case 1 read from that directory
 *      rather than from something baked into the binary at build time.
 */
const SKILL_DOCUMENTS = [
  {
    command: 'doctrine',
    file: 'PARADIGM.md',
    heading: '# The surface paradigm',
  },
  {
    command: 'primitives',
    file: 'PRIMITIVES.md',
    heading: '# The primitive kit',
  },
  { command: 'rubric', file: 'RUBRIC.md', heading: '# The preview rubric' },
] as const;

const skillDir = join(rootDir, 'skills', 'surfaces');

for (const document of SKILL_DOCUMENTS) {
  const source = readFileSync(join(skillDir, document.file), 'utf-8');
  assertCase(
    {
      name: `surface ${document.command} serves ${document.file} verbatim`,
      args: ['surface', document.command],
      expectedExitCode: 0,
      stdout: `${source.replace(/\n+$/, '')}\n`,
      stderr: '',
      stdoutExcludes: SKILL_DOCUMENTS.filter(
        (other) => other.command !== document.command
      ).map((other) => other.heading),
    },
    { env: { TLON_SURFACE_SKILL_DIR: skillDir } }
  );

  assertCase(
    {
      name: `surface ${document.command} refuses when the skill is not installed`,
      args: ['surface', document.command, '--json'],
      expectedExitCode: 1,
      stdoutIncludes: [
        '"ok":false',
        '"code":"doctrine-unavailable"',
        document.file,
      ],
      stderr: '',
    },
    {
      prepare: (tempRoot) => {
        const emptySkill = join(tempRoot, 'no-skill');
        mkdirSync(emptySkill);
        return { env: { TLON_SURFACE_SKILL_DIR: emptySkill } };
      },
    }
  );
}

// The deployment convention: Hermes and OpenClaw installs already export
// TLON_SKILL_DIR at the package root, so the documents resolve even where
// the wrapper is bypassed. The sentinel text proves the resolution followed
// that variable rather than finding the real documents some other way.
assertCase(
  {
    name: 'surface doctrine resolves through TLON_SKILL_DIR',
    args: ['surface', 'doctrine'],
    expectedExitCode: 0,
    stdout: '# Sentinel paradigm\n',
    stderr: '',
  },
  {
    prepare: (tempRoot) => {
      const staged = join(tempRoot, 'package', 'skills', 'surfaces');
      mkdirSync(staged, { recursive: true });
      writeFileSync(
        join(staged, 'PARADIGM.md'),
        '# Sentinel paradigm\n',
        'utf-8'
      );
      return { env: { TLON_SKILL_DIR: join(tempRoot, 'package') } };
    },
  }
);
