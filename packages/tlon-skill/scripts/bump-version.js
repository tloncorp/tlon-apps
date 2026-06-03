#!/usr/bin/env node

/**
 * Bump version in all package.json files
 * Usage: node scripts/bump-version.js <version>
 * Example: node scripts/bump-version.js 0.1.5
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const packageFiles = [
  'package.json',
  'npm/darwin-arm64/package.json',
  'npm/darwin-x64/package.json',
  'npm/linux-x64/package.json',
  'npm/linux-arm64/package.json',
];

const packageLockFile = 'package-lock.json';
const tlonSkillPackagePrefix = '@tloncorp/tlon-skill-';

const newVersion = process.argv[2];

if (!newVersion) {
  // Read current version
  const mainPkg = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf-8')
  );
  console.log(`Current version: ${mainPkg.version}`);
  console.log('\nUsage: node scripts/bump-version.js <version>');
  console.log('Example: node scripts/bump-version.js 0.1.5');
  process.exit(0);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: ${newVersion}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-tag');
  process.exit(1);
}

console.log(`Bumping version to ${newVersion}...\n`);

let failed = false;

function getTlonSkillOptionalDeps(optionalDependencies) {
  if (!optionalDependencies) {
    return [];
  }

  return Object.keys(optionalDependencies).filter((dep) =>
    dep.startsWith(tlonSkillPackagePrefix)
  );
}

function updateTlonSkillOptionalDeps(optionalDependencies) {
  for (const dep of getTlonSkillOptionalDeps(optionalDependencies)) {
    optionalDependencies[dep] = newVersion;
  }
}

function targetFromPlatformPackage(packageName) {
  return packageName.slice(tlonSkillPackagePrefix.length);
}

function getLocalPlatformOptionalDeps(optionalDependencies) {
  return Object.fromEntries(
    getTlonSkillOptionalDeps(optionalDependencies).map((dep) => [
      dep,
      `file:npm/${targetFromPlatformPackage(dep)}`,
    ])
  );
}

function readJson(file) {
  return JSON.parse(readFileSync(join(rootDir, file), 'utf-8'));
}

function writeJson(file, value) {
  writeFileSync(join(rootDir, file), JSON.stringify(value, null, 2) + '\n');
}

function refreshPackageLockFromLocalPlatformPackages(finalRootPackage) {
  const originalPackageJson = readFileSync(
    join(rootDir, 'package.json'),
    'utf-8'
  );
  const localPlatformDeps = getLocalPlatformOptionalDeps(
    finalRootPackage.optionalDependencies
  );

  const tempRootPackage = structuredClone(finalRootPackage);
  tempRootPackage.optionalDependencies = {
    ...tempRootPackage.optionalDependencies,
    ...localPlatformDeps,
  };

  try {
    writeJson('package.json', tempRootPackage);
    execFileSync(
      'npm',
      [
        'install',
        '--package-lock-only',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
      ],
      { cwd: rootDir, stdio: 'inherit' }
    );
  } finally {
    writeFileSync(join(rootDir, 'package.json'), originalPackageJson);
  }

  const packageLock = readJson(packageLockFile);
  packageLock.version = newVersion;

  const rootPackage = packageLock.packages?.[''];
  if (rootPackage) {
    rootPackage.version = newVersion;
    rootPackage.optionalDependencies = {
      ...rootPackage.optionalDependencies,
      ...finalRootPackage.optionalDependencies,
    };
  }

  writeJson(packageLockFile, packageLock);
}

for (const file of packageFiles) {
  const filePath = join(rootDir, file);
  try {
    const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));
    const oldVersion = pkg.version;
    pkg.version = newVersion;

    // Also update optionalDependencies versions in main package.json
    if (file === 'package.json') {
      updateTlonSkillOptionalDeps(pkg.optionalDependencies);
    }

    writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${file}: ${oldVersion} → ${newVersion}`);
  } catch (err) {
    failed = true;
    console.error(`  ${file}: ERROR - ${err.message}`);
  }
}

try {
  const oldVersion = readJson(packageLockFile).version;
  const rootPackage = readJson('package.json');
  refreshPackageLockFromLocalPlatformPackages(rootPackage);
  console.log(`  ${packageLockFile}: ${oldVersion} → ${newVersion}`);
} catch (err) {
  failed = true;
  console.error(`  ${packageLockFile}: ERROR - ${err.message}`);
}

if (failed) {
  console.error('\nVersion bump failed; see errors above.');
  process.exit(1);
}

console.log("\nDone! Don't forget to:");
console.log('  1. Update CHANGELOG.md (if you have one)');
console.log('  2. Commit the changes');
console.log('  3. Tag the release: git tag v' + newVersion);
console.log('  4. Push: git push && git push --tags');
