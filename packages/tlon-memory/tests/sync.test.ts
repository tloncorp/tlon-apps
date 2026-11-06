// tests/sync.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync, appendFileSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { defaultConfig, saveConfig, Config } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { enqueue, syncQueue, syncSession, loadSessionState, MAX_ATTEMPTS } from '../src/sync';
import { listJobs, markInitialized, saveJob, saveSessionState } from '../src/state';
import { loadConnection } from '../src/status';
import { parseClaudeTranscript } from '../src/transcript/claude';

const SID = '11111111-aaaa-4bbb-8ccc-222222222222';
const fake = new FakeNotes();
let paths: Paths; let cfg: Config; let fx: string;
const jobs = () => readdirSync(paths.queueDir).filter((f) => f.endsWith('.json'));
const line = (uuid: string, ts: string, text: string, extra = '') =>
  `\n{"type":"user","uuid":"${uuid}","isSidechain":false,"sessionId":"${SID}","cwd":"/x","timestamp":"${ts}","message":{"role":"user","content":${JSON.stringify(text)}}${extra}}\n`;
beforeAll(async () => {
  fake.start();
  const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'],
    notebook: await ensureNotebook(c, 'Agent Memory') };
});
afterAll(() => fake.stop());
beforeEach(() => {
  fake.notes.clear(); fake.requests = [];
  paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-sync-'))); saveConfig(paths, cfg);
  fx = join(paths.root, 'claude.jsonl');
  copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
});

