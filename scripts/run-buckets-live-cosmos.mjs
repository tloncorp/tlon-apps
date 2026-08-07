#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(repoRoot, 'apps', 'tlon-mobile');
const credentialsPath =
  process.env.BUCKETS_SHIP_CREDENTIALS ??
  '/Users/williamarzt/Desktop/buckets.md';
const source = await fs.readFile(credentialsPath, 'utf8');
const shipUrl = source.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/\/$/, '');
const accessCode = source.match(/\b[a-z]{6}(?:-[a-z]{6}){3}\b/)?.[0];

if (!shipUrl || !accessCode) {
  throw new Error('Could not parse the hosted ship URL and access code');
}

const env = {
  ...process.env,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE: accessCode,
  DEFAULT_SHIP_LOGIN_URL: shipUrl,
};
const children = [
  spawn('pnpm', ['exec', 'cosmos-native', '--port', '5050'], {
    cwd: mobileRoot,
    env,
    stdio: 'inherit',
  }),
  spawn('pnpm', ['exec', 'expo', 'start', '--port', '8082'], {
    cwd: mobileRoot,
    env,
    stdio: 'inherit',
  }),
];

function stop() {
  children.forEach((child) => child.kill('SIGTERM'));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      })
  )
);
