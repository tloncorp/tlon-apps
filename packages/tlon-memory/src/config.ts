// src/config.ts
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Paths, writePrivate } from './paths';

export type ClientName = 'claude' | 'codex';

export interface Config {
  version: 1;
  shipUrl: string;           // https://sampel-palnet.tlon.network (no trailing slash)
  ship: string;              // ~sampel-palnet
  apiKey: string;            // Notes X-Api-Key (the only secret stored)
  notebook: { host: string; name: string; title: string; rootFolderId: number;
              conversationsFolderId: number; memoriesFolderId: number } | null;
  scopes: string[];          // absolute directories where capture is on
  captureToolIo: boolean;    // include tool inputs/outputs (truncated)
  paused: boolean;
}

export function defaultConfig(): Config {
  return {
    version: 1, shipUrl: '', ship: '', apiKey: '', notebook: null, scopes: [],
    captureToolIo: true, paused: false,
  };
}

export function loadConfig(paths: Paths): Config | null {
  if (!existsSync(paths.configFile)) return null;
  const c = JSON.parse(readFileSync(paths.configFile, 'utf8'));
  if (c?.version !== 1) throw new Error(`unsupported config version ${JSON.stringify(c?.version)} in ${paths.configFile}`);
  return c as Config;
}

export function saveConfig(paths: Paths, c: Config) {
  paths.ensure();
  writePrivate(paths.configFile, JSON.stringify(c, null, 2) + '\n');
}

/** Symlinks are resolved on both sides so a linked path cannot step in or out of a scope. */
function real(p: string): string {
  try { return realpathSync(p); } catch { return resolve(p); } // a path that does not exist yet has nothing to resolve
}

export function isInScope(c: Config, cwd: string): boolean {
  const dir = real(cwd);
  return c.scopes.some((s) => { const r = real(s); return r === sep || dir === r || dir.startsWith(r + sep); });
}

export function requireConfig(paths: Paths): Config {
  const c = loadConfig(paths);
  if (!c || !c.apiKey) throw new Error('not connected: run `tlon-memory setup`');
  return c;
}
