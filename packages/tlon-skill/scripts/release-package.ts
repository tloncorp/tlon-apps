import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  PLATFORM_PACKAGES,
  TARGETS,
  type Target,
  assertExecutableFile,
  assertPlatformTarball,
  assertRootTarball,
  baseEnv,
  currentTarget,
  fail,
  isTarget,
  npmPackFilename,
  runCommand,
  sha256File,
} from './release-utils';

type RootPackageJson = {
  name: string;
  version: string;
  files?: string[];
};

type PackOutput = Array<{
  filename: string;
}>;

type BinaryHashes = Partial<
  Record<
    Target,
    {
      packageName: string;
      sha256: string;
      stagedPath: string;
    }
  >
>;

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1];
  }

  return undefined;
}

function parseTargets(): Target[] {
  const value = argValue('--targets') ?? argValue('--target');
  if (!value) {
    return [...TARGETS];
  }
  if (value === 'current') {
    return [currentTarget()];
  }

  const targets = value.split(',').map((target) => target.trim());
  if (targets.length === 0) {
    fail('--targets must include at least one target');
  }
  return targets.map((target) => {
    if (!isTarget(target)) {
      fail(
        `Unknown target ${target}. Supported targets: ${TARGETS.join(', ')}`
      );
    }
    return target;
  });
}

function requirePath(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }
}

function ensureEmptyOutputDir(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const entries = readdirSync(outDir);
  if (entries.length > 0) {
    fail(`Output directory must be empty: ${outDir}`);
  }
}

