// src/state.ts
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Paths, writePrivate } from './paths';
import { ClientId } from './events';

export interface SessionState {
  client: ClientId; sessionId: string; cwd: string; title: string;
  noteIds: number[];            // one per part, in order
  revisions: number[];          // last known revision per part
  contentHash: string;          // sha256 of all rendered parts
  eventCount: number; lastSynced: string;
}

export interface QueueJob { client: 'claude' | 'codex'; sessionId: string; transcriptPath: string; cwd: string;
  enqueuedAt: string; attempts: number; lastError?: string; nextAttemptAt?: string }

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_');
export const stateFile = (p: Paths, client: ClientId, sessionId: string) => join(p.stateDir, `${client}-${safe(sessionId)}.json`);

export function loadSessionState(p: Paths, client: ClientId, sessionId: string): SessionState | null {
  const f = stateFile(p, client, sessionId);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}
export function saveSessionState(p: Paths, s: SessionState) { p.ensure(); writePrivate(stateFile(p, s.client, s.sessionId), JSON.stringify(s, null, 2)); }
export function deleteSessionState(p: Paths, client: ClientId, sessionId: string) { const f = stateFile(p, client, sessionId); if (existsSync(f)) unlinkSync(f); }
export function listSessionStates(p: Paths): SessionState[] {
  if (!existsSync(p.stateDir)) return [];
  return readdirSync(p.stateDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(p.stateDir, f), 'utf8')));
}

export const queueFile = (p: Paths, j: Pick<QueueJob, 'client' | 'sessionId'>) => join(p.queueDir, `${j.client}-${safe(j.sessionId)}.json`);
export function saveJob(p: Paths, j: QueueJob) { p.ensure(); writePrivate(queueFile(p, j), JSON.stringify(j, null, 2)); }
export function removeJob(p: Paths, j: QueueJob) { const f = queueFile(p, j); if (existsSync(f)) unlinkSync(f); }
export function listJobs(p: Paths): QueueJob[] {
  if (!existsSync(p.queueDir)) return [];
  return readdirSync(p.queueDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(p.queueDir, f), 'utf8')))
    .sort((a: QueueJob, b: QueueJob) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}
