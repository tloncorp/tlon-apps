// src/sync.ts
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { Config } from './config';
import { ClientId, ParsedTranscript } from './events';
import { appendLog } from './log';
import { findSessionNotes } from './notebook';
import { DEADLINE_EXCEEDED, NotesClient, NotesError, isDeadline } from './notes-client';
import { Paths } from './paths';
import { renderConversation, sessionKey } from './render';
import { QueueJob, SessionState, isInitialized, listJobs, loadSessionState, markInitialized, removeJob, replaceJob, saveJob, saveSessionState } from './state';
import { loadConnection, saveConnection } from './status';
import { parseClaudeTranscript } from './transcript/claude';
import { parseCodexTranscript } from './transcript/codex';

export { loadSessionState } from './state';

export const clientId = (c: 'claude' | 'codex'): ClientId => (c === 'claude' ? 'claude-code' : 'codex');

export function enqueue(p: Paths, j: Omit<QueueJob, 'enqueuedAt' | 'attempts'>) {
  saveJob(p, { ...j, enqueuedAt: new Date().toISOString(), attempts: 0 });
}

export function parseTranscript(client: 'claude' | 'codex', path: string, toolIo: boolean, known: string[] = []): ParsedTranscript {
  return client === 'claude' ? parseClaudeTranscript(path, { toolIo, known }) : parseCodexTranscript(path, { toolIo, known });
}

/** Minimum budget left to start a note create. */
export const CREATE_MARGIN_MS = 5_000;
const sha = (parts: string[]) => createHash('sha256').update(parts.join('\u0000')).digest('hex');
const isCode = (e: unknown, code: NotesError['code']) => e instanceof NotesError && e.code === code;

/*
 * Cost model: a sync of a known session sends one PUT per changed part and nothing for an unchanged one.
 * The ship is searched (a scan of the notebook) only to recover lost local state, which the absence of
 * state/.initialized signals, and before creating a second or later part. A new session on an
 * initialized machine is created without searching.
 */

