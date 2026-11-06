#!/usr/bin/env node
// bin/tlon-memory.js — dev shim. Runs the compiled binary when present, else bun.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, '..', 'dist', 'tlon-memory');
const args = process.argv.slice(2);
const r = existsSync(compiled)
  ? spawnSync(compiled, args, { stdio: 'inherit' })
  : spawnSync('bun', ['run', join(here, '..', 'src', 'main.ts'), ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
