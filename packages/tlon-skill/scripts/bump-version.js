#!/usr/bin/env node

/**
 * Bump version in all package.json files
 * Usage: node scripts/bump-version.js <version>
 * Example: node scripts/bump-version.js 0.1.5
 */
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

for (const file of packageFiles) {
  const filePath = join(rootDir, file);
  try {
    const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));
    const oldVersion = pkg.version;
    pkg.version = newVersion;

    writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${file}: ${oldVersion} → ${newVersion}`);
  } catch (err) {
    failed = true;
    console.error(`  ${file}: ERROR - ${err.message}`);
  }
}

if (failed) {
  console.error('\nVersion bump failed; see errors above.');
  process.exit(1);
}

console.log("\nDone! Don't forget to:");
console.log('  1. Update CHANGELOG.md (if you have one)');
console.log('  2. Commit the changes and merge to develop');
console.log(
  '  3. Release by tagging tlon-skill-v' +
    newVersion +
    ' or dispatching the tlon-skill-publish workflow'
);
