// src/status.ts
import { existsSync, readFileSync } from 'node:fs';
import { Config, isInScope } from './config';
import { appendLog } from './log';
import { Paths, writePrivate } from './paths';
import { quote } from './plugin';

export interface Connection { state: 'ok' | 'key-rejected' | 'unreachable'; lastError?: string; checkedAt?: string }
const STATES: Connection['state'][] = ['ok', 'key-rejected', 'unreachable'];

/** Connection health lives outside config.json so the hook path never rewrites the config. */
export function loadConnection(paths: Paths): Connection {
  if (!existsSync(paths.connectionFile)) return { state: 'ok' };
  try {
    const c = JSON.parse(readFileSync(paths.connectionFile, 'utf8'));
    if (!STATES.includes(c?.state)) throw new Error(`bad state ${String(c?.state)}`);
    return { state: c.state, ...(typeof c.lastError === 'string' ? { lastError: c.lastError } : {}), ...(typeof c.checkedAt === 'string' ? { checkedAt: c.checkedAt } : {}) };
  } catch (e) {
    appendLog(paths, 'connection-unreadable', { error: (e as Error).message });
    return { state: 'ok' };
  }
}

export function saveConnection(paths: Paths, c: Connection) {
  paths.ensure();
  writePrivate(paths.connectionFile, JSON.stringify(c, null, 2) + '\n');
}

/** The shim sets TLON_MEMORY_CLI to its own path; agents have no `tlon-memory` on PATH, so they need that path. */
export function setupCommand(cli = process.env.TLON_MEMORY_CLI): string {
  return cli ? `node ${quote(cli)} setup` : 'tlon-memory setup';
}

export function statusLine(cfg: Config, conn: Connection, cwd: string, pending: number, sessionKey?: string, cli?: string): string {
  const scope = cfg.paused ? 'capture PAUSED' : isInScope(cfg, cwd) ? `capture ON for ${cwd}` : `capture OFF for ${cwd} (not in scope)`;
  const state = conn.state === 'key-rejected' ? 'KEY REJECTED — run `tlon-memory setup --reconnect`'
    : conn.state === 'unreachable' ? `ship unreachable (${conn.lastError ?? 'unknown'})` : `connected as ${cfg.ship}`;
  return `Tlon memory: ${state} · notebook "${cfg.notebook?.title ?? '-'}" · ${scope} · ${pending} pending sync${pending === 1 ? '' : 's'}`
    + (sessionKey ? ` · session ${sessionKey}` : '') + (cli ? ` · cli ${cli}` : '');
}
