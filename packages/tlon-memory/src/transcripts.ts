// src/transcripts.ts
// Where Claude Code and Codex keep their transcripts, and cheap looks into them without a full parse.
import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { UsageError } from './cli-util';
import { ClientName } from './config';

export interface TranscriptFile { client: ClientName; path: string }

export const SESSION_KEY = /^(claude-code|codex):[A-Za-z0-9._-]{1,128}$/;
/** The client of a key that matches SESSION_KEY. */
export const clientOfKey = (key: string): ClientName => (key.startsWith('codex:') ? 'codex' : 'claude');

export const claudeProjectsDir = (home = homedir()) => join(home, '.claude', 'projects');
export const codexSessionsDir = (home = homedir()) => join(home, '.codex', 'sessions');

const PEEK_BYTES = 64 * 1024;
/** Records read before a peek or detectClient gives up; the ids come within the first few in practice. */
const PEEK_RECORDS = 50;

/** The first `max` non-empty lines, read in chunks: a long record costs its own length and nothing after it is read. */
function* lines(path: string, max: number): Generator<string> {
  const fd = openSync(path, 'r'), chunk = Buffer.alloc(PEEK_BYTES);
  let parts: Buffer[] = [], pos = 0, seen = 0;
  try {
    for (;;) {
      const r = readSync(fd, chunk, 0, chunk.length, pos); pos += r;
      if (!r) { const l = Buffer.concat(parts).toString('utf8'); if (l.trim()) yield l; return; }
      const data = chunk.subarray(0, r);
      let start = 0, i: number;
      while ((i = data.indexOf(10, start)) >= 0) {
        parts.push(data.subarray(start, i)); const l = Buffer.concat(parts).toString('utf8'); parts = []; start = i + 1;
        if (l.trim()) { yield l; if (++seen >= max) return; }
      }
      parts.push(Buffer.from(data.subarray(start))); // a copy: the chunk is reused
    }
  } finally { closeSync(fd); }
}

/** By the first records: Codex opens with session_meta, Claude records carry sessionId (a summary may come first). */
export function detectClient(path: string): ClientName {
  for (const line of lines(path, PEEK_RECORDS)) {
    let rec: any; try { rec = JSON.parse(line); } catch { continue; }
    if (rec?.type === 'session_meta') return 'codex';
    if (typeof rec?.sessionId === 'string') return 'claude';
  }
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

/** Session id and cwd from the first record holding both, within PEEK_RECORDS, or null. Field names as in the parsers. */
export function peekTranscript(client: ClientName, path: string): { sessionId: string; cwd: string } | null {
  for (const line of lines(path, PEEK_RECORDS)) {
    if (!line.includes('"cwd"')) continue; // skips parsing the large records that come first
    let rec: any; try { rec = JSON.parse(line); } catch { continue; }
    if (client === 'codex' && rec?.type === 'session_meta' && rec.payload?.session_id && rec.payload?.cwd)
      return { sessionId: String(rec.payload.session_id), cwd: String(rec.payload.cwd) };
    if (client === 'claude' && rec?.sessionId && rec?.cwd) return { sessionId: String(rec.sessionId), cwd: String(rec.cwd) };
  }
  return null;
}
