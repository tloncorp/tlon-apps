// src/sync.ts
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { Config } from './config';
import { ClientId, ParsedTranscript } from './events';
import { appendLog } from './log';
import { NotesClient, NotesError } from './notes-client';
import { Paths } from './paths';
import { renderConversation, sessionKey } from './render';
import { QueueJob, SessionState, listJobs, loadSessionState, removeJob, saveJob, saveSessionState } from './state';
import { parseClaudeTranscript } from './transcript/claude';
import { parseCodexTranscript } from './transcript/codex';
import { loadConnection, saveConnection } from './status';

export { loadSessionState } from './state';

export const clientId = (c: 'claude' | 'codex'): ClientId => (c === 'claude' ? 'claude-code' : 'codex');

export function enqueue(p: Paths, j: Omit<QueueJob, 'enqueuedAt' | 'attempts'>) {
  saveJob(p, { ...j, enqueuedAt: new Date().toISOString(), attempts: 0 });
}

export function parseTranscript(client: 'claude' | 'codex', path: string, toolIo: boolean): ParsedTranscript {
  if (!existsSync(path)) throw new Error(`transcript not found: ${path}`);
  return client === 'claude' ? parseClaudeTranscript(path, { toolIo }) : parseCodexTranscript(path, { toolIo });
}

const sha = (parts: string[]) => createHash('sha256').update(parts.join('\u0000')).digest('hex');

/** Upsert one session's conversation note(s). Idempotent: same content → no HTTP; known ids → PUT; lost ids → recovered by session_key search. */
export async function syncSession(p: Paths, cfg: Config, c: NotesClient, t: ParsedTranscript): Promise<'created' | 'updated' | 'unchanged'> {
  const nb = cfg.notebook!;
  const parts = renderConversation(t);
  const hash = sha(parts.map((x) => x.body));
  let st = loadSessionState(p, t.client, t.sessionId);
  if (st && st.contentHash === hash && st.noteIds.length === parts.length) return 'unchanged';
  if (!st) {
    // recover notes that carry our session_key (e.g. state dir lost)
    const found = (await c.searchText(nb.host, nb.name, `session_key: ${sessionKey(t)}`, 50))
      .filter((n) => n.folderId === nb.conversationsFolderId)
      .sort((a, b) => a.id - b.id);
    st = { client: t.client, sessionId: t.sessionId, cwd: t.cwd, title: parts[0].title,
      noteIds: found.map((n) => n.id), revisions: found.map((n) => n.revision), contentHash: '', eventCount: 0, lastSynced: '' };
  }
  let result: 'created' | 'updated' = st.noteIds.length ? 'updated' : 'created';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (st.noteIds[i] !== undefined) {
      let r = await c.updateNote(nb.host, nb.name, st.noteIds[i], part.body, st.revisions[i]);
      if (r.kind === 'conflict') { // someone edited the note on the ship: we are the source of truth for the archive, overwrite
        const cur = await c.getNote(nb.host, nb.name, st.noteIds[i]);
        r = await c.updateNote(nb.host, nb.name, st.noteIds[i], part.body, cur.revision);
      }
      if (r.kind === 'updated') st.revisions[i] = r.revision;
      if (r.kind === 'conflict') throw new NotesError('conflict', `note ${st.noteIds[i]} keeps conflicting`);
    } else {
      const n = await c.createNote(nb.host, nb.name, nb.conversationsFolderId, part.title, part.body);
      st.noteIds[i] = n.id; st.revisions[i] = n.revision;
    }
  }
  // extra parts from an earlier, longer render (should not happen; transcripts only grow) are left in place
  st.contentHash = hash; st.eventCount = t.events.length; st.lastSynced = new Date().toISOString(); st.title = parts[0].title; st.cwd = t.cwd;
  saveSessionState(p, st);
  return result;
}

export interface SyncReport { synced: number; failed: number; remaining: number; keyRejected: boolean; lastError?: string }

const BACKOFF_MS = [0, 30_000, 120_000, 600_000, 3_600_000];

/** Drain the queue within a time budget. Never throws. */
export async function syncQueue(p: Paths, cfg: Config, o: { budgetMs: number; now?: () => number } = { budgetMs: 15_000 }): Promise<SyncReport> {
  const now = o.now ?? Date.now; const start = now();
  const rep: SyncReport = { synced: 0, failed: 0, remaining: 0, keyRejected: false };
  const c = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey });
  const jobs = listJobs(p);
  for (const job of jobs) {
    if (now() - start >= o.budgetMs) { rep.remaining++; continue; }
    if (job.nextAttemptAt && new Date(job.nextAttemptAt).getTime() > now()) { rep.remaining++; continue; }
    if (rep.keyRejected) { rep.remaining++; continue; }
    try {
      const t = parseTranscript(job.client, job.transcriptPath, cfg.captureToolIo);
      if (!t.sessionId) throw new Error('transcript has no session id');
      const r = await syncSession(p, cfg, c, t);
      removeJob(p, job); rep.synced++;
      appendLog(p, 'sync', { client: job.client, session: t.sessionId, count: t.events.length, event: r });
    } catch (e) {
      const err = e as Error; rep.failed++; rep.remaining++; rep.lastError = err.message;
      job.attempts++; job.lastError = err.message.slice(0, 200);
      job.nextAttemptAt = new Date(now() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]).toISOString();
      saveJob(p, job);
      if (e instanceof NotesError && e.code === 'key-rejected') rep.keyRejected = true;
      appendLog(p, 'sync-error', { client: job.client, session: job.sessionId, error: err.message, status: e instanceof NotesError ? e.status : undefined });
    }
  }
  const state = rep.keyRejected ? 'key-rejected' : rep.failed && !rep.synced ? 'unreachable' : 'ok';
  const prev = loadConnection(p);
  if (prev.state !== state || rep.lastError !== prev.lastError) saveConnection(p, { state, lastError: rep.lastError, checkedAt: new Date().toISOString() });
  return rep;
}
