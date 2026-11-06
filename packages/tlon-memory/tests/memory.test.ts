// tests/memory.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { MemoryStore } from '../src/memory';
import { enqueue, syncQueue } from '../src/sync';

const fake = new FakeNotes(); let paths: Paths; let cfg: Config; let store: MemoryStore;
beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory') }; });
afterAll(() => fake.stop());
beforeEach(() => { paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-mem-'))); saveConfig(paths, cfg); fake.notes.clear(); store = new MemoryStore(paths, cfg); });

describe('MemoryStore', () => {
  it('saves a memory with provenance and dedupes identical text per project', async () => {
    const a = await store.save({ type: 'decision', text: 'Use SQLite for the local queue.', agent: 'claude-code', project: 'demo', sessionKey: 'claude-code:1111', event: 'e2' });
    expect(a.id).toBeGreaterThan(0);
    expect(a.url).toBe(`${fake.url}/notes/nb/~zod/${cfg.notebook!.name}/n/${a.id}`);
    expect(a.created).toBe(true);
    const b = await store.save({ type: 'decision', text: 'Use SQLite for the local queue.', agent: 'codex', project: 'demo' });
    expect(b.id).toBe(a.id); expect(b.created).toBe(false);
    const n = [...fake.notes.values()][0];
    expect(n.title).toBe('Use SQLite for the local queue.');
    expect(n.bodyMd).toContain('source_session: claude-code:1111');
    expect(n.bodyMd).toContain('source_event: e2');
    expect(n.folderId).toBe(cfg.notebook!.memoriesFolderId);
  });
  it('links a memory to its conversation note when the session was synced', async () => {
    const fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
    enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    const m = await store.save({ type: 'next-step', text: 'Wire the queue into sync.', agent: 'claude-code', project: 'demo', sessionKey: 'claude-code:11111111-aaaa-4bbb-8ccc-222222222222', event: 'e8' });
    const body = fake.notes.get(m.id)!.bodyMd;
    expect(body).toMatch(/source_note: \d+/);
    expect(body).toContain('/notes/nb/~zod/');
  });
  it('searches by token overlap and recency, filters by type/project, hides retracted', async () => {
    await store.save({ type: 'decision', text: 'Use SQLite for the local queue.', agent: 'claude-code', project: 'demo' });
    await store.save({ type: 'preference', text: 'Bill prefers short commit messages.', agent: 'codex', project: 'demo' });
    const r = await store.save({ type: 'context', text: 'The queue lives in ~/.tlon/memory/queue.', agent: 'codex', project: 'other' });
    let hits = await store.search({ query: 'queue sqlite' });
    expect(hits[0].text).toContain('SQLite'); expect(hits.length).toBe(2);
    hits = await store.search({ query: 'queue', project: 'demo' });
    expect(hits.map((h) => h.project)).toEqual(['demo']);
    hits = await store.search({ query: 'commit', type: 'preference' });
    expect(hits.length).toBe(1);
    await store.update(r.id, { status: 'retracted' });
    hits = await store.search({ query: 'queue' });
    expect(hits.find((h) => h.id === r.id)).toBeUndefined();
    expect((await store.search({ query: 'queue', includeRetracted: true })).find((h) => h.id === r.id)?.status).toBe('retracted');
  });
  it('updates text and type keeping provenance', async () => {
    const a = await store.save({ type: 'decision', text: 'Use SQLite.', agent: 'claude-code', project: 'demo', sessionKey: 'k', event: 'e1' });
    const u = await store.update(a.id, { text: 'Use SQLite (WAL mode).', type: 'decision' });
    expect(u.revision).toBe(2);
    const n = fake.notes.get(a.id)!;
    expect(n.title).toBe('Use SQLite (WAL mode).'); expect(n.bodyMd).toContain('source_session: k');
  });
  it('lists recent memories and conversations', async () => {
    await store.save({ type: 'decision', text: 'A', agent: 'claude-code', project: 'demo' });
    const fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
    enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    expect((await store.listRecent('memories', 5)).length).toBe(1);
    const conv = await store.listRecent('conversations', 5);
    expect(conv.length).toBe(1); expect(conv[0].title).toContain('Claude Code · demo');
  });
  it('searches history and returns bounded excerpts with anchors', async () => {
    const fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
    enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    const hits = await store.searchHistory({ query: 'SQLite' });
    expect(hits.length).toBe(1); expect(hits[0].sessionKey).toBe('claude-code:11111111-aaaa-4bbb-8ccc-222222222222');
    expect(hits[0].snippet).toContain('SQLite');
    const ex = await store.getConversation({ sessionKey: hits[0].sessionKey, maxChars: 300 });
    expect(ex.text.length).toBeLessThanOrEqual(300 + 200);
    expect(ex.text).toContain('## e1');
    expect(ex.truncated).toBe(true);
    const fromE3 = await store.getConversation({ sessionKey: hits[0].sessionKey, fromEvent: 'e3', maxChars: 20_000 });
    expect(fromE3.text.startsWith('## e3')).toBe(true);
  });
});
