// src/state.ts
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Paths, writePrivate } from './paths';
import { ClientId } from './events';
import { appendLog } from './log';

export interface SessionState {
  client: ClientId; sessionId: string; cwd: string; title: string;
  noteIds: number[];            // one per part, in order
  revisions: number[];          // last known revision per part
  anchors?: [string, string][]; // [first, last] event anchor per part
  contentHash: string;          // sha256 of all rendered parts
  eventCount: number; lastSynced: string;
}

export interface QueueJob { client: 'claude' | 'codex'; sessionId: string; transcriptPath: string; cwd: string;
  enqueuedAt: string; attempts: number; lastError?: string; nextAttemptAt?: string }

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');
const SESSION_FILE = /^(claude-code|codex)-.+\.json$/;
export const stateFile = (p: Paths, client: ClientId, sessionId: string) => join(p.stateDir, `${client}-${safe(sessionId)}.json`);

/** Parse a JSON file; an unreadable one is logged and skipped so one bad file cannot stop the hook or the queue. */
function readJson<T>(p: Paths, f: string): T | null {
  try { return JSON.parse(readFileSync(f, 'utf8')) as T; }
  catch (e) { appendLog(p, 'state-unreadable', { note: f, error: (e as Error).message }); return null; }
}

export function loadSessionState(p: Paths, client: ClientId, sessionId: string): SessionState | null {
  const f = stateFile(p, client, sessionId);
  return existsSync(f) ? readJson<SessionState>(p, f) : null;
}
export function saveSessionState(p: Paths, s: SessionState) { p.ensure(); writePrivate(stateFile(p, s.client, s.sessionId), JSON.stringify(s, null, 2)); }
export function deleteSessionState(p: Paths, client: ClientId, sessionId: string) { const f = stateFile(p, client, sessionId); if (existsSync(f)) unlinkSync(f); }
export function listSessionStates(p: Paths): SessionState[] {
  if (!existsSync(p.stateDir)) return [];
  return readdirSync(p.stateDir).filter((f) => SESSION_FILE.test(f))
    .map((f) => readJson<SessionState>(p, join(p.stateDir, f))).filter((s): s is SessionState => s !== null);
}

export const isInitialized = (p: Paths) => existsSync(p.initializedMarker);
export function markInitialized(p: Paths) { p.ensure(); if (!isInitialized(p)) writeFileSync(p.initializedMarker, new Date().toISOString() + '\n', { mode: 0o600 }); }

export const queueFile = (p: Paths, j: Pick<QueueJob, 'client' | 'sessionId'>) => join(p.queueDir, `${j.client}-${safe(j.sessionId)}.json`);
export function saveJob(p: Paths, j: QueueJob) { p.ensure(); writePrivate(queueFile(p, j), JSON.stringify(j, null, 2)); }
/** Remove a finished job unless the hook re-enqueued it (new enqueuedAt) while it was being synced. */
export function removeJob(p: Paths, j: QueueJob): boolean {
  const f = queueFile(p, j);
  if (!existsSync(f)) return false;
  const cur = readJson<QueueJob>(p, f);
  if (cur && cur.enqueuedAt !== j.enqueuedAt) return false;
  unlinkSync(f);
  return true;
}
export function listJobs(p: Paths): QueueJob[] {
  if (!existsSync(p.queueDir)) return [];
  return readdirSync(p.queueDir).filter((f) => f.endsWith('.json'))
    .map((f) => readJson<QueueJob>(p, join(p.queueDir, f)))
    .filter((j): j is QueueJob => j !== null && typeof j.enqueuedAt === 'string')
    .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}
