#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageName = 'expo-share-intent';
const packageVersion = '3.2.3';
const editDir = path.join(repoRoot, '.tmp', `${packageName}-patch`);
const appControllerPath = path.join(
  repoRoot,
  'apps/tlon-mobile/ios/ShareExtension/ShareViewController.swift'
);
const packageControllerPath = path.join(
  editDir,
  'plugin/build/ios/ShareExtensionViewController.swift'
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

function packageControllerSource() {
  const source = readFileSync(appControllerPath, 'utf8')
    // The committed app copy uses real local defaults. The package patch needs
    // placeholders so Expo config plugins can substitute the consuming app.
    .replace('?? "group.io.tlon.groups"', '?? "<GROUPIDENTIFIER>"')
    .replace('?? "io.tlon.groups.share-extension"', '?? "<SCHEME>.share-extension"');

  if (
    source.includes('group.io.tlon.groups') ||
    source.includes('io.tlon.groups.share-extension')
  ) {
    throw new Error('Share extension package source still contains app-specific defaults');
  }

  return source;
}

rmSync(editDir, { recursive: true, force: true });

try {
  console.log(`Preparing clean ${packageName}@${packageVersion} patch workspace`);
  run('pnpm', [
    'patch',
    `${packageName}@${packageVersion}`,
    '--ignore-existing',
    '--edit-dir',
    editDir,
  ]);

  console.log('Copying working ShareViewController into package source');
  mkdirSync(path.dirname(packageControllerPath), { recursive: true });
  writeFileSync(packageControllerPath, packageControllerSource());

  console.log('Generating pnpm patch');
  run('pnpm', ['patch-commit', editDir]);
} finally {
  rmSync(editDir, { recursive: true, force: true });
}
