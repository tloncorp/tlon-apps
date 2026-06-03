import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

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
  nodeModulesPackagePath,
  npmPackFilename,
  runCommand,
  sha256File,
  smokeCliBinary,
} from './release-utils';

type RootPackageJson = {
  name: string;
  version: string;
  optionalDependencies?: Record<string, string>;
};

type LockPackage = {
  version?: string;
  resolved?: string;
  optionalDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, LockPackage>;
};

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

function parseTarget(): Target {
  const value = argValue('--target') ?? currentTarget();
  if (!isTarget(value)) {
    fail(`Unknown target ${value}. Supported targets: ${TARGETS.join(', ')}`);
  }
  return value;
}

function requirePath(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }
}

function assertLockResolvedFromTarball(
  lock: PackageLock,
  packageName: string,
  expectedVersion: string,
  tarballPath: string
): void {
  const key = `node_modules/${packageName}`;
  const entry = lock.packages?.[key];
  if (!entry) {
    fail(`package-lock.json is missing ${key}`);
  }
  if (entry.version !== expectedVersion) {
    fail(
      `${key} version ${entry.version ?? '<missing>'} did not match ${expectedVersion}`
    );
  }
  if (!entry.resolved?.startsWith('file:')) {
    fail(
      `${key} did not resolve from a local file tarball: ${entry.resolved ?? '<missing>'}`
    );
  }
  if (!entry.resolved.includes(basename(tarballPath))) {
    fail(
      `${key} resolved to ${entry.resolved}, expected ${basename(tarballPath)}`
    );
  }
}

function assertRootDeclaresNativeOptionalDependency(
  installedRootPackageJson: RootPackageJson,
  rootLockEntry: LockPackage | undefined,
  nativePackageName: string
): void {
  const expectedVersion = installedRootPackageJson.version;
  const packageJsonVersion =
    installedRootPackageJson.optionalDependencies?.[nativePackageName];
  if (packageJsonVersion !== expectedVersion) {
    fail(
      `Installed root package optionalDependencies.${nativePackageName} was ${packageJsonVersion ?? '<missing>'}, expected ${expectedVersion}`
    );
  }

  const lockVersion = rootLockEntry?.optionalDependencies?.[nativePackageName];
  if (lockVersion !== expectedVersion) {
    fail(
      `package-lock root optionalDependencies.${nativePackageName} was ${lockVersion ?? '<missing>'}, expected ${expectedVersion}`
    );
  }
}

function assertWrapperBinResolvesToRootWrapper(
  wrapperPath: string,
  rootPackageDir: string
): void {
  const expectedWrapper = join(rootPackageDir, 'bin', 'tlon.js');
  const actual = realpathSync(wrapperPath);
  const expected = realpathSync(expectedWrapper);
  if (actual !== expected) {
    fail(
      `node_modules/.bin/tlon resolved to ${actual}, expected root wrapper ${expected}`
    );
  }
}

function assertNoRunnableNonNativePackages(
  projectDir: string,
  target: Target
): void {
  for (const otherTarget of TARGETS) {
    if (otherTarget === target) {
      continue;
    }
    const packageDir = nodeModulesPackagePath(
      projectDir,
      PLATFORM_PACKAGES[otherTarget]
    );
    const binaryPath = join(packageDir, 'tlon');
    if (!existsSync(binaryPath)) {
      continue;
    }

    const stat = statSync(binaryPath);
    if (stat.isFile() && (stat.mode & 0o111) !== 0) {
      fail(
        `Non-native package ${PLATFORM_PACKAGES[otherTarget]} installed runnable binary ${binaryPath}`
      );
    }
  }
}

const rootDir = process.cwd();
const target = parseTarget();
const runtimeTarget = currentTarget();
if (target !== runtimeTarget) {
  fail(
    `Package smoke target ${target} must match native runner ${runtimeTarget}`
  );
}

const tarballDir = resolve(
  rootDir,
  argValue('--tarball-dir') ?? 'release-tarballs'
);
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8')
) as RootPackageJson;
const nativePackageName = PLATFORM_PACKAGES[target];
const rootTarball = join(
  tarballDir,
  npmPackFilename(packageJson.name, packageJson.version)
);
const nativeTarball = join(
  tarballDir,
  npmPackFilename(nativePackageName, packageJson.version)
);
const hashesPath = join(tarballDir, 'binary-hashes.json');

