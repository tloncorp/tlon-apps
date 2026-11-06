// tests/sync.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { defaultConfig, saveConfig, Config } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { enqueue, syncQueue, loadSessionState } from '../src/sync';

const fake = new FakeNotes();
let paths: Paths; let cfg: Config; let fx: string;
beforeAll(async () => {
  fake.start();
  const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'],
    notebook: await ensureNotebook(c, 'Agent Memory') };
});
afterAll(() => fake.stop());
beforeEach(() => {
  paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-sync-'))); saveConfig(paths, cfg);
  fx = join(paths.root, 'claude.jsonl');
  copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
});

describe('sync', () => {
  it('uploads once, then updates in place; identical reruns are no-ops', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    expect(readdirSync(paths.queueDir).length).toBe(1);
    const r1 = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r1).toMatchObject({ synced: 1, failed: 0, remaining: 0 });
    expect(fake.notes.size).toBe(1);
    const st = loadSessionState(paths, 'claude-code', '11111111-aaaa-4bbb-8ccc-222222222222')!;
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
    const n = fake.notes.size;
    const { rmSync } = await import('node:fs'); rmSync(paths.stateDir, { recursive: true });
    appendFileSync(fx, '\n{"type":"user","uuid":"u9","parentUuid":"a2","isSidechain":false,"sessionId":"11111111-aaaa-4bbb-8ccc-222222222222","cwd":"/x","timestamp":"2026-11-05T14:10:00.000Z","message":{"role":"user","content":"again"}}\n');
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(fake.notes.size).toBe(n); // updated, not duplicated
  });
  it('keeps the job queued on transient failure and surfaces key rejection', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    fake.failNext = 503;
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ synced: 0, failed: 1, remaining: 1 });
    expect(r.lastError).toContain('503');
    const bad = { ...cfg, apiKey: 'wrong' };
    const r2 = await syncQueue(paths, bad, { budgetMs: 10_000 });
    expect(r2.keyRejected).toBe(true);
    expect(r2.remaining).toBe(1);
  });
  it('respects the time budget', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's1', transcriptPath: fx, cwd: '/x' });
    const r = await syncQueue(paths, cfg, { budgetMs: 0 });
    expect(r.remaining).toBe(1);
  });
  it('skips Codex sessions whose transcript is missing without crashing', async () => {
    enqueue(paths, { client: 'codex', sessionId: 'gone', transcriptPath: '/nope.jsonl', cwd: '/x' });
    const r = await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect(r).toMatchObject({ synced: 0, failed: 1 });
    expect(r.lastError).toContain('transcript');
  });
});
