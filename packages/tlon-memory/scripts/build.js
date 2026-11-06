#!/usr/bin/env node

/**
 * Build the tlon-memory binary with the version from package.json injected.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const args = ['build', 'src/main.ts', '--compile', '--outfile', 'dist/tlon-memory', '--define', `__VERSION__=${JSON.stringify(version)}`];

console.log(`Building tlon-memory v${version}...`);
console.log(`> bun ${args.join(' ')}`);
try {
  execFileSync('bun', args, { stdio: 'inherit', cwd: root });
  console.log('Build complete!');
} catch {
  process.exit(1);
}
