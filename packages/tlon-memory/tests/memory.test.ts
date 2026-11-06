// tests/memory.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { MemoryStore } from '../src/memory';
import { enqueue, syncQueue, syncSession } from '../src/sync';
import { parseClaudeTranscript } from '../src/transcript/claude';
import { rmSync } from 'node:fs';

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
  describe('a memory saved before its conversation is uploaded', () => {
    const SID = '11111111-aaaa-4bbb-8ccc-222222222222', key = `claude-code:${SID}`;
    const pendingFile = () => join(paths.stateDir, `pending-links-claude-code-${SID}.json`);
    const big = () => { const t = parseClaudeTranscript(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'));
      return { ...t, events: Array.from({ length: 400 }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: `event ${i + 1} ` + 'x'.repeat(1000) })) }; };
    const client = () => new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    it('is linked to the part holding its event (part 1 without one) when the session syncs', async () => {
      const a = await store.save({ type: 'context', text: 'Cites part 2.', agent: 'claude-code', project: 'demo', sessionKey: key, event: 'e250' });
      const b = await store.save({ type: 'context', text: 'Cites no event.', agent: 'claude-code', project: 'demo', sessionKey: key });
      expect(a.linkPending).toBe(true);
      const body = fake.notes.get(a.id)!.bodyMd;
      expect(body).toContain(`source_session: ${key}`); expect(body).not.toContain('source_note');
      expect(existsSync(pendingFile())).toBe(true);
      await syncSession(paths, cfg, client(), big(), { recover: false });
      const ids = (await import('../src/state')).loadSessionState(paths, 'claude-code', SID)!.noteIds;
      const linked = fake.notes.get(a.id)!.bodyMd;
      expect(linked).toContain(`source_note: ${ids[1]}`); expect(linked).toContain(`source_url: ${fake.url}/notes/nb/~zod/${cfg.notebook!.name}/n/${ids[1]}`);
      expect(linked).toContain(`source_session: ${key}`); expect(linked).toContain('source_event: e250');
      expect(fake.notes.get(b.id)!.bodyMd).toContain(`source_note: ${ids[0]}`);
      expect(existsSync(pendingFile())).toBe(false);
    });
    it('keeps a pending link saved while the sync was linking another', async () => {
      const a = await store.save({ type: 'context', text: 'Linked first.', agent: 'claude-code', project: 'demo', sessionKey: key });
      const { loadPendingLinks, savePendingLinks } = await import('../src/state');
      const orig = fake.handle.bind(fake); let once = true;
      fake.handle = async (req: Request) => {
        if (once && req.method === 'PUT' && req.url.endsWith(`/notes/${a.id}`)) { // another process saves a memory meanwhile
          once = false; savePendingLinks(paths, 'claude-code', SID, [...loadPendingLinks(paths, 'claude-code', SID), { memoryId: 999_999 }]);
        }
        return orig(req);
      };
      try { await syncSession(paths, cfg, client(), big(), { recover: false }); } finally { fake.handle = orig; }
      expect(fake.notes.get(a.id)!.bodyMd).toMatch(/source_note: \d+/);
      expect(loadPendingLinks(paths, 'claude-code', SID)).toEqual([{ memoryId: 999_999 }]);
    });
    it('stays pending when the memory keeps conflicting, and links on a later sync', async () => {
      const a = await store.save({ type: 'context', text: 'Conflicted.', agent: 'claude-code', project: 'demo', sessionKey: key, event: 'e3' });
      const orig = NotesClient.prototype.updateNote; let tries = 0;
      const spy = spyOn(NotesClient.prototype, 'updateNote').mockImplementation(async function (this: NotesClient, ...args: Parameters<NotesClient['updateNote']>) {
        if (args[2] === a.id) { tries++; return { kind: 'conflict' }; }
        return orig.apply(this, args);
      });
      try { await syncSession(paths, cfg, client(), big(), { recover: false }); } finally { spy.mockRestore(); }
      expect(tries).toBe(2);
      expect(fake.notes.get(a.id)!.bodyMd).not.toContain('source_note');
      expect(existsSync(pendingFile())).toBe(true);
      expect(await syncSession(paths, cfg, client(), big(), { recover: false })).toBe('unchanged');
      expect(fake.notes.get(a.id)!.bodyMd).toMatch(/source_note: \d+/);
      expect(existsSync(pendingFile())).toBe(false);
    });
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
    expect(fromE3.text.startsWith('part 1/1\n## e3')).toBe(true);
    await expect(store.getConversation({ sessionKey: hits[0].sessionKey, fromEvent: 'e999' })).rejects.toThrow('unknown anchor');
  });
  it('update: rejects empty patches and text, and reports conflicts without renaming', async () => {
    const a = await store.save({ type: 'decision', text: 'Original.', agent: 'claude-code', project: 'demo' });
    await expect(store.update(a.id, {})).rejects.toThrow('nothing to update');
    await expect(store.update(a.id, { text: '   ' })).rejects.toThrow('empty');
    fake.unknownNext = false;
    // the ship answers the guarded PUT with a conflict: someone edited the memory meanwhile
    const orig = fake.handle.bind(fake); let once = true;
    fake.handle = async (req: Request) => {
      if (once && req.method === 'PUT') { once = false; const n = fake.notes.get(a.id)!; n.revision++; }
      return orig(req);
    };
    try { await expect(store.update(a.id, { text: 'Changed.' })).rejects.toMatchObject({ code: 'conflict', message: 'memory changed on the ship; re-read and retry' }); }
    finally { fake.handle = orig; }
    expect(fake.notes.get(a.id)!.title).toBe('Original.');
  });
  it('short queries: one-letter words match nothing, two-letter words count', async () => {
    await store.save({ type: 'decision', text: 'Use a DB for the queue.', agent: 'claude-code', project: 'demo' });
    expect(await store.search({ query: 'a b' })).toEqual([]);
    expect((await store.search({ query: 'db' })).length).toBe(1);
  });
  it('lists and searches memories without downloading the notebook', async () => {
    await store.save({ type: 'decision', text: 'Cheap listing.', agent: 'claude-code', project: 'demo' });
    const fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
    enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    await syncQueue(paths, cfg, { budgetMs: 10_000 });
    fake.requests = [];
    await store.search({ query: 'cheap' });
    await store.listRecent('memories');
    const conv = await store.listRecent('conversations');
    expect(conv[0].sessionKey).toBe('claude-code:11111111-aaaa-4bbb-8ccc-222222222222');
    const listing = (p: string) => /\/notes$/.test(p.split('?')[0]);
    expect(fake.requests.some((r) => r.method === 'GET' && listing(r.path))).toBe(false);
    expect(fake.requests.every((r) => r.path.includes('needle=tlon-memory%3A%20memory%2Fv1'))).toBe(true);
  });
  it('cites and reads the part that holds the event, with or without local state', async () => {
    const t = parseClaudeTranscript(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'));
    const big = { ...t, events: Array.from({ length: 400 }, (_, i) => ({ ...t.events[0], anchor: `e${i + 1}`, text: `event ${i + 1} ` + 'x'.repeat(1000) })) };
    await syncSession(paths, cfg, new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' }), big, { recover: false });
    const key = 'claude-code:11111111-aaaa-4bbb-8ccc-222222222222';
    const ids = (await import('../src/state')).loadSessionState(paths, 'claude-code', '11111111-aaaa-4bbb-8ccc-222222222222')!.noteIds;
    const m = await store.save({ type: 'context', text: 'Cites part 2.', agent: 'claude-code', project: 'demo', sessionKey: key, event: 'e250' });
    expect(fake.notes.get(m.id)!.bodyMd).toContain(`source_note: ${ids[1]}`);
    const ex = await store.getConversation({ sessionKey: key, fromEvent: 'e250', maxChars: 200 });
    expect(ex.noteId).toBe(ids[1]);
    expect(ex.text.startsWith(`part 2/${ids.length}\n## e250 ·`)).toBe(true);
    expect((await store.getConversation({ noteId: ids[0], fromEvent: 'e250', maxChars: 200 })).noteId).toBe(ids[1]);
    rmSync(paths.stateDir, { recursive: true });
    const m2 = await store.save({ type: 'context', text: 'Cites part 2 again.', agent: 'claude-code', project: 'demo', sessionKey: key, event: 'e250' });
    expect(fake.notes.get(m2.id)!.bodyMd).toContain(`source_note: ${ids[1]}`);
    expect((await store.getConversation({ sessionKey: key })).noteId).toBe(ids[0]);
  });
});