describe('sync', () => {
  it('uploads once, then updates in place; identical reruns are no-ops', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    expect(jobs().length).toBe(1);
    const r1 = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r1).toMatchObject({ synced: 1, failed: 0, remaining: 0 });
    expect(fake.notes.size).toBe(1);
    const st = loadSessionState(paths, 'claude-code', SID)!;
    expect(st.noteIds.length).toBe(1);
    const before = fake.requests.length;
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.notes.size).toBe(1);
    expect(fake.requests.length).toBe(before); // hash short-circuit: no HTTP at all
    appendFileSync(fx, '\n{"type":"assistant","uuid":"a9","parentUuid":"a2","isSidechain":false,"sessionId":"11111111-aaaa-4bbb-8ccc-222222222222","cwd":"/Users/bill/Projects/demo","timestamp":"2026-11-05T14:09:00.000Z","message":{"role":"assistant","content":[{"type":"text","text":"more"}]}}\n');
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.notes.size).toBe(1);
    expect([...fake.notes.values()][0].bodyMd).toContain('## e9 · assistant');
    expect([...fake.notes.values()][0].revision).toBe(2);
  });
  it('recovers the note id by session key when local state is lost', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    const original = loadSessionState(paths, 'claude-code', SID)!.noteIds[0];
    rmSync(paths.stateDir, { recursive: true });
    appendFileSync(fx, line('u9', '2026-11-05T14:10:00.000Z', 'again'));
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.notes.size).toBe(1); // updated, not duplicated
    expect(loadSessionState(paths, 'claude-code', SID)!.noteIds[0]).toBe(original);
    expect(fake.notes.get(original)!.bodyMd).toContain('again');
  });
  it('recovery ignores notes whose session key only starts with ours', async () => {
    const nb = cfg.notebook!;
    fake.notes.set(1, { id: 1, notebookId: [...fake.notebooks.values()][0].id, folderId: nb.conversationsFolderId, title: 'other', slug: null,
      bodyMd: `---\ntlon-memory: conversation/v1\nsession_key: claude-code:${SID}-longer\npart: 1/1\n---\n`, createdBy: '~zod', createdAt: 1, updatedBy: '~zod', updatedAt: 1, revision: 1 });
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.notes.get(1)!.bodyMd).not.toContain('## e1');
    expect(loadSessionState(paths, 'claude-code', SID)!.noteIds[0]).not.toBe(1);
  });
  it('an initialized state dir creates new sessions without searching', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 }); // first run: searches, then marks initialized
    expect(existsSync(paths.initializedMarker)).toBe(true);
    const codex = join(paths.root, 'codex.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'codex-rollout.jsonl'), codex);
    fake.requests = [];
    enqueue(paths, { client: 'codex', sessionId: 'c1', transcriptPath: codex, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.requests.map((r) => r.method + ' ' + r.path.split('?')[0]).some((r) => r.includes('/search/'))).toBe(false);
    expect(fake.notes.size).toBe(2);
  });
  it('keeps the job queued on transient failure and surfaces key rejection', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    fake.failNext = 503;
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ synced: 0, failed: 1, remaining: 1 });
    expect(r.lastError).toContain('503');
    expect(loadConnection(paths).state).toBe('unreachable');
    const job = listJobs(paths)[0]; saveJob(paths, { ...job, nextAttemptAt: undefined });
    const bad = { ...cfg, apiKey: 'wrong' };
    const r2 = await syncQueue(paths, bad, { budgetMs: 10_000 });
    expect(r2.keyRejected).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(loadConnection(paths).state).toBe('key-rejected');
    saveJob(paths, { ...listJobs(paths)[0], nextAttemptAt: undefined });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(loadConnection(paths).state).toBe('ok');
  });
  it('leaves the connection file alone when nothing was attempted', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 0 });
    expect(existsSync(paths.connectionFile)).toBe(false);
  });
  it('respects the time budget', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    const r = await syncQueue(paths, cfg, { budgetMs: 0 });
    expect(r.remaining).toBe(1);
  });
  it('drops a job whose transcript is gone, with a log line', async () => {
    enqueue(paths, { client: 'codex', sessionId: 'gone', transcriptPath: join(paths.root, 'nope.jsonl'), cwd: '/x' });
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ synced: 0, failed: 0, remaining: 0 });
    expect(jobs().length).toBe(0);
    expect(readFileSync(paths.logFile, 'utf8')).toContain('sync-drop');
  });
  it('gives up on a job after the attempt limit', async () => {
    writeFileSync(fx, line('u1', '2026-11-05T14:00:00.000Z', 'hi').replace(SID, '')); // no session id: a permanent failure
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    saveJob(paths, { ...listJobs(paths)[0], attempts: MAX_ATTEMPTS - 1, hardFailures: MAX_ATTEMPTS - 1 });
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ failed: 1, remaining: 0 });
    expect(jobs().length).toBe(0);
    expect(readFileSync(paths.logFile, 'utf8')).toContain('sync-giveup');
  });
  it('never gives up on a job that keeps failing with a transient error, and caps its backoff at 1 h', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    let t = Date.now();
    for (let i = 0; i < 9; i++) {
      fake.failNext = 503;
      const r = await syncQueue(paths, cfg, { budgetMs: 10_000, now: () => t });
      expect(r).toMatchObject({ failed: 1, remaining: 1 });
      const job = listJobs(paths)[0];
      expect(job.attempts).toBe(i + 1);
      expect(job.hardFailures ?? 0).toBe(0);
      expect(Date.parse(job.nextAttemptAt!) - t).toBeLessThanOrEqual(3_600_000);
      t = Date.parse(job.nextAttemptAt!) + 1; // the next run is due
    }
    expect(jobs().length).toBe(1);
    expect(readFileSync(paths.logFile, 'utf8')).not.toContain('sync-giveup');
  });
  it('ignoreBackoff runs a job whose next attempt is not due yet', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    fake.failNext = 503;
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    saveJob(paths, { ...listJobs(paths)[0], nextAttemptAt: new Date(Date.now() + 600_000).toISOString() }); // as after a few failures
    expect(await syncQueue(paths, cfg, { budgetMs: 10_000 })).toMatchObject({ synced: 0, remaining: 1 }); // backing off
    expect(await syncQueue(paths, cfg, { budgetMs: 10_000, ignoreBackoff: true })).toMatchObject({ synced: 1, remaining: 0 });
    expect(jobs().length).toBe(0);
  });
  it('a create the ship applied but whose response was lost is not duplicated on the next run', async () => {
    const t = parseClaudeTranscript(fx);
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    markInitialized(paths); // an initialized device would otherwise create without searching
    fake.dropResponseOnce = true;
    await expect(syncSession(paths, cfg, c, t)).rejects.toBeDefined();
    expect(fake.notes.size).toBe(1);
    expect(loadSessionState(paths, 'claude-code', SID)!.creating).toBe(0);
    expect(await syncSession(paths, cfg, c, t)).toBe('created');
    expect(fake.notes.size).toBe(1);
    const st = loadSessionState(paths, 'claude-code', SID)!;
    expect(st.noteIds[0]).toBe([...fake.notes.keys()][0]);
    expect(st.creating).toBeUndefined();
  });
  it('does not start a create with less than 5 s of budget left', async () => {
    const t = parseClaudeTranscript(fx);
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key', deadline: Date.now() + 4_000 });
    markInitialized(paths);
    await expect(syncSession(paths, cfg, c, t)).rejects.toMatchObject({ code: 'unreachable', message: 'deadline exceeded' });
    expect(fake.notes.size).toBe(0);
  });
  it('recreates a part whose note was deleted on the ship', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    const old = loadSessionState(paths, 'claude-code', SID)!.noteIds[0];
    fake.notes.delete(old);
    appendFileSync(fx, line('u9', '2026-11-05T14:10:00.000Z', 'after delete'));
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ synced: 1, failed: 0 });
    const now = loadSessionState(paths, 'claude-code', SID)!.noteIds[0];
    expect(now).not.toBe(old);
    expect(fake.notes.get(now)!.bodyMd).toContain('after delete');
  });
  it('concurrent runs on one queue make exactly one note and remove the job once', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    const [a, b] = await Promise.all([syncQueue(paths, cfg, { budgetMs: 10_000 }), syncQueue(paths, cfg, { budgetMs: 10_000 })]);
    expect(fake.notes.size).toBe(1);
    expect(a.synced + b.synced).toBe(1);
    expect([a.locked, b.locked].filter(Boolean).length).toBe(1);
    expect((a.locked ? a : b).remaining).toBe(1);
    expect(jobs().length).toBe(0);
    expect(existsSync(paths.queueLock)).toBe(false);
  });
  it('replaces a stale lock', async () => {
    paths.ensure();
    writeFileSync(paths.queueLock, JSON.stringify({ pid: 1, at: new Date(Date.now() - 120_000).toISOString() }));
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    expect((await syncQueue(paths, cfg, { budgetMs: 10_000 })).synced).toBe(1);
  });
  it('a job re-enqueued while it was being synced survives', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    // stand in for the hook: re-enqueue the same session while the first job is in flight
    const orig = fake.handle.bind(fake); let once = true;
    fake.handle = async (req: Request) => {
      if (once && req.method === 'POST') { once = false; await new Promise((r) => setTimeout(r, 5)); enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' }); }
      return orig(req);
    };
    try { await syncQueue(paths, cfg, { budgetMs: 10_000 }); } finally { fake.handle = orig; }
    expect(jobs().length).toBe(1);
  });
  it('deletes surplus parts when a render shrinks, so the next run short-circuits', async () => {
    const t = parseClaudeTranscript(fx);
    const big = { ...t, events: Array.from({ length: 400 }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: 'x'.repeat(1000) })) };
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    await syncSession(paths, cfg, c, big);
    const st = loadSessionState(paths, 'claude-code', SID)!;
    expect(st.noteIds.length).toBeGreaterThan(2);
    expect(await syncSession(paths, cfg, c, t)).toBe('updated');
    const after = loadSessionState(paths, 'claude-code', SID)!;
    expect(after.noteIds).toEqual([st.noteIds[0]]);
    expect(fake.notes.size).toBe(1);
    expect(await syncSession(paths, cfg, c, t)).toBe('unchanged');
  });
  it('a growing multi-part session rewrites only the parts that changed', async () => {
    const t = parseClaudeTranscript(fx);
    const mk = (n: number) => ({ ...t, events: Array.from({ length: n }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: 'x'.repeat(1000) })) });
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    await syncSession(paths, cfg, c, mk(400));
    const ids = loadSessionState(paths, 'claude-code', SID)!.noteIds;
    expect(ids.length).toBe(3);
    fake.requests = [];
    await syncSession(paths, cfg, c, mk(401));
    const puts = fake.requests.filter((r) => r.method === 'PUT').map((r) => Number(r.path.split('/').pop()));
    expect(puts.sort()).toEqual([ids[0], ids[2]].sort()); // part 1 (totals) and the last part
  });
  it('saves state after each created part, and reuses a part found on the ship', async () => {
    const t = parseClaudeTranscript(fx);
    const big = { ...t, events: Array.from({ length: 400 }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: 'x'.repeat(1000) })) };
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    fake.failNextOn = null;
    // kill the run on the third create: parts 1 and 2 exist and must be in local state
    let creates = 0; const orig = fake.handle.bind(fake);
    fake.handle = async (req: Request) => { if (req.method === 'POST' && ++creates === 3) return new Response('down', { status: 503 }); return orig(req); };
    try { await expect(syncSession(paths, cfg, c, big)).rejects.toMatchObject({ code: 'unreachable' }); } finally { fake.handle = orig; }
    const st = loadSessionState(paths, 'claude-code', SID)!;
    expect(st.noteIds.filter((x) => x != null).length).toBe(2);
    // lose part 2 from local state: the next run must find it on the ship instead of creating it again
    saveSessionState(paths, { ...st, noteIds: [st.noteIds[0]], revisions: [st.revisions[0]], hashes: [st.hashes![0]] });
    await syncSession(paths, cfg, c, big);
    expect(fake.notes.size).toBe(3);
    expect(loadSessionState(paths, 'claude-code', SID)!.noteIds[1]).toBe(st.noteIds[1]);
  });
});
