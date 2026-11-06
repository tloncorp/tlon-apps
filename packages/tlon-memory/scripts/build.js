#!/usr/bin/env node

/**
 * Build tlon-memory with the version from package.json injected: dist/tlon-memory.js for node (what the
 * plugin runs, committed so a git install needs no build) and the dist/tlon-memory compiled binary.
 * --check builds the node bundle to a temporary file and fails if the committed one differs.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const define = ['--define', `__VERSION__=${JSON.stringify(version)}`];
const bundle = (outfile) => ['build', 'src/main.ts', '--target=node', '--outfile', outfile, ...define];
const bun = (args, stdio) => execFileSync('bun', args, { stdio, cwd: root });

if (process.argv.includes('--check')) {
  const tmp = mkdtempSync(join(tmpdir(), 'tlon-memory-build-'));
  try {
    bun(bundle(join(tmp, 'tlon-memory.js')), 'ignore');
    if (!readFileSync(join(tmp, 'tlon-memory.js')).equals(readFileSync(join(root, 'dist', 'tlon-memory.js')))) {
      console.error('dist/tlon-memory.js does not match the source: run `pnpm build` and commit dist/tlon-memory.js.');
      process.exit(1);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  process.exit(0);
}

console.log(`Building tlon-memory v${version}...`);
try {
  for (const args of [bundle('dist/tlon-memory.js'), ['build', 'src/main.ts', '--compile', '--outfile', 'dist/tlon-memory', ...define]]) {
    console.log(`> bun ${args.join(' ')}`);
    bun(args, 'inherit');
  }
  console.log('Build complete!');
} catch {
  process.exit(1);
}
