#!/usr/bin/env node
import { spawn } from 'node:child_process';

const recursiveExtras = new Set(['run', '-u', '--update']);
const passthrough = process.argv.slice(2).filter((arg) => {
  return !recursiveExtras.has(arg);
});

const child = spawn(
  'pnpm',
  ['exec', 'vitest', 'run', '--config', 'vitest.config.ts', ...passthrough],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
