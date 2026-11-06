// tests/notebook.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { ensureNotebook } from '../src/notebook';

const fake = new FakeNotes();
beforeAll(() => fake.start()); afterAll(() => fake.stop());

describe('ensureNotebook', () => {
  it('creates notebook + folders once and reuses them', async () => {
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    const a = await ensureNotebook(c, 'Agent Memory');
    expect(a.title).toBe('Agent Memory');
    expect(a.conversationsFolderId).not.toBe(a.memoriesFolderId);
    const b = await ensureNotebook(c, 'Agent Memory');
    expect(b).toEqual(a);
    expect(fake.notebooks.size).toBe(1);
    expect([...fake.folders.values()].filter((f) => f.name !== 'root').length).toBe(2);
  });
  it('only reuses notebooks hosted by this ship', async () => {
    fake.notebooks.set('~bus/agent-memory-9', { host: '~bus', flagName: 'agent-memory-9', id: 9, rootFolderId: 10, title: 'Other' });
    const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
    const r = await ensureNotebook(c, 'Other');
    expect(r.host).toBe('~zod');
  });
});
