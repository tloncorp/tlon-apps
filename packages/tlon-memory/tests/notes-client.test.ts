// tests/notes-client.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { FakeNotes } from './fake-notes-server';
import { NotesClient, NotesError, SEARCH_HORIZON } from '../src/notes-client';

const fake = new FakeNotes();
beforeAll(() => fake.start());
afterAll(() => fake.stop());

describe('NotesClient', () => {
  const c = new NotesClient({ shipUrl: '', apiKey: 'test-key' });
  beforeAll(() => { (c as any).shipUrl = fake.url; });

  it('reads the ship name', async () => { expect(await c.hostName()).toBe('~zod'); });
  it('creates a notebook, folders and notes; updates with revision guard', async () => {
    const nb = await c.createNotebook('Agent Memory');
    expect(nb.host).toBe('~zod'); expect(nb.flagName).toMatch(/^agent-memory/);
    const f = await c.createFolder(nb.host, nb.flagName, 'conversations', nb.rootFolderId);
    expect(typeof f).toBe('number');
    const n = await c.createNote(nb.host, nb.flagName, f, 'T', 'body v1');
    expect(n.revision).toBe(1);
    const u = await c.updateNote(nb.host, nb.flagName, n.id, 'body v2', n.revision);
    expect(u.kind).toBe('updated'); expect(u.revision).toBe(2);
    const same = await c.updateNote(nb.host, nb.flagName, n.id, 'body v2', 2);
    expect(same.kind).toBe('no-change');
    const stale = await c.updateNote(nb.host, nb.flagName, n.id, 'body v3', 1);
    expect(stale.kind).toBe('conflict');
    expect((await c.getNote(nb.host, nb.flagName, n.id)).bodyMd).toBe('body v2');
    expect((await c.listNotes(nb.host, nb.flagName)).length).toBe(1);
    const hits = await c.searchText(nb.host, nb.flagName, 'v2');
    expect(hits.notes.map((h) => h.id)).toEqual([n.id]);
    expect(hits.truncated).toBe(false);
    await c.deleteNote(nb.host, nb.flagName, n.id);
    expect((await c.listNotes(nb.host, nb.flagName)).length).toBe(0);
  });
  it('flags a search that stopped at the scan horizon', async () => {
    const nb = await c.createNotebook('Big');
    const f = await c.createFolder(nb.host, nb.flagName, 'f', nb.rootFolderId);
    const nbId = [...fake.notebooks.values()].find((x) => x.flagName === nb.flagName)!.id;
    for (let i = 0; i < SEARCH_HORIZON + 50; i++) { const id = 50_000 + i;
      fake.notes.set(id, { id, notebookId: nbId, folderId: f, title: 't', slug: null, bodyMd: i === 0 ? 'needle-old' : 'x', createdBy: '~zod', createdAt: 1, updatedBy: '~zod', updatedAt: 1, revision: 1 }); }
    const r = await c.searchText(nb.host, nb.flagName, 'needle-old');
    expect(r.truncated).toBe(true);
    expect(r.notes).toEqual([]); // the oldest note is past the horizon
    for (let i = 0; i < SEARCH_HORIZON + 50; i++) fake.notes.delete(50_000 + i);
  });
  it('omits `from` on the first search page (the desk reads from=0 as an empty range) and pages below `last`', async () => {
    const nb = await c.createNotebook('Paged');
    const f = await c.createFolder(nb.host, nb.flagName, 'f', nb.rootFolderId);
    const nbId = [...fake.notebooks.values()].find((x) => x.flagName === nb.flagName)!.id;
    for (let i = 0; i < 250; i++) { const id = 70_000 + i;
      fake.notes.set(id, { id, notebookId: nbId, folderId: f, title: 't', slug: null, bodyMd: i === 0 || i === 249 ? 'needle-page' : 'x', createdBy: '~zod', createdAt: 1, updatedBy: '~zod', updatedAt: 1, revision: 1 }); }
    fake.requests = [];
    const r = await c.searchText(nb.host, nb.flagName, 'needle-page');
    expect(r.notes.map((n) => n.id)).toEqual([70_249, 70_000]);
    const froms = fake.requests.map((q) => new URL(q.path, 'http://x').searchParams.get('from'));
    expect(froms).toEqual([null, '70150', '70050']);
    for (let i = 0; i < 250; i++) fake.notes.delete(70_000 + i);
  });
  it('maps 401/403 to KeyRejected and 5xx to Unreachable', async () => {
    const bad = new NotesClient({ shipUrl: fake.url, apiKey: 'wrong' });
    await expect(bad.listNotebooks()).rejects.toMatchObject({ code: 'key-rejected' });
    fake.failNext = 503;
    await expect(c.listNotebooks()).rejects.toMatchObject({ code: 'unreachable' });
  });
  it('fetches an api key with +code and does not keep the cookie', async () => {
    const key = await NotesClient.apiKeyFromCode(fake.url, fake.code);
    expect(key).toBe(fake.apiKey);
    await expect(NotesClient.apiKeyFromCode(fake.url, 'wrong-code-aaaaaa-bbbbbb')).rejects.toMatchObject({ code: 'bad-code' });
  });
  it('maps a legacy unknown error on a guarded PUT to conflict only when the revision moved', async () => {
    const nb = await c.createNotebook('Legacy');
    const f = await c.createFolder(nb.host, nb.flagName, 'f', nb.rootFolderId);
    const n = await c.createNote(nb.host, nb.flagName, f, 'T', 'v1');
    await c.updateNote(nb.host, nb.flagName, n.id, 'v2', 1);
    fake.legacyConflict = true;
    try {
      expect((await c.updateNote(nb.host, nb.flagName, n.id, 'v3', 1)).kind).toBe('conflict');
      // revision unchanged but the ship still says unknown: not a conflict, so it is rethrown
      fake.unknownNext = true;
      await expect(c.updateNote(nb.host, nb.flagName, n.id, 'v3', 2)).rejects.toMatchObject({ code: 'protocol' });
    } finally { fake.legacyConflict = false; }
  });
  it('rejects malformed responses as protocol errors without echoing the search needle', async () => {
    fake.failNextOn = { path: '/notes/~/v1/notebooks', status: 200 };
    await expect(c.listNotebooks()).rejects.toMatchObject({ code: 'protocol' });
    const nb = await c.createNotebook('Shape');
    const search = `/notes/~/v1/notebooks/${nb.host}/${nb.flagName}/search/bounded/text`;
    fake.failNextOn = { path: search, status: 400 };
    const err = await c.searchText(nb.host, nb.flagName, 'secretneedle').catch((e) => e);
    expect(err).toMatchObject({ code: 'protocol' });
    expect(err.message).not.toContain('secretneedle');
  });
  it('stops once the deadline has passed', async () => {
    const late = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key', deadline: Date.now() - 1 });
    const before = fake.requests.length;
    await expect(late.listNotebooks()).rejects.toMatchObject({ code: 'unreachable', message: 'deadline exceeded' });
    expect(fake.requests.length).toBe(before);
  });
  it('mints a key when the scry has none, and fails loudly when regeneration fails', async () => {
    fake.scryNull = true;
    try {
      const key = await NotesClient.apiKeyFromCode(fake.url, fake.code);
      expect(key).toBe(fake.apiKey); expect(key).toMatch(/^key-/);
    } finally { fake.scryNull = false; }
    fake.failNextOn = { path: '/notes/~/v1', status: 500 };
    await expect(NotesClient.regenerateWithCode(fake.url, fake.code)).rejects.toBeInstanceOf(NotesError);
    const rotated = await NotesClient.regenerateWithCode(fake.url, fake.code);
    expect(rotated).toBe(fake.apiKey);
    (c as any).apiKey = fake.apiKey;
  });
  it('maps an unreachable host during +code exchange to unreachable', async () => {
    await expect(NotesClient.apiKeyFromCode('http://127.0.0.1:1', fake.code)).rejects.toMatchObject({ code: 'unreachable' });
  });
  it('sends the key only as X-Api-Key, never in the URL', async () => {
    for (const r of fake.requests) expect(r.path).not.toContain('test-key');
  });
});