function copyRequired(
  source: string,
  destination: string,
  label: string
): void {
  requirePath(source, label);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function copyOptional(source: string, destination: string): void {
  if (!existsSync(source)) {
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function assertRootFilesField(packageJson: RootPackageJson): void {
  const files = packageJson.files ?? [];
  const required = [
    'bin/tlon.js',
    'scripts/postinstall.js',
    'SKILL.md',
    'references/',
  ];

  for (const entry of required) {
    if (!files.includes(entry)) {
      fail(`Root package.json files is missing ${entry}`);
    }
  }
  for (const forbidden of ['bin', 'bin/']) {
    if (files.includes(forbidden)) {
      fail(`Root package.json files must not include ${forbidden}`);
    }
  }
}

function parsePackOutput(stdout: string): PackOutput {
  const jsonStart = stdout.indexOf('[');
  if (jsonStart === -1) {
    fail(`npm pack did not return JSON:\n${stdout}`);
  }

  try {
    const parsed = JSON.parse(stdout.slice(jsonStart)) as PackOutput;
    if (parsed.length !== 1 || !parsed[0]?.filename) {
      fail(`Unexpected npm pack JSON:\n${stdout}`);
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Failed to parse npm pack JSON: ${message}\n${stdout}`);
  }
}

function packDirectory(
  packageDir: string,
  outDir: string,
  cacheDir: string,
  userConfig: string,
  env: Record<string, string>
): string {
  const result = runCommand(
    'npm',
    [
      '--cache',
      cacheDir,
      '--userconfig',
      userConfig,
      'pack',
      '--json',
      '--pack-destination',
      outDir,
    ],
    {
      cwd: packageDir,
      env,
    }
  );

  const [packed] = parsePackOutput(result.stdout);
  const tarballPath = resolve(outDir, packed.filename);
  requirePath(tarballPath, 'packed tarball');
  return tarballPath;
}

function stageRootPackage(rootDir: string, stageDir: string): RootPackageJson {
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8')
  ) as RootPackageJson;
  assertRootFilesField(packageJson);

  copyRequired(
    packageJsonPath,
    join(stageDir, 'package.json'),
    'root package.json'
  );
  copyRequired(
    join(rootDir, 'bin', 'tlon.js'),
    join(stageDir, 'bin', 'tlon.js'),
    'bin/tlon.js'
  );
  copyRequired(
    join(rootDir, 'scripts', 'postinstall.js'),
    join(stageDir, 'scripts', 'postinstall.js'),
    'scripts/postinstall.js'
  );
  copyRequired(
    join(rootDir, 'SKILL.md'),
    join(stageDir, 'SKILL.md'),
    'SKILL.md'
  );
  copyRequired(
    join(rootDir, 'references'),
    join(stageDir, 'references'),
    'references'
  );
  copyOptional(join(rootDir, 'README.md'), join(stageDir, 'README.md'));
  copyOptional(join(rootDir, 'LICENSE'), join(stageDir, 'LICENSE'));

  return packageJson;
}

function stagePlatformPackage(
  rootDir: string,
  stageDir: string,
  artifactsDir: string,
  target: Target
): { stagedBinaryPath: string; packageStageDir: string; sha256: string } {
  const artifactPath = join(artifactsDir, `binary-${target}`, 'tlon');
  requirePath(artifactPath, `${target} build artifact`);

  const sourcePackageDir = join(rootDir, 'npm', target);
  const sourcePackageJson = join(sourcePackageDir, 'package.json');
  const packageStageDir = join(stageDir, 'npm', target);
  const stagedBinaryPath = join(packageStageDir, 'tlon');
  copyRequired(
    sourcePackageJson,
    join(packageStageDir, 'package.json'),
    `${target} package.json`
  );
  copyRequired(artifactPath, stagedBinaryPath, `${target} build artifact`);
  chmodSync(stagedBinaryPath, 0o755);
  assertExecutableFile(stagedBinaryPath, `${target} package-stage binary`);

  return {
    stagedBinaryPath,
    packageStageDir,
    sha256: sha256File(stagedBinaryPath),
  };
}

const rootDir = process.cwd();
const artifactsDir = resolve(
  rootDir,
  argValue('--artifacts-dir') ?? 'artifacts'
);
const outDir = resolve(rootDir, argValue('--out-dir') ?? 'release-tarballs');
const targets = parseTargets();

ensureEmptyOutputDir(outDir);

const tempRoot = mkdtempSync(join(tmpdir(), 'tlon-release-package-'));
try {
  const cacheDir = join(tempRoot, 'npm-cache');
  const userConfig = join(tempRoot, 'npmrc');
  const env = baseEnv(tempRoot);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(userConfig, 'audit=false\nfund=false\n', 'utf-8');

  const rootStageDir = join(tempRoot, 'root');
  const packageJson = stageRootPackage(rootDir, rootStageDir);
  const rootTarball = packDirectory(
    rootStageDir,
    outDir,
    cacheDir,
    userConfig,
    env
  );
  const expectedRootTarball = resolve(
    outDir,
    npmPackFilename(packageJson.name, packageJson.version)
  );
  if (rootTarball !== expectedRootTarball) {
    fail(`Unexpected root tarball name: ${rootTarball}`);
  }
  assertRootTarball(rootTarball, rootDir);
  console.log(`ok - packed ${rootTarball}`);

  const hashes: BinaryHashes = {};
  for (const target of targets) {
    const staged = stagePlatformPackage(
      rootDir,
      tempRoot,
      artifactsDir,
      target
    );
    const tarball = packDirectory(
      staged.packageStageDir,
      outDir,
      cacheDir,
      userConfig,
      env
    );
    const expectedTarball = resolve(
      outDir,
      npmPackFilename(PLATFORM_PACKAGES[target], packageJson.version)
    );
    if (tarball !== expectedTarball) {
      fail(`Unexpected ${target} tarball name: ${tarball}`);
    }
    assertPlatformTarball(tarball, rootDir, target);
    hashes[target] = {
      packageName: PLATFORM_PACKAGES[target],
      sha256: staged.sha256,
      stagedPath: `npm/${target}/tlon`,
    };
    console.log(`ok - packed ${tarball}`);
  }

  writeFileSync(
    join(outDir, 'binary-hashes.json'),
    `${JSON.stringify(hashes, null, 2)}\n`,
    'utf-8'
  );
  console.log(`ok - wrote ${join(outDir, 'binary-hashes.json')}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