/** Upsert one session's conversation note(s). Idempotent: same content → no HTTP; known ids → PUT; lost ids → recovered by exact session_key. */
export async function syncSession(p: Paths, cfg: Config, c: NotesClient, t: ParsedTranscript,
  o: { recover?: boolean } = {}): Promise<'created' | 'updated' | 'unchanged'> {
  const nb = cfg.notebook!;
  const key = sessionKey(t);
  const parts = renderConversation(t);
  const hashes = parts.map((x) => sha([x.body]));
  const hash = sha(parts.map((x) => x.body));
  let st = loadSessionState(p, t.client, t.sessionId);
  if (st && st.contentHash === hash && st.noteIds.length === parts.length) return 'unchanged';
  if (!st) {
    st = { client: t.client, sessionId: t.sessionId, cwd: t.cwd, title: parts[0].title,
      noteIds: [], revisions: [], hashes: [], anchors: [], contentHash: '', eventCount: 0, lastSynced: '' };
    if (o.recover) for (const n of await findSessionNotes(c, nb, key)) { st.noteIds[n.part - 1] = n.id; st.revisions[n.part - 1] = n.revision; }
  }
  const s = st;
  s.hashes ??= []; s.anchors ??= [];
  const result: 'created' | 'updated' = s.noteIds.some((id) => id != null) ? 'updated' : 'created';

  const create = async (i: number) => {
    const part = parts[i];
    if (i > 0 || s.creating !== undefined) {
      // A create whose answer was lost (killed run, dropped connection), or a concurrent run, may already have made this part.
      const existing = (await findSessionNotes(c, nb, key)).find((n) => n.part === i + 1);
      if (existing) { s.noteIds[i] = existing.id; s.revisions[i] = existing.revision; delete s.creating; saveSessionState(p, s); return false; }
    }
    // A create cut off by the deadline may still land on the ship; with under CREATE_MARGIN_MS left, leave it to the next run.
    if (c.deadline !== undefined && c.deadline - Date.now() < CREATE_MARGIN_MS) throw new NotesError('unreachable', DEADLINE_EXCEEDED);
    s.creating = i; saveSessionState(p, s); // persisted first: if the answer is lost, the next run searches before creating
    const n = await c.createNote(nb.host, nb.name, nb.conversationsFolderId, part.title, part.body);
    s.noteIds[i] = n.id; s.revisions[i] = n.revision; s.hashes![i] = hashes[i]; delete s.creating;
    saveSessionState(p, s); // persisted at once so a later kill cannot make this part twice
    return true;
  };
  const update = async (i: number) => {
    const id = s.noteIds[i], body = parts[i].body;
    let r = await c.updateNote(nb.host, nb.name, id, body, s.revisions[i]);
    if (r.kind === 'conflict') { // someone edited the note on the ship: we are the source of truth for the archive, overwrite
      const cur = await c.getNote(nb.host, nb.name, id);
      r = await c.updateNote(nb.host, nb.name, id, body, cur.revision);
    }
    if (r.kind === 'conflict') throw new NotesError('conflict', `note ${id} keeps conflicting`);
    if (r.kind === 'updated') s.revisions[i] = r.revision;
    s.hashes![i] = hashes[i];
  };

  for (let i = 0; i < parts.length; i++) {
    s.anchors[i] = [parts[i].firstAnchor, parts[i].lastAnchor];
    if (s.noteIds[i] == null) { if (!(await create(i))) await update(i); continue; }
    if (s.hashes[i] === hashes[i]) continue;
    try { await update(i); }
    catch (e) {
      if (!isCode(e, 'not-found')) throw e;
      appendLog(p, 'sync-recreate', { client: t.client, session: t.sessionId, note: s.noteIds[i] });
      delete s.noteIds[i]; delete s.revisions[i]; delete s.hashes[i];
      if (!(await create(i))) await update(i);
    }
  }
  // A shorter render than before (e.g. tool I/O turned off): remove the surplus parts so state matches the ship.
  while (s.noteIds.length > parts.length) {
    const id = s.noteIds[s.noteIds.length - 1];
    if (id != null) await c.deleteNote(nb.host, nb.name, id).catch((e) => { if (!isCode(e, 'not-found')) throw e; });
    s.noteIds.pop(); s.revisions.length = s.noteIds.length; s.hashes.length = s.noteIds.length; s.anchors.length = s.noteIds.length;
    saveSessionState(p, s);
  }
  s.contentHash = hash; s.eventCount = t.events.length; s.lastSynced = new Date().toISOString(); s.title = parts[0].title; s.cwd = t.cwd;
  saveSessionState(p, s);
  return result;
}

export interface SyncReport { synced: number; failed: number; remaining: number; keyRejected: boolean; locked?: boolean; lastError?: string }

const BACKOFF_MS = [0, 30_000, 120_000, 600_000, 3_600_000]; // the last delay (1 h) repeats
/** Deterministic failures before a job is dropped. Transient ones (ship unreachable, key rejected) never drop it. */
export const MAX_ATTEMPTS = 8;
/** A ship that is down or a rejected key: retry forever with backoff, the job is not at fault. */
const isTransient = (e: unknown) => isCode(e, 'unreachable') || isCode(e, 'key-rejected');
const LOCK_STALE_MS = 60_000;

