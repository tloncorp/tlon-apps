#!/usr/bin/env node

/**
 * Build script for all platforms.
 * Run locally to build for current platform only.
 * CI runs this on each platform's runner, or cross-compiles with --target.
 *
 * Usage:
 *   node scripts/build-all.js                    # Build for current platform
 *   node scripts/build-all.js --target linux-x64 # Cross-compile for linux-x64
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;

function parseTargetArg(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--target') {
      return args[i + 1] ?? '';
    }
    if (arg.startsWith('--target=')) {
      return arg.slice('--target='.length);
    }
  }
  return `${process.platform}-${process.arch}`;
}

// Parse --target argument
const target = parseTargetArg(process.argv.slice(2));
if (!target) {
  console.error('Missing value for --target');
  process.exit(1);
}

// Map our target names to bun's target names
const bunTargets = {
  'darwin-arm64': 'bun-darwin-arm64',
  'darwin-x64': 'bun-darwin-x64',
  'linux-x64': 'bun-linux-x64',
  'linux-arm64': 'bun-linux-arm64',
};

const bunTarget = bunTargets[target];
if (!bunTarget) {
  console.error(`Unknown target: ${target}`);
  console.error(`Supported targets: ${Object.keys(bunTargets).join(', ')}`);
  process.exit(1);
}

console.log(
  `Building tlon v${version} for ${target} (bun target: ${bunTarget})...`
);

// Build the binary
const distDir = join(rootDir, 'dist');
mkdirSync(distDir, { recursive: true });

const binaryName = target.startsWith('win') ? 'tlon.exe' : 'tlon';
const binaryPath = join(distDir, binaryName);

// Compile from a local tmp cwd: bun writes its temp artifact into the cwd
// and renames it to the outfile, and that rename fails whenever cwd and
// outfile live on different mounts (e.g. a docker bind-mounted source dir).
// Keeping both in the same tmp dir sidesteps it; the entry file is passed
// absolutely so module resolution still happens against the real source.
const stagingDir = mkdtempSync(join(tmpdir(), 'tlon-build-'));
const stagedBinary = join(stagingDir, binaryName);
const entryFile = join(rootDir, 'scripts', 'main.ts');

execSync(
  `bun build ${entryFile} --compile --target=${bunTarget} --outfile ${stagedBinary} --define __VERSION__='"${version}"'`,
  {
    cwd: stagingDir,
    stdio: 'inherit',
  }
);
cpSync(stagedBinary, binaryPath);
rmSync(stagingDir, { recursive: true, force: true });

// Copy to the appropriate npm package directory. This is publish prep, not
// part of producing dist/ — don't let it kill a dev build (e.g. a stale
// root-owned file from a container run that the host user can't chmod).
const npmDir = join(rootDir, 'npm', target);
try {
  mkdirSync(npmDir, { recursive: true });
  rmSync(join(npmDir, binaryName), { force: true });
  cpSync(binaryPath, join(npmDir, binaryName));
  console.log(`Built and copied to npm/${target}/${binaryName}`);
} catch (err) {
  console.warn(
    `warning: built dist/${binaryName} but could not copy to npm/${target}: ${err.message}`
  );
}
