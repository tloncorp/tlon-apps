// src/clients/json-merge.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { writeAtomic } from '../paths';

export type HookCommand = { type: 'command'; command: string; timeout?: number };
export type HookEntry = { matcher?: string; hooks: HookCommand[] };
export type HooksMap = Record<string, HookEntry[]>;

const tilde = (file: string, home: string) => (file.startsWith(home + '/') ? '~' + file.slice(home.length) : file);

function shapeError(d: any): string | null {
  if (d === null || typeof d !== 'object' || Array.isArray(d)) return 'top level is not an object';
  if (d.hooks === undefined) return null;
  if (d.hooks === null || typeof d.hooks !== 'object' || Array.isArray(d.hooks)) return '"hooks" is not an object';
  for (const [ev, es] of Object.entries(d.hooks)) {
    if (!Array.isArray(es)) return `hooks.${ev} is not an array`;
    for (const [i, e] of es.entries()) if (!e || typeof e !== 'object' || !Array.isArray(e.hooks)) return `hooks.${ev}[${i}] has no "hooks" array`;
  }
  return null;
}

/** Read a settings/hooks file owned by another tool; the `hooks` part we edit must have the documented shape. */
export function readHooksFile(file: string, home = homedir()): any {
  if (!existsSync(file)) return {};
  let data: any;
  try { data = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`cannot parse ${tilde(file, home)}: ${(e as Error).message}`); }
  const reason = shapeError(data);
  if (reason) throw new Error(`cannot parse ${tilde(file, home)}: ${reason}`);
  return data;
}

export const backupFile = (file: string) => `${file}.bak-tlon-memory`;

/** Back up the current file, then replace it atomically. A symlinked file (dotfile managers) stays a symlink. */
function writeHooksFile(file: string, data: any) {
  mkdirSync(dirname(file), { recursive: true });
  const exists = existsSync(file);
  const target = exists ? realpathSync(file) : file;
  if (exists) copyFileSync(target, backupFile(file));
  writeAtomic(target, JSON.stringify(data, null, 2) + '\n', exists ? statSync(target).mode & 0o777 : 0o600);
}

/**
 * Install our entries under `hooks.<Event>`. Ownership is per hook command (marker, or an identical command so
 * re-installs with any bin path stay idempotent). Our entry is replaced at the index it already had, because
 * Codex records hook trust per index and moving other tools' entries would invalidate their trust.
 */
export function mergeHooks(file: string, ours: HooksMap, marker: string, home = homedir()) {
  const data = readHooksFile(file, home); data.hooks ??= {};
  const incoming = new Set(Object.values(ours).flatMap((es) => es.flatMap((e) => e.hooks.map((h) => h.command))));
  const mine = (h: HookCommand) => typeof h?.command === 'string' && (h.command.includes(marker) || incoming.has(h.command));
  for (const [ev, entries] of Object.entries(ours)) {
    const list: HookEntry[] = data.hooks[ev] ?? [];
    let slot = -1;
    const next: HookEntry[] = [];
    for (const e of list) {
      if (!e.hooks.some(mine)) { next.push(e); continue; }
      const rest = e.hooks.filter((h) => !mine(h));
      if (rest.length) next.push({ ...e, hooks: rest });
      else if (slot < 0) { slot = next.length; next.push(e); } // placeholder, replaced below
    }
    if (slot >= 0) next.splice(slot, 1, ...entries); else next.push(...entries);
    data.hooks[ev] = next;
  }
  writeHooksFile(file, data);
}

/** Remove our hook commands; an entry is dropped only when nothing else is left in it. Returns whether any were
 *  there and whether a remaining entry moved to a lower index (Codex then needs `/hooks` to re-trust it). */
export function unmergeHooks(file: string, marker: string, home = homedir()): { removed: boolean; shifted: boolean } {
  if (!existsSync(file)) return { removed: false, shifted: false };
  const data = readHooksFile(file, home);
  const mine = (h: HookCommand) => typeof h?.command === 'string' && h.command.includes(marker);
  let changed = false, shifted = false;
  for (const ev of Object.keys(data.hooks ?? {})) {
    const list: HookEntry[] = data.hooks[ev];
    if (!list.some((e) => e.hooks.some(mine))) continue;
    changed = true;
    const next: HookEntry[] = []; let dropped = false;
    for (const e of list) {
      if (!e.hooks.some(mine)) { if (dropped) shifted = true; next.push(e); continue; }
      const rest = e.hooks.filter((h) => !mine(h));
      if (rest.length) next.push({ ...e, hooks: rest }); else dropped = true;
    }
    if (next.length) data.hooks[ev] = next; else delete data.hooks[ev];
  }
  if (!changed) return { removed: false, shifted: false };
  if (Object.keys(data.hooks).length === 0) delete data.hooks;
  writeHooksFile(file, data);
  return { removed: true, shifted };
}
