#!/usr/bin/env node

/**
 * Build tlon-memory with the version from package.json injected: dist/tlon-memory.js for node (what the
 * plugin runs) and the dist/tlon-memory compiled binary.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const define = ['--define', `__VERSION__=${JSON.stringify(version)}`];
const builds = [
  ['build', 'src/main.ts', '--target=node', '--outfile', 'dist/tlon-memory.js', ...define],
  ['build', 'src/main.ts', '--compile', '--outfile', 'dist/tlon-memory', ...define],
];

console.log(`Building tlon-memory v${version}...`);
try {
  for (const args of builds) {
    console.log(`> bun ${args.join(' ')}`);
    execFileSync('bun', args, { stdio: 'inherit', cwd: root });
  }
  console.log('Build complete!');
} catch {
  process.exit(1);
}
