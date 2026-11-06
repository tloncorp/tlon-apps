// src/log.ts
import { appendFileSync } from 'node:fs';
import { Paths } from './paths';
import { redact } from './redact';

const ALLOWED = new Set(['status', 'session', 'client', 'count', 'bytes', 'note', 'event', 'error', 'ms', 'queued']);

/** Append one line: `<iso> <kind> k=v k=v`. Only allow-listed keys are written, and values are redacted (error text can echo input). */
export function appendLog(paths: Paths, kind: string, fields: Record<string, string | number | undefined>) {
  paths.ensure();
  const parts = Object.entries(fields)
    .filter(([k, v]) => ALLOWED.has(k) && v !== undefined)
    .map(([k, v]) => `${k}=${redact(String(v)).replace(/\s+/g, ' ').slice(0, 200)}`);
  appendFileSync(paths.logFile, `${new Date().toISOString()} ${kind} ${parts.join(' ')}\n`, { mode: 0o600 });
}
