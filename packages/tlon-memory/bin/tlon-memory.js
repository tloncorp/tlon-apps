#!/usr/bin/env node
// bin/tlon-memory.js — dev shim. Runs the compiled binary when present, else bun.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, '..', 'dist', 'tlon-memory');
const args = process.argv.slice(2);

/** Hooks launched from a GUI app may get a minimal PATH without bun, so the usual install locations are tried too. */
function runBun() {
  const main = join(here, '..', 'src', 'main.ts');
  const candidates = ['bun', join(homedir(), '.bun', 'bin', 'bun'), '/opt/homebrew/bin/bun', '/usr/local/bin/bun'];
  for (const bun of candidates) {
    if (bun !== 'bun' && !existsSync(bun)) continue;
    const r = spawnSync(bun, ['run', main, ...args], { stdio: 'inherit' });
    if (r.error?.code === 'ENOENT') continue;
    return r;
  }
  process.stderr.write('tlon-memory: bun not found on PATH or in ~/.bun/bin, /opt/homebrew/bin, /usr/local/bin. '
    + 'Hooks launched from a GUI app may have a minimal PATH; run `pnpm build` in packages/tlon-memory to use the compiled binary instead.\n');
  process.exit(127);
}

const r = existsSync(compiled) ? spawnSync(compiled, args, { stdio: 'inherit' }) : runBun();
if (r.error) process.stderr.write(`tlon-memory: ${r.error.message}\n`);
process.exit(r.status ?? 1);