/** Exclusive queue lock; one older than LOCK_STALE_MS belongs to a dead or stuck run and is replaced. */
function acquireLock(p: Paths): boolean {
  p.ensure();
  const take = () => {
    const fd = openSync(p.queueLock, 'wx', 0o600);
    try { writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); } finally { closeSync(fd); }
  };
  try { take(); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  let takenAt: number;
  try {
    const at = Date.parse(JSON.parse(readFileSync(p.queueLock, 'utf8')).at);
    takenAt = Number.isFinite(at) ? at : statSync(p.queueLock).mtimeMs;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return tryTake(take);
    takenAt = statSync(p.queueLock).mtimeMs; // unreadable contents: fall back to the file's age
  }
  if (Date.now() - takenAt < LOCK_STALE_MS) return false;
  try { unlinkSync(p.queueLock); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  return tryTake(take);
}
function tryTake(take: () => void): boolean {
  try { take(); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false; throw e; }
}
/** Keep a long `tlon-memory sync` run from looking stale to a hook. */
function refreshLock(p: Paths) {
  writeFileSync(p.queueLock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { mode: 0o600 });
}
function releaseLock(p: Paths) {
  try { unlinkSync(p.queueLock); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
}

/** Drain the queue within a time budget. Network and transcript errors are recorded on the job, not thrown. */
export async function syncQueue(p: Paths, cfg: Config,
  o: { budgetMs: number; now?: () => number; ignoreBackoff?: boolean } = { budgetMs: 15_000 }): Promise<SyncReport> {
  const now = o.now ?? Date.now; const start = now();
  const rep: SyncReport = { synced: 0, failed: 0, remaining: 0, keyRejected: false };
  if (!acquireLock(p)) { rep.remaining = listJobs(p).length; rep.locked = true; return rep; }
  try {
    const recover = !isInitialized(p);
    const c = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey, deadline: Date.now() + o.budgetMs });
    let attempted = 0, reachedShip = false, netError: NotesError | undefined;
    for (const job of listJobs(p)) {
      if (now() - start >= o.budgetMs || rep.keyRejected) { rep.remaining++; continue; }
      if (!o.ignoreBackoff && job.nextAttemptAt && new Date(job.nextAttemptAt).getTime() > now()) { rep.remaining++; continue; }
      attempted++;
      try {
        const t = parseTranscript(job.client, job.transcriptPath, cfg.captureToolIo, [cfg.apiKey]);
        if (!t.sessionId) throw new Error('transcript has no session id');
        const r = await syncSession(p, cfg, c, t, { recover });
        if (r !== 'unchanged') reachedShip = true;
        removeJob(p, job); rep.synced++;
        appendLog(p, 'sync', { client: job.client, session: t.sessionId, count: t.events.length, event: r });
      } catch (e) {
        const err = e as Error;
        if (isDeadline(e)) { rep.remaining++; continue; } // out of time, not a failure: retry next run without backoff
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') { // transcript gone: nothing left to upload
          removeJob(p, job);
          appendLog(p, 'sync-drop', { client: job.client, session: job.sessionId, error: err.message });
          continue;
        }
        rep.failed++; rep.lastError = err.message;
        if (isCode(e, 'key-rejected')) rep.keyRejected = true;
        if (isCode(e, 'key-rejected') || isCode(e, 'unreachable')) netError = e as NotesError;
        job.attempts++; job.lastError = err.message.slice(0, 200);
        if (!isTransient(e)) job.hardFailures = (job.hardFailures ?? 0) + 1;
        if ((job.hardFailures ?? 0) >= MAX_ATTEMPTS) {
          removeJob(p, job);
          appendLog(p, 'sync-giveup', { client: job.client, session: job.sessionId, count: job.attempts, error: err.message });
        } else {
          rep.remaining++;
          job.nextAttemptAt = new Date(now() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]).toISOString();
          replaceJob(p, job);
        }
        appendLog(p, 'sync-error', { client: job.client, session: job.sessionId, error: err.message, status: e instanceof NotesError ? e.status : undefined });
      }
      refreshLock(p);
    }
    if (attempted > 0) {
      const state = rep.keyRejected ? 'key-rejected' : netError ? 'unreachable' : reachedShip ? 'ok' : undefined;
      const prev = loadConnection(p);
      if (state && (prev.state !== state || prev.lastError !== netError?.message))
        saveConnection(p, { state, ...(netError ? { lastError: netError.message } : {}), checkedAt: new Date().toISOString() });
    }
    if (recover && rep.remaining === 0) markInitialized(p);
    return rep;
  } finally { releaseLock(p); }
}
