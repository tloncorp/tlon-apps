// src/clients/json-merge.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type HookEntry = { matcher?: string; hooks: { type: 'command'; command: string; timeout?: number }[] };
export type HooksMap = Record<string, HookEntry[]>;

export const isOurs = (e: HookEntry, marker: string) => e.hooks.some((h) => h.command.includes(marker));

export function readJson(file: string): any { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}; }

export function writeJsonWithBackup(file: string, data: any) {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file) && !existsSync(`${file}.bak-tlon-memory`)) copyFileSync(file, `${file}.bak-tlon-memory`);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** Add our entries under `hooks.<Event>`, replacing any earlier entries of ours
 *  (matched by marker, or by an identical command so re-installs with any bin path stay idempotent). */
export function mergeHooks(file: string, ours: HooksMap, marker: string) {
  const data = readJson(file); data.hooks ??= {};
  const incoming = new Set(Object.values(ours).flatMap((es) => es.flatMap((e) => e.hooks.map((h) => h.command))));
  const replaced = (e: HookEntry) => isOurs(e, marker) || e.hooks.some((h) => incoming.has(h.command));
  for (const [ev, entries] of Object.entries(ours)) {
    const keep = (data.hooks[ev] ?? []).filter((e: HookEntry) => !replaced(e));
    data.hooks[ev] = [...keep, ...entries];
  }
  writeJsonWithBackup(file, data);
}

export function unmergeHooks(file: string, marker: string) {
  if (!existsSync(file)) return;
  const data = readJson(file);
  for (const ev of Object.keys(data.hooks ?? {})) {
    data.hooks[ev] = data.hooks[ev].filter((e: HookEntry) => !isOurs(e, marker));
    if (data.hooks[ev].length === 0) delete data.hooks[ev];
  }
  if (data.hooks && Object.keys(data.hooks).length === 0) delete data.hooks;
  writeJsonWithBackup(file, data);
}