requirePath(rootTarball, 'root tarball');
requirePath(nativeTarball, `${target} tarball`);
requirePath(hashesPath, 'binary hash manifest');
assertRootTarball(rootTarball, rootDir);
assertPlatformTarball(nativeTarball, rootDir, target);

const hashes = JSON.parse(readFileSync(hashesPath, 'utf-8')) as BinaryHashes;
const expectedHash = hashes[target]?.sha256;
if (!expectedHash) {
  fail(`binary-hashes.json is missing ${target}`);
}
if (hashes[target]?.packageName !== nativePackageName) {
  fail(
    `binary-hashes.json package for ${target} did not match ${nativePackageName}`
  );
}

const tempRoot = mkdtempSync(join(tmpdir(), 'tlon-package-smoke-'));
try {
  const projectDir = join(tempRoot, 'project');
  const cacheDir = join(tempRoot, 'npm-cache');
  const userConfig = join(tempRoot, 'npmrc');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({ private: true }, null, 2),
    'utf-8'
  );
  writeFileSync(
    userConfig,
    [
      'registry=http://127.0.0.1:9/',
      'fetch-retries=0',
      'fetch-timeout=1000',
      'fetch-retry-mintimeout=1000',
      'fetch-retry-maxtimeout=1000',
      'audit=false',
      'fund=false',
      '',
    ].join('\n'),
    'utf-8'
  );

  runCommand(
    'npm',
    [
      '--cache',
      cacheDir,
      '--userconfig',
      userConfig,
      'install',
      '--fetch-retries=0',
      '--fetch-timeout=1000',
      '--fetch-retry-mintimeout=1000',
      '--fetch-retry-maxtimeout=1000',
      '--no-audit',
      '--fund=false',
      rootTarball,
      nativeTarball,
    ],
    {
      cwd: projectDir,
      env: baseEnv(tempRoot),
    }
  );

  const lock = JSON.parse(
    readFileSync(join(projectDir, 'package-lock.json'), 'utf-8')
  ) as PackageLock;
  assertLockResolvedFromTarball(
    lock,
    packageJson.name,
    packageJson.version,
    rootTarball
  );
  assertLockResolvedFromTarball(
    lock,
    nativePackageName,
    packageJson.version,
    nativeTarball
  );

  const rootPackageDir = nodeModulesPackagePath(projectDir, packageJson.name);
  const rootLockEntry = lock.packages?.[`node_modules/${packageJson.name}`];
  const installedRootPackageJson = JSON.parse(
    readFileSync(join(rootPackageDir, 'package.json'), 'utf-8')
  ) as RootPackageJson;
  assertRootDeclaresNativeOptionalDependency(
    installedRootPackageJson,
    rootLockEntry,
    nativePackageName
  );

  const rootLocalBinary = join(rootPackageDir, 'bin', 'tlon');
  if (existsSync(rootLocalBinary)) {
    fail(`Installed root package must not contain ${rootLocalBinary}`);
  }

  const nativePackageDir = nodeModulesPackagePath(
    projectDir,
    nativePackageName
  );
  const nativePackageJson = JSON.parse(
    readFileSync(join(nativePackageDir, 'package.json'), 'utf-8')
  ) as RootPackageJson;
  if (nativePackageJson.name !== nativePackageName) {
    fail(`Installed native package name did not match ${nativePackageName}`);
  }
  if (nativePackageJson.version !== packageJson.version) {
    fail(
      `Installed native package version ${nativePackageJson.version} did not match ${packageJson.version}`
    );
  }

  const nativeBinary = join(nativePackageDir, 'tlon');
  assertExecutableFile(nativeBinary, `${target} installed native binary`);
  const installedHash = sha256File(nativeBinary);
  if (installedHash !== expectedHash) {
    fail(
      `${target} installed binary hash ${installedHash} did not match workflow-built hash ${expectedHash}`
    );
  }

  assertNoRunnableNonNativePackages(projectDir, target);

  const wrapper = join(projectDir, 'node_modules', '.bin', 'tlon');
  assertWrapperBinResolvesToRootWrapper(wrapper, rootPackageDir);
  smokeCliBinary(wrapper, packageJson.version, projectDir);
  console.log(`ok - package smoke passed for ${target}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
