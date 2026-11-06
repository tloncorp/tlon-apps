// src/clients/index.ts
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { HooksMap, mergeHooks, unmergeHooks } from './json-merge';

export type Client = 'claude' | 'codex';
export interface ExecResult { code: number; out: string; err: string }
export type Exec = (cmd: string, args: string[]) => Promise<ExecResult>;
export interface InstallOptions { home?: string; binPath: string; exec?: Exec; skillSource: string }

export const defaultExec: Exec = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
  p.on('error', (e) => res({ code: 127, out, err: e.message }));
  p.on('close', (code) => res({ code: code ?? 1, out, err }));
});

const MARKER = (c: Client) => `tlon-memory.js" hook ${c}`;

export function hookEntries(client: Client, binPath: string): HooksMap {
  const cmd = `"${binPath}" hook ${client}`;
  const entry = (timeout: number) => [{ hooks: [{ type: 'command' as const, command: cmd, timeout }] }];
  return { SessionStart: entry(5), Stop: entry(20), SessionEnd: entry(client === 'codex' ? 3 : 20) };
}

export const paths = (client: Client, home = homedir()) => ({
  hooksFile: client === 'claude' ? join(home, '.claude', 'settings.json') : join(home, '.codex', 'hooks.json'),
  skillDir: client === 'claude' ? join(home, '.claude', 'skills', 'tlon-memory') : join(home, '.agents', 'skills', 'tlon-memory'),
});

export function mcpAddArgs(client: Client, binPath: string): [string, string[]] {
  return client === 'claude'
    ? ['claude', ['mcp', 'add', '-s', 'user', 'tlon-memory', '-e', 'TLON_MEMORY_AGENT=claude-code', '--', binPath, 'mcp']]
    : ['codex', ['mcp', 'add', '--env', 'TLON_MEMORY_AGENT=codex', 'tlon-memory', '--', binPath, 'mcp']];
}
export function mcpRemoveArgs(client: Client): [string, string[]] {
  return client === 'claude' ? ['claude', ['mcp', 'remove', '-s', 'user', 'tlon-memory']] : ['codex', ['mcp', 'remove', 'tlon-memory']];
}

const NOT_FOUND = /not found|no .*mcp server|does not exist/i;
const brief = (r: ExecResult) => (r.err || r.out).trim().slice(0, 300);

export async function installClient(client: Client, o: InstallOptions): Promise<{ mcp: boolean; hooks: boolean; skill: boolean; mcpError?: string }> {
  const exec = o.exec ?? defaultExec; const p = paths(client, o.home);
  mergeHooks(p.hooksFile, hookEntries(client, o.binPath), MARKER(client), o.home);
  // `mcp add` fails when the name is already registered, so a re-install removes it first.
  const [rc, ra] = mcpRemoveArgs(client);
  const removed = await exec(rc, ra);
  const [cmd, args] = mcpAddArgs(client, o.binPath);
  const r = await exec(cmd, args);
  mkdirSync(p.skillDir, { recursive: true });
  copyFileSync(o.skillSource, join(p.skillDir, 'SKILL.md'));
  const removeErr = removed.code !== 0 && !NOT_FOUND.test(brief(removed)) ? `; mcp remove: ${brief(removed)}` : '';
  return { mcp: r.code === 0, hooks: true, skill: true, ...(r.code !== 0 ? { mcpError: brief(r) + removeErr } : {}) };
}

/** Idempotent: safe to run for a client that was never installed. Returns the `mcp remove` result for reporting. */
export async function uninstallClient(client: Client, o: InstallOptions): Promise<{ mcp: ExecResult; mcpNotFound: boolean; shifted: boolean }> {
  const exec = o.exec ?? defaultExec; const p = paths(client, o.home);
  const { shifted } = unmergeHooks(p.hooksFile, MARKER(client), o.home);
  const [cmd, args] = mcpRemoveArgs(client);
  const mcp = await exec(cmd, args);
  rmSync(p.skillDir, { recursive: true, force: true });
  return { mcp, mcpNotFound: mcp.code !== 0 && NOT_FOUND.test(brief(mcp)), shifted };
}

export async function detectClient(client: Client, exec: Exec = defaultExec): Promise<boolean> {
  return (await exec(client, ['--version'])).code === 0;
}
