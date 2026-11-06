// src/config.ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Paths, writePrivate } from './paths';

export type ClientName = 'claude' | 'codex';

export interface ClientInstall {
  mcp: boolean;        // MCP server registered
  hooks: boolean;      // hook entries merged
  skill: boolean;      // SKILL.md installed
  installedAt: string; // ISO
}

export interface Config {
  version: 1;
  shipUrl: string;           // https://sitrul-nacwyl.tlon.network (no trailing slash)
  ship: string;              // ~sitrul-nacwyl
  apiKey: string;            // Notes X-Api-Key (the only secret stored)
  notebook: { host: string; name: string; title: string; rootFolderId: number;
              conversationsFolderId: number; memoriesFolderId: number } | null;
  scopes: string[];          // absolute directories where capture is on
  captureToolIo: boolean;    // include tool inputs/outputs (truncated)
  paused: boolean;
  clients: Partial<Record<ClientName, ClientInstall>>;
  connection: { state: 'ok' | 'key-rejected' | 'unreachable'; lastError?: string; checkedAt?: string };
  binPath: string;           // absolute path of bin/tlon-memory.js used in hook/MCP commands
}

export function defaultConfig(): Config {
  return {
    version: 1, shipUrl: '', ship: '', apiKey: '', notebook: null, scopes: [],
    captureToolIo: true, paused: false, clients: {}, connection: { state: 'ok' }, binPath: '',
  };
}

export function loadConfig(paths: Paths): Config | null {
  if (!existsSync(paths.configFile)) return null;
  return JSON.parse(readFileSync(paths.configFile, 'utf8')) as Config;
}

export function saveConfig(paths: Paths, c: Config) {
  paths.ensure();
  writePrivate(paths.configFile, JSON.stringify(c, null, 2) + '\n');
}

export function isInScope(c: Config, cwd: string): boolean {
  const dir = resolve(cwd);
  return c.scopes.some((s) => dir === resolve(s) || dir.startsWith(resolve(s) + sep));
}

export function requireConfig(paths: Paths): Config {
  const c = loadConfig(paths);
  if (!c || !c.apiKey) throw new Error('not connected: run `tlon-memory setup`');
  return c;
}
