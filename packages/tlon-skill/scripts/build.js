#!/usr/bin/env node

/**
 * Build the tlon binary with version injected
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);
const version = pkg.version;

console.log(`Building tlon v${version}...`);

const cmd = `bun build scripts/main.ts --compile --outfile dist/tlon-run --define __VERSION__='"${version}"'`;
console.log(`> ${cmd}`);

try {
  execSync(cmd, { stdio: 'inherit', cwd: join(__dirname, '..') });
  console.log('Build complete!');
} catch (err) {
  process.exit(1);
}
