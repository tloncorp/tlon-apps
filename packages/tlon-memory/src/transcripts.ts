// src/transcripts.ts
// Where Claude Code and Codex keep their transcripts, and cheap looks into them without a full parse.
import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { UsageError } from './cli-util';
import { ClientName } from './config';

export interface TranscriptFile { client: ClientName; path: string }

export const claudeProjectsDir = (home = homedir()) => join(home, '.claude', 'projects');
export const codexSessionsDir = (home = homedir()) => join(home, '.codex', 'sessions');

const PEEK_BYTES = 64 * 1024;

/** Up to `max` bytes from the start of the file. */
function head(path: string, max: number): string {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(max);
    let n = 0, r: number;
    while (n < max && (r = readSync(fd, buf, n, max - n, n)) > 0) n += r;
    return buf.subarray(0, n).toString('utf8');
  } finally { closeSync(fd); }
}

function* records(path: string, max: number): Generator<any> {
  for (const line of head(path, max).split('\n')) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch { /* the window can end mid-line */ }
  }
}

export function detectClient(path: string): ClientName {
  // Codex puts its instructions in session_meta, so the first line can run well past the peek window.
  const first = head(path, 16 * PEEK_BYTES).split('\n').find((l) => l.trim());
  let rec: any; try { rec = JSON.parse(first ?? ''); } catch { /* reported below */ }
  if (rec?.type === 'session_meta') return 'codex';
  if (rec && typeof rec.sessionId === 'string') return 'claude';
  throw new UsageError(`${path} is not a Claude Code or Codex transcript`);
}

/** Every *.jsonl under `dir`, at any depth. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f));
}

/** Claude transcripts directly inside each project directory; deeper files are subagent sidechains. */
function claudeFiles(home?: string): string[] {
  const root = claudeProjectsDir(home);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
    readdirSync(join(root, d.name), { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith('.jsonl')).map((f) => join(root, d.name, f.name)));
}

export function findTranscript(key: string, home?: string): string | null {
  const i = key.indexOf(':'); const client = key.slice(0, i), id = key.slice(i + 1);
  if (client === 'claude-code') return claudeFiles(home).find((f) => basename(f) === `${id}.jsonl`) ?? null;
  if (client === 'codex') return walk(codexSessionsDir(home)).find((f) => basename(f).endsWith(`-${id}.jsonl`)) ?? null;
  return null;
}

export function listTranscripts(home?: string): TranscriptFile[] {
  return [
    ...claudeFiles(home).map((path) => ({ client: 'claude' as const, path })),
    ...walk(codexSessionsDir(home)).filter((f) => basename(f).startsWith('rollout-')).map((path) => ({ client: 'codex' as const, path })),
  ];
}

/** Session id and cwd from the first 64 KB, or null if they are not there. Field names as in the parsers. */
export function peekTranscript(client: ClientName, path: string): { sessionId: string; cwd: string } | null {
  for (const rec of records(path, PEEK_BYTES)) {
    if (client === 'codex' && rec?.type === 'session_meta' && rec.payload?.session_id && rec.payload?.cwd)
      return { sessionId: String(rec.payload.session_id), cwd: String(rec.payload.cwd) };
    if (client === 'claude' && rec?.sessionId && rec?.cwd) return { sessionId: String(rec.sessionId), cwd: String(rec.cwd) };
  }
  return null;
}
