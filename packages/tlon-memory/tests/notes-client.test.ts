// tests/notes-client.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { FakeNotes } from './fake-notes-server';
import { NotesClient, NotesError } from '../src/notes-client';

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
    expect(hits.map((h) => h.id)).toEqual([n.id]);
    await c.deleteNote(nb.host, nb.flagName, n.id);
    expect((await c.listNotes(nb.host, nb.flagName)).length).toBe(0);
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
  it('sends the key only as X-Api-Key, never in the URL', async () => {
    for (const r of fake.requests) expect(r.path).not.toContain('test-key');
  });
});
