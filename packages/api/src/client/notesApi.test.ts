import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  NotesInvalidRequestIdError,
  NotesUnknownFolderError,
  NotesV1PendingWriteError,
  NotesV1WriteError,
  batchImportNotesV1,
  deleteNotesNotebookBestEffort,
  deleteNotesNotebookStrict,
  formatNotesFlag,
  joinNotesChannel,
  joinNotesNotebook,
  leaveNotesChannel,
  normalizeNotesTarget,
  notes,
  notesChannelId,
  notesV1,
  parseNotesChannelId,
  parseNotesFlag,
  subscribeToNotesNotebook,
  unsubscribeFromNotesNotebook,
} from './notesApi';
import {
  BadResponseError,
  poke,
  requestJson,
  scry,
  subscribe,
  unsubscribe,
} from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');

  return {
    ...actual,
    poke: vi.fn(),
    requestJson: vi.fn(),
    scry: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
});

const pokeMock = poke as unknown as Mock;
const requestJsonMock = requestJson as unknown as Mock;
const scryMock = scry as unknown as Mock;
const subscribeMock = subscribe as unknown as Mock;
const unsubscribeMock = unsubscribe as unknown as Mock;

async function rejectionError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

function pendingErrorStrings(error: NotesV1PendingWriteError): string {
  return [
    error.name,
    error.message,
    error.requestId ?? '',
    error.status ?? '',
    JSON.stringify(error.checks),
  ].join('\n');
}

beforeEach(() => {
  requestJsonMock.mockResolvedValue(undefined);
  pokeMock.mockResolvedValue(undefined);
  scryMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('flag parsing and formatting', () => {
  test('formatNotesFlag', () => {
    expect(formatNotesFlag({ host: '~zod', name: 'blog' })).toBe('~zod/blog');
    expect(formatNotesFlag('~zod/blog')).toBe('~zod/blog');
  });

  test('parseNotesFlag', () => {
    expect(parseNotesFlag('~zod/blog')).toEqual({ host: '~zod', name: 'blog' });
    expect(parseNotesFlag('bad')).toBeNull();
    expect(parseNotesFlag(null)).toBeNull();
  });

  test('parseNotesChannelId only accepts notes/... nests', () => {
    expect(parseNotesChannelId('notes/~zod/blog')).toEqual({
      host: '~zod',
      name: 'blog',
    });
    expect(parseNotesChannelId('chat/~zod/blog')).toBeNull();
    expect(parseNotesChannelId('notes/~zod/blog/extra')).toBeNull();
  });

  test('notesChannelId', () => {
    expect(notesChannelId({ host: '~zod', name: 'blog' })).toBe(
      'notes/~zod/blog'
    );
  });
});

describe('normalizeNotesTarget', () => {
  test('normalizes every accepted identifier shape to a ~host flag', () => {
    expect(normalizeNotesTarget('notes/~zod/blog')).toEqual({
      host: '~zod',
      name: 'blog',
    });
    // missing-sig host in a full nest
    expect(normalizeNotesTarget('notes/zod/blog')).toEqual({
      host: '~zod',
      name: 'blog',
    });
    expect(normalizeNotesTarget('~zod/blog')).toEqual({
      host: '~zod',
      name: 'blog',
    });
    expect(normalizeNotesTarget({ host: 'zod', name: 'blog' })).toEqual({
      host: '~zod',
      name: 'blog',
    });
  });

  test('never parses a full notes nest as a raw flag with host "notes"', () => {
    expect(normalizeNotesTarget('notes/~zod/blog').host).not.toBe('notes');
  });

  test('rejects malformed identifiers and partial paths', () => {
    for (const bad of [
      'notes/~zod/book/12',
      'notes/~zod/book/note/12',
      '~zod/book/12',
      'notes//book',
      'notes/~zod/',
      '',
      'justone',
    ]) {
      expect(() => normalizeNotesTarget(bad)).toThrow();
    }
  });
});

describe('%notes transport helpers', () => {
  test('joinNotesNotebook pokes %notes directly and does not call v1 HTTP', async () => {
    await joinNotesNotebook('notes/~zod/blog');
    expect(requestJsonMock).not.toHaveBeenCalled();
    expect(pokeMock).toHaveBeenCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'join',
        ship: '~zod',
        name: 'blog',
      },
    });
  });

  test('stream helpers subscribe to /v0/.../stream and pass unsubscribe through', async () => {
    subscribeMock.mockResolvedValue(7);
    const handler = vi.fn();
    const id = await subscribeToNotesNotebook('~zod/blog', handler);
    expect(subscribeMock).toHaveBeenCalledWith(
      { app: 'notes', path: '/v0/notes/~zod/blog/stream' },
      expect.any(Function)
    );
    expect(id).toBe(7);

    await unsubscribeFromNotesNotebook(7);
    expect(unsubscribeMock).toHaveBeenCalledWith(7);
  });

  test('stream events arrive with their update payload parsed', async () => {
    subscribeMock.mockResolvedValue(7);
    const handler = vi.fn();
    await subscribeToNotesNotebook('~zod/blog', handler);
    const emit = subscribeMock.mock.calls[0][1];

    emit({ type: 'snapshot', host: '~zod', flagName: 'blog' });
    expect(handler).toHaveBeenCalledWith({
      type: 'snapshot',
      host: '~zod',
      flagName: 'blog',
    });

    emit({
      type: 'update',
      host: '~zod',
      flagName: 'blog',
      time: 123,
      update: {
        type: 'note-update',
        host: '~zod',
        flagName: 'blog',
        noteUpdate: {
          type: 'note-updated',
          id: 4,
          note: { id: 4, title: 'Renamed', bodyMd: 'body', revision: 3 },
        },
      },
    });
    expect(handler).toHaveBeenLastCalledWith({
      type: 'update',
      host: '~zod',
      flagName: 'blog',
      time: 123,
      update: {
        type: 'note-updated',
        noteId: 4,
        note: expect.objectContaining({ id: 4, title: 'Renamed', revision: 3 }),
      },
    });
  });

  test('an unmodeled update variant reaches the handler as a null update', async () => {
    subscribeMock.mockResolvedValue(7);
    const handler = vi.fn();
    await subscribeToNotesNotebook('~zod/blog', handler);
    const emit = subscribeMock.mock.calls[0][1];

    emit({
      type: 'update',
      host: '~zod',
      flagName: 'blog',
      update: { type: 'something-new-from-the-future' },
    });

    // Null, not dropped: the caller still needs to know something changed.
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update', update: null })
    );
  });

  test('malformed stream events are dropped rather than forwarded', async () => {
    subscribeMock.mockResolvedValue(7);
    const handler = vi.fn();
    await subscribeToNotesNotebook('~zod/blog', handler);
    const emit = subscribeMock.mock.calls[0][1];

    emit({ type: 'update', update: null });
    emit({ type: 'bogus', host: '~zod', flagName: 'blog' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('notesV1 reads', () => {
  test('listNotebooks GETs the v1 path and normalizes items (rootFolderId optional)', async () => {
    requestJsonMock.mockResolvedValue([
      { host: '~zod', flagName: 'blog', notebook: { id: 2, title: 'Blog' } },
    ]);
    const result = await notesV1.listNotebooks();
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/notebooks',
      'GET'
    );
    expect(result[0].notebook).toMatchObject({ id: 2, title: 'Blog' });
    expect(result[0].notebook.rootFolderId).toBeUndefined();
  });

  test('listNotebooks returns [] only for a real empty array; rejects non-array and failed reads', async () => {
    requestJsonMock.mockResolvedValue([]);
    expect(await notesV1.listNotebooks()).toEqual([]);

    requestJsonMock.mockResolvedValue(undefined);
    await expect(notesV1.listNotebooks()).rejects.toThrow();

    requestJsonMock.mockResolvedValue({ not: 'an array' });
    await expect(notesV1.listNotebooks()).rejects.toThrow();

    requestJsonMock.mockRejectedValue(new Error('boom'));
    await expect(notesV1.listNotebooks()).rejects.toThrow('boom');
  });

  test('getNotebook returns detail with required rootFolderId', async () => {
    requestJsonMock.mockResolvedValue({
      host: '~zod',
      flagName: 'blog',
      notebook: { id: 2, title: 'Blog', rootFolderId: 3 },
    });
    const detail = await notesV1.getNotebook('notes/~zod/blog');
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/notebooks/~zod/blog',
      'GET'
    );
    expect(detail.notebook.rootFolderId).toBe(3);
  });

  test('getNotebook rejects a detail response missing rootFolderId (or empty body)', async () => {
    requestJsonMock.mockResolvedValue({
      host: '~zod',
      flagName: 'blog',
      notebook: { id: 2, title: 'Blog' },
    });
    await expect(notesV1.getNotebook('notes/~zod/blog')).rejects.toThrow(
      'rootFolderId'
    );

    requestJsonMock.mockResolvedValue(undefined);
    await expect(notesV1.getNotebook('notes/~zod/blog')).rejects.toThrow();
  });

  test('listNotes / listFolders / listMembers / history build the v1 path', async () => {
    requestJsonMock.mockResolvedValue([]);
    await notesV1.listNotes('notes/~zod/blog');
    await notesV1.listFolders('notes/~zod/blog');
    await notesV1.listMembers('notes/~zod/blog');
    await notesV1.listNoteHistory({ flag: 'notes/~zod/blog', noteId: 12 });
    expect(requestJsonMock.mock.calls.map((c) => c[0])).toEqual([
      '/notes/~/v1/notebooks/~zod/blog/notes',
      '/notes/~/v1/notebooks/~zod/blog/folders',
      '/notes/~/v1/notebooks/~zod/blog/members',
      '/notes/~/v1/notebooks/~zod/blog/notes/12/history',
    ]);
  });

  test('getRequest reads a pending request status by id', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: '0vabc',
      body: { type: 'pending', status: 'acked' },
    });

    await expect(notesV1.getRequest('0vabc')).resolves.toEqual({
      requestId: '0vabc',
      body: { type: 'pending', status: 'acked' },
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/request/0vabc',
      'GET'
    );
  });

  test('getRequest returns terminal error and notebook bodies', async () => {
    requestJsonMock.mockResolvedValueOnce({
      requestId: '0verr',
      body: { type: 'error', errorType: 'not-found', message: [] },
    });
    await expect(notesV1.getRequest('0verr')).resolves.toEqual({
      requestId: '0verr',
      body: { type: 'error', errorType: 'not-found', message: '' },
    });

    requestJsonMock.mockResolvedValueOnce({
      requestId: '0vbook',
      body: {
        type: 'notebook',
        notebook: {
          host: '~zod',
          flagName: 'blog',
          notebook: { id: 1, title: 'Blog' },
        },
      },
    });
    await expect(notesV1.getRequest('0vbook')).resolves.toMatchObject({
      requestId: '0vbook',
      body: {
        type: 'notebook',
        notebook: { host: '~zod', flagName: 'blog' },
      },
    });
  });
});

describe('notesV1 normalization variants', () => {
  test('folder accepts { id, folderName }, optional notebookId, missing parent -> null', async () => {
    requestJsonMock.mockResolvedValue([{ id: 4, folderName: 'Drafts' }]);
    const [folder] = await notesV1.listFolders('notes/~zod/blog');
    expect(folder).toMatchObject({
      id: 4,
      name: 'Drafts',
      parentFolderId: null,
    });
    expect(folder.notebookId).toBeUndefined();
  });

  test('folder accepts parent alias', async () => {
    requestJsonMock.mockResolvedValue({ id: 4, name: 'Drafts', parent: 3 });
    const folder = await notesV1.getFolder({
      flag: 'notes/~zod/blog',
      folderId: 4,
    });
    expect(folder.parentFolderId).toBe(3);
  });

  test('note accepts { id, title, revision } without notebookId/folderId, and folder alias', async () => {
    requestJsonMock.mockResolvedValue([
      { id: 12, title: 'First', revision: 1, folder: 3 },
    ]);
    const [note] = await notesV1.listNotes('notes/~zod/blog');
    expect(note).toMatchObject({ id: 12, title: 'First', folderId: 3 });
  });

  test('history normalizes rev/at/by to revision/editedAt/author', async () => {
    requestJsonMock.mockResolvedValue([{ rev: 2, at: 100, by: '~zod' }]);
    const [rev] = await notesV1.listNoteHistory({
      flag: 'notes/~zod/blog',
      noteId: 12,
    });
    expect(rev).toMatchObject({ revision: 2, editedAt: 100, author: '~zod' });
  });

  test('rejects malformed successful bodies missing required fields', async () => {
    // notebook summary missing host / flagName / id / title
    requestJsonMock.mockResolvedValue([
      { flagName: 'b', notebook: { id: 1, title: 'B' } },
    ]);
    await expect(notesV1.listNotebooks()).rejects.toThrow('host');
    requestJsonMock.mockResolvedValue([
      { host: '~zod', notebook: { id: 1, title: 'B' } },
    ]);
    await expect(notesV1.listNotebooks()).rejects.toThrow('flagName');
    requestJsonMock.mockResolvedValue([
      { host: '~zod', flagName: 'b', notebook: { title: 'B' } },
    ]);
    await expect(notesV1.listNotebooks()).rejects.toThrow('notebook.id');

    // folder missing name (and folderName)
    requestJsonMock.mockResolvedValue([{ id: 4 }]);
    await expect(notesV1.listFolders('notes/~zod/blog')).rejects.toThrow(
      'folder.name'
    );

    // note missing title
    requestJsonMock.mockResolvedValue([{ id: 12 }]);
    await expect(notesV1.listNotes('notes/~zod/blog')).rejects.toThrow(
      'note.title'
    );

    // member missing ship
    requestJsonMock.mockResolvedValue([{ role: 'owner' }]);
    await expect(notesV1.listMembers('notes/~zod/blog')).rejects.toThrow(
      'member.ship'
    );
  });

  test('member normalizes role/roles/missing to roles: NotesRole[]', async () => {
    requestJsonMock.mockResolvedValue([
      { ship: '~zod', role: 'owner' },
      { ship: '~bus', roles: ['editor'] },
      { ship: '~nec' },
    ]);
    const members = await notesV1.listMembers('notes/~zod/blog');
    expect(members).toEqual([
      { ship: '~zod', roles: ['owner'] },
      { ship: '~bus', roles: ['editor'] },
      { ship: '~nec', roles: [] },
    ]);
  });
});

describe('notes app facade', () => {
  test('getNotebook returns the flat client model used by shared', async () => {
    requestJsonMock.mockResolvedValue({
      host: '~zod',
      flagName: 'blog',
      visibility: 'private',
      notebook: {
        id: 2,
        title: 'Blog',
        rootFolderId: 3,
        createdBy: '~zod',
      },
    });

    await expect(notes.getNotebook('notes/~zod/blog')).resolves.toMatchObject({
      id: '~zod/blog',
      host: '~zod',
      flagName: 'blog',
      notebookId: 2,
      title: 'Blog',
      visibility: 'private',
      rootFolderId: 3,
      createdBy: '~zod',
    });
  });

  test('listNotes returns client ids while preserving omitted detail fields', async () => {
    requestJsonMock.mockResolvedValue([{ id: 12, title: 'First' }]);

    const [note] = await notes.listNotes('notes/~zod/blog');

    expect(note).toMatchObject({
      id: '~zod/blog/note/12',
      notebookFlag: '~zod/blog',
      noteId: 12,
      title: 'First',
    });
    expect(note.folderId).toBeUndefined();
    expect(note.bodyMd).toBeUndefined();
    expect(note.revision).toBeUndefined();
  });

  test('listMembers flattens roles and preserves role-less members', async () => {
    requestJsonMock.mockResolvedValue([
      { ship: '~zod', roles: ['owner', 'editor'] },
      { ship: '~nec' },
    ]);

    await expect(notes.listMembers('notes/~zod/blog')).resolves.toEqual([
      { notebookFlag: '~zod/blog', contactId: '~zod', role: 'owner' },
      { notebookFlag: '~zod/blog', contactId: '~zod', role: 'editor' },
      { notebookFlag: '~zod/blog', contactId: '~nec', role: null },
    ]);
  });
});

describe('notesV1 writes send pinned v1 HTTP bodies', () => {
  // Every v1 write response is an envelope; tests that only assert on the
  // outgoing request still need one for assertWriteOk to accept.
  beforeEach(() => {
    requestJsonMock.mockResolvedValue({ body: { type: 'ok' } });
  });

  test('createNotebook unwraps the notebook envelope', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: 'r',
      body: {
        type: 'notebook',
        notebook: {
          host: '~zod',
          flagName: 'b',
          notebook: { id: 1, title: 'B' },
        },
      },
    });
    const summary = await notesV1.createNotebook({ title: 'B' });
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/notebooks',
      'POST',
      { title: 'B' }
    );
    expect(summary).toMatchObject({ host: '~zod', flagName: 'b' });
  });

  test('createGroupNotebook sends { title, group, readers } and unwraps notebook', async () => {
    requestJsonMock.mockResolvedValue({
      body: {
        type: 'notebook',
        notebook: {
          host: '~zod',
          flagName: 'b',
          notebook: { id: 1, title: 'B' },
        },
      },
    });
    await notesV1.createGroupNotebook({
      title: 'B',
      group: { host: '~zod', flagName: 'group' },
      readers: [],
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/notebooks',
      'POST',
      { title: 'B', group: { host: '~zod', flagName: 'group' }, readers: [] }
    );
  });

  test('createNotebook rejects error/unexpected envelopes', async () => {
    for (const body of [
      { type: 'error', message: ['no'] },
      { type: 'api-key' },
    ]) {
      requestJsonMock.mockResolvedValue({ body });
      await expect(notesV1.createNotebook({ title: 'B' })).rejects.toThrow();
    }
  });

  test('createNotebook pending preserves structured request status and notebook checks', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: '0vabc',
      body: { type: 'pending', status: 'acked' },
    });

    const error = await rejectionError(notesV1.createNotebook({ title: 'B' }));

    expect(error).toBeInstanceOf(NotesV1PendingWriteError);
    const pending = error as NotesV1PendingWriteError;
    expect(pending.message).toBe('%notes write request is still pending');
    expect(pending.requestId).toBe('0vabc');
    expect(pending.status).toBe('acked');
    expect(pending.checks).toEqual([
      { type: 'notebook-list' },
      { type: 'notebook-detail' },
    ]);
    expect(pendingErrorStrings(pending)).not.toContain('tlon notes');
  });

  test('createNotebook reports empty error envelopes with fallback detail', async () => {
    requestJsonMock.mockResolvedValue({ body: { type: 'error', message: [] } });

    await expect(notesV1.createNotebook({ title: 'B' })).rejects.toThrow(
      '%notes error: backend returned an error without details'
    );
  });

  test('createNote sends { folder, title, body } and never a v0 { type } body', async () => {
    await notesV1.createNote({
      flag: 'notes/~zod/blog',
      folder: 3,
      title: 'T',
      body: 'B',
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes',
      'POST',
      { folder: 3, title: 'T', body: 'B' }
    );
  });

  test('createNote pending preserves structured request status and note checks', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: '0vnote',
      body: { type: 'pending', status: 'queued' },
    });

    const error = await rejectionError(
      notesV1.createNote({
        flag: 'notes/~zod/blog',
        folder: 3,
        title: 'T',
        body: 'B',
      })
    );

    expect(error).toBeInstanceOf(NotesV1PendingWriteError);
    const pending = error as NotesV1PendingWriteError;
    expect(pending.requestId).toBe('0vnote');
    expect(pending.status).toBe('queued');
    expect(pending.checks).toEqual([
      { type: 'note-list', nest: 'notes/~zod/blog' },
      { type: 'note-detail', nest: 'notes/~zod/blog' },
    ]);
    expect(pendingErrorStrings(pending)).not.toContain('tlon notes');
  });

  test('updateNoteBody includes expectedRevision only when provided', async () => {
    await notesV1.updateNoteBody({
      flag: 'notes/~zod/blog',
      noteId: 12,
      body: 'x',
      expectedRevision: 4,
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes/12',
      'PUT',
      { body: 'x', expectedRevision: 4 }
    );

    await notesV1.updateNoteBody({
      flag: 'notes/~zod/blog',
      noteId: 12,
      body: 'x',
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes/12',
      'PUT',
      { body: 'x' }
    );
  });

  test('updateNoteBody distinguishes applied writes from no-change', async () => {
    requestJsonMock.mockResolvedValue({ body: { type: 'ok' } });
    await expect(
      notesV1.updateNoteBody({ flag: 'notes/~zod/blog', noteId: 12, body: 'x' })
    ).resolves.toMatchObject({ status: 'ok', note: null });

    requestJsonMock.mockResolvedValue({ body: { type: 'no-change' } });
    await expect(
      notesV1.updateNoteBody({ flag: 'notes/~zod/blog', noteId: 12, body: 'x' })
    ).resolves.toMatchObject({ status: 'no-change', note: null });
  });

  test('note writes extract the applied note from the ok envelope', async () => {
    // Mirrors the v1 encoder exactly: response %update wraps the
    // notebook-scoped u-notebook ({type: 'note-update', noteUpdate}) whose
    // inner u-note carries the applied note (lib/notes/json.hoon).
    const envelope = {
      requestId: '0vok',
      body: {
        type: 'ok',
        response: {
          type: 'update',
          host: '~zod',
          flagName: 'blog',
          time: 1700000000000,
          update: {
            type: 'note-update',
            host: '~zod',
            flagName: 'blog',
            noteUpdate: {
              type: 'note-updated',
              id: 12,
              note: {
                id: 12,
                title: 'T',
                bodyMd: 'x',
                revision: 4,
                updatedAt: 1234,
                updatedBy: '~zod',
              },
            },
          },
        },
      },
    };

    requestJsonMock.mockResolvedValue(envelope);
    await expect(
      notesV1.updateNoteBody({ flag: 'notes/~zod/blog', noteId: 12, body: 'x' })
    ).resolves.toMatchObject({
      status: 'ok',
      note: { id: 12, revision: 4, updatedAt: 1234, updatedBy: '~zod' },
    });

    await expect(
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 12, title: 'T' })
    ).resolves.toMatchObject({ id: 12, updatedAt: 1234 });

    // A flat (unwrapped) update payload is not the wire shape — it must
    // degrade to null rather than be mistaken for the applied note.
    requestJsonMock.mockResolvedValue({
      body: {
        type: 'ok',
        response: {
          type: 'update',
          update: {
            type: 'note-updated',
            id: 12,
            note: { id: 12, title: 'T' },
          },
        },
      },
    });
    await expect(
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 12, title: 'T' })
    ).resolves.toBeNull();

    // Malformed payloads degrade to null, never throw past a passing write.
    requestJsonMock.mockResolvedValue({
      body: {
        type: 'ok',
        response: {
          type: 'update',
          update: {
            type: 'note-update',
            noteUpdate: {
              type: 'note-updated',
              id: 12,
              note: { title: 'no id' },
            },
          },
        },
      },
    });
    await expect(
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 12, title: 'T' })
    ).resolves.toBeNull();
  });

  function okEnvelope(update: unknown) {
    return {
      requestId: '0vok',
      body: {
        type: 'ok',
        response: {
          type: 'update',
          host: '~zod',
          flagName: 'blog',
          time: 1700000000000,
          update,
        },
      },
    };
  }

  test('note writes return the update they applied', async () => {
    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'note-update',
        host: '~zod',
        flagName: 'blog',
        noteUpdate: {
          type: 'note-created',
          id: 9,
          note: { id: 9, folderId: 3, title: 'T', bodyMd: 'B', revision: 1 },
        },
      })
    );
    await expect(
      notesV1.createNote({
        flag: 'notes/~zod/blog',
        folder: 3,
        title: 'T',
        body: 'B',
      })
    ).resolves.toMatchObject({
      type: 'note-created',
      noteId: 9,
      note: { id: 9, folderId: 3, bodyMd: 'B', revision: 1 },
    });

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'note-update',
        host: '~zod',
        flagName: 'blog',
        noteUpdate: { type: 'note-deleted', id: 9 },
      })
    );
    await expect(
      notesV1.deleteNote({ flag: 'notes/~zod/blog', noteId: 9 })
    ).resolves.toEqual({ type: 'note-deleted', noteId: 9 });

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'note-update',
        host: '~zod',
        flagName: 'blog',
        noteUpdate: {
          type: 'note-updated',
          id: 9,
          note: { id: 9, folderId: 5, title: 'T', bodyMd: 'B', revision: 1 },
        },
      })
    );
    await expect(
      notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 9, folder: 5 })
    ).resolves.toMatchObject({
      type: 'note-updated',
      noteId: 9,
      note: { folderId: 5 },
    });
  });

  test('folder writes return the update they applied', async () => {
    const folder = {
      id: 7,
      notebookId: 2,
      name: 'Drafts',
      parentFolderId: 3,
      updatedAt: 1234,
      updatedBy: '~zod',
    };

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'folder-update',
        host: '~zod',
        flagName: 'blog',
        folderUpdate: { type: 'folder-created', id: 7, folder },
      })
    );
    await expect(
      notesV1.createFolder({
        flag: 'notes/~zod/blog',
        name: 'Drafts',
        parent: 3,
      })
    ).resolves.toMatchObject({
      type: 'folder-created',
      folderId: 7,
      folder: { id: 7, name: 'Drafts', parentFolderId: 3 },
    });

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'folder-update',
        host: '~zod',
        flagName: 'blog',
        folderUpdate: {
          type: 'folder-updated',
          id: 7,
          folder: { ...folder, name: 'Renamed' },
        },
      })
    );
    await expect(
      notesV1.renameFolder({
        flag: 'notes/~zod/blog',
        folderId: 7,
        name: 'Renamed',
      })
    ).resolves.toMatchObject({
      type: 'folder-updated',
      folder: { name: 'Renamed' },
    });

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'folder-update',
        host: '~zod',
        flagName: 'blog',
        folderUpdate: { type: 'folder-deleted', id: 7 },
      })
    );
    await expect(
      notesV1.deleteFolder({
        flag: 'notes/~zod/blog',
        folderId: 7,
        recursive: true,
      })
    ).resolves.toEqual({ type: 'folder-deleted', folderId: 7 });
  });

  test('a write with no update, or one we do not model, returns null', async () => {
    requestJsonMock.mockResolvedValue({ body: { type: 'no-change' } });
    await expect(
      notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 9, folder: 5 })
    ).resolves.toBeNull();

    requestJsonMock.mockResolvedValue(
      okEnvelope({ type: 'invented-later', host: '~zod', flagName: 'blog' })
    );
    await expect(
      notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 9, folder: 5 })
    ).resolves.toBeNull();

    // A folder update missing its id can't identify a row — null, not a throw.
    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'folder-update',
        host: '~zod',
        flagName: 'blog',
        folderUpdate: { type: 'folder-deleted' },
      })
    );
    await expect(
      notesV1.deleteFolder({
        flag: 'notes/~zod/blog',
        folderId: 7,
        recursive: true,
      })
    ).resolves.toBeNull();
  });

  test('member and notebook updates parse from the ok envelope', async () => {
    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'member-joined',
        host: '~zod',
        flagName: 'blog',
        who: '~ten',
        role: 'editor',
      })
    );
    await expect(
      notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 9, folder: 5 })
    ).resolves.toEqual({ type: 'member-joined', who: '~ten', role: 'editor' });

    requestJsonMock.mockResolvedValue(
      okEnvelope({
        type: 'notebook-visibility-changed',
        host: '~zod',
        flagName: 'blog',
        visibility: 'public',
      })
    );
    await expect(
      notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 9, folder: 5 })
    ).resolves.toEqual({
      type: 'notebook-visibility-changed',
      visibility: 'public',
    });
  });

  test('updateNoteBody surfaces a typed conflict error with a tang message', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: '0vconflict',
      body: {
        type: 'error',
        errorType: 'conflict',
        message: [
          'revision-mismatch: expected 2, current 3',
          'refresh and retry',
        ],
      },
    });

    const error = await rejectionError(
      notesV1.updateNoteBody({
        flag: 'notes/~zod/blog',
        noteId: 12,
        body: 'x',
        expectedRevision: 2,
      })
    );

    expect(error).toBeInstanceOf(NotesV1WriteError);
    const writeError = error as NotesV1WriteError;
    expect(writeError.errorType).toBe('conflict');
    expect(writeError.message).toBe(
      '%notes error: revision-mismatch: expected 2, current 3\nrefresh and retry'
    );
  });

  test('empty tang messages fall back to errorType', async () => {
    requestJsonMock.mockResolvedValue({
      body: { type: 'error', errorType: 'conflict', message: [] },
    });

    const error = await rejectionError(
      notesV1.updateNoteBody({
        flag: 'notes/~zod/blog',
        noteId: 12,
        body: 'x',
      })
    );

    expect(error).toBeInstanceOf(NotesV1WriteError);
    expect((error as NotesV1WriteError).errorType).toBe('conflict');
    expect((error as NotesV1WriteError).message).toBe('%notes error: conflict');
  });

  test('error envelopes without errorType still throw with a message', async () => {
    requestJsonMock.mockResolvedValue({
      body: { type: 'error', message: 'not-authorized' },
    });

    const error = await rejectionError(
      notesV1.updateNoteBody({
        flag: 'notes/~zod/blog',
        noteId: 12,
        body: 'x',
      })
    );

    expect(error).toBeInstanceOf(NotesV1WriteError);
    expect((error as NotesV1WriteError).errorType).toBeUndefined();
    expect((error as NotesV1WriteError).message).toBe(
      '%notes error: not-authorized'
    );
  });

  test('renameNote / moveNote / deleteNote send metadata-only or no body', async () => {
    await notesV1.renameNote({
      flag: 'notes/~zod/blog',
      noteId: 12,
      title: 'T',
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes/12',
      'PUT',
      { title: 'T' }
    );
    await notesV1.moveNote({ flag: 'notes/~zod/blog', noteId: 12, folder: 3 });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes/12',
      'PUT',
      { folder: 3 }
    );
    await notesV1.deleteNote({ flag: 'notes/~zod/blog', noteId: 12 });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/notes/12',
      'DELETE'
    );
  });

  test('folder writes send folderName and explicit recursive query', async () => {
    await notesV1.createFolder({
      flag: 'notes/~zod/blog',
      name: 'Drafts',
      parent: 3,
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/folders',
      'POST',
      { folderName: 'Drafts', parent: 3 }
    );
    await notesV1.createFolder({ flag: 'notes/~zod/blog', name: 'Drafts' });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/folders',
      'POST',
      { folderName: 'Drafts' }
    );
    await notesV1.renameFolder({
      flag: 'notes/~zod/blog',
      folderId: 4,
      name: 'A',
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/folders/4',
      'PUT',
      { folderName: 'A' }
    );
    await notesV1.deleteFolder({
      flag: 'notes/~zod/blog',
      folderId: 4,
      recursive: false,
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/folders/4?recursive=false',
      'DELETE'
    );
    await notesV1.deleteFolder({
      flag: 'notes/~zod/blog',
      folderId: 4,
      recursive: true,
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      '/notes/~/v1/notebooks/~zod/blog/folders/4?recursive=true',
      'DELETE'
    );
  });

  test('void writes require an envelope body and reject error/pending/unexpected', async () => {
    const renameNote = () =>
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 1, title: 'x' });

    // A missing, null, array, or primitive body is a protocol violation, not
    // a shape to tolerate. `res?.body` is read before any shape test, so a
    // top-level object with no `body` key reports an undefined body rather
    // than an undefined body.type.
    const malformed: { response: unknown; expected: RegExp }[] = [
      { response: undefined, expected: /write response body: undefined/ },
      {
        response: { requestId: '0v1' },
        expected: /write response body: undefined/,
      },
      { response: { body: null }, expected: /write response body: null/ },
      { response: { body: [] }, expected: /write response body: \[\]/ },
      { response: { body: 'ok' }, expected: /write response body: "ok"/ },
      {
        response: { body: { id: 5, folderName: 'Drafts' } },
        expected:
          /write response body\.type: undefined \(body: {"id":5,"folderName":"Drafts"}\)/,
      },
      {
        response: { body: { type: 'mystery' } },
        expected: /Unexpected %notes response type: "mystery"/,
      },
      {
        response: { body: { type: 'api-key' } },
        expected: /Unexpected %notes response type: "api-key"/,
      },
    ];
    for (const { response, expected } of malformed) {
      requestJsonMock.mockResolvedValue(response);
      await expect(renameNote()).rejects.toThrow(expected);
    }

    // ok / no-change / notebook are the accepted write outcomes.
    for (const body of [
      { type: 'ok' },
      { type: 'no-change' },
      { type: 'notebook', notebook: { host: '~zod', flagName: 'blog' } },
    ]) {
      requestJsonMock.mockResolvedValue({ body });
      await expect(renameNote()).resolves.toBeNull();
    }

    requestJsonMock.mockResolvedValue({
      body: { type: 'error', message: ['nope'] },
    });
    await expect(renameNote()).rejects.toBeInstanceOf(NotesV1WriteError);

    requestJsonMock.mockResolvedValue({ body: { type: 'pending' } });
    await expect(renameNote()).rejects.toBeInstanceOf(NotesV1PendingWriteError);
  });

  test('pending note and folder writes point at affected objects structurally', async () => {
    requestJsonMock.mockResolvedValue({
      requestId: '0vobj',
      body: { type: 'pending' },
    });

    const noteError = await rejectionError(
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 12, title: 'x' })
    );
    expect(noteError).toBeInstanceOf(NotesV1PendingWriteError);
    const pendingNote = noteError as NotesV1PendingWriteError;
    expect(pendingNote.requestId).toBe('0vobj');
    expect(pendingNote.status).toBeUndefined();
    expect(pendingNote.checks).toEqual([
      { type: 'note-detail', nest: 'notes/~zod/blog', noteId: 12 },
    ]);
    expect(pendingErrorStrings(pendingNote)).not.toContain('tlon notes');

    const folderError = await rejectionError(
      notesV1.renameFolder({ flag: 'notes/~zod/blog', folderId: 4, name: 'x' })
    );
    expect(folderError).toBeInstanceOf(NotesV1PendingWriteError);
    const pendingFolder = folderError as NotesV1PendingWriteError;
    expect(pendingFolder.checks).toEqual([
      { type: 'folder-detail', nest: 'notes/~zod/blog', folderId: 4 },
    ]);
    expect(pendingErrorStrings(pendingFolder)).not.toContain('tlon notes');
  });

  test('void writes report empty error envelopes with fallback detail', async () => {
    requestJsonMock.mockResolvedValue({
      body: { type: 'error', message: ['  '] },
    });

    await expect(
      notesV1.updateNoteBody({
        flag: 'notes/~zod/blog',
        noteId: 1,
        body: 'x',
        expectedRevision: 0,
      })
    ).rejects.toThrow(
      '%notes error: backend returned an error without details'
    );
  });

  test('transport errors include HTTP status even with an empty response body', async () => {
    requestJsonMock.mockRejectedValue(new BadResponseError(404, ''));

    await expect(notesV1.getNotebook('notes/~zod/missing')).rejects.toThrow(
      'HTTP 404'
    );
  });
});

describe('notebook delete helpers', () => {
  test('deleteNotesNotebookStrict propagates failures and normalizes targets', async () => {
    pokeMock.mockRejectedValue(new Error('boom'));
    await expect(deleteNotesNotebookStrict('notes/~zod/blog')).rejects.toThrow(
      'boom'
    );
    pokeMock.mockResolvedValue(undefined);
    await deleteNotesNotebookStrict({ host: 'zod', name: 'blog' });
    expect(pokeMock).toHaveBeenLastCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: { type: 'notebook', flag: '~zod/blog', action: { type: 'delete' } },
    });
  });

  test('deleteNotesNotebookBestEffort swallows failures', async () => {
    pokeMock.mockRejectedValue(new Error('boom'));
    await expect(
      deleteNotesNotebookBestEffort('~zod/blog')
    ).resolves.toBeUndefined();
  });
});

describe('publish helpers', () => {
  test('notes facade lists and updates published notes through %notes', async () => {
    scryMock.mockResolvedValue([{ host: '~zod', flagName: 'blog', noteId: 3 }]);

    await expect(notes.listPublished()).resolves.toEqual([
      { host: '~zod', flagName: 'blog', noteId: 3 },
    ]);
    expect(scryMock).toHaveBeenCalledWith({
      app: 'notes',
      path: '/v0/published',
    });

    await notes.publishNote({
      flag: 'notes/~zod/blog',
      noteId: 3,
      html: '<p>Hello</p>',
    });
    expect(pokeMock).toHaveBeenLastCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag: '~zod/blog',
        action: {
          type: 'note',
          id: 3,
          action: { type: 'publish', html: '<p>Hello</p>' },
        },
      },
    });

    await notes.unpublishNote({
      flag: { host: 'zod', name: 'blog' },
      noteId: 3,
    });
    expect(pokeMock).toHaveBeenLastCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag: '~zod/blog',
        action: {
          type: 'note',
          id: 3,
          action: { type: 'unpublish' },
        },
      },
    });
  });
});

describe('join/leave channel membership go through %notes', () => {
  test('joinNotesChannel / leaveNotesChannel poke %notes actions', async () => {
    await joinNotesChannel('notes/~zod/blog');
    expect(pokeMock).toHaveBeenLastCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: { type: 'join', ship: '~zod', name: 'blog' },
    });
    await leaveNotesChannel('notes/~zod/blog');
    expect(pokeMock).toHaveBeenLastCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: { type: 'leave', ship: '~zod', name: 'blog' },
    });
  });
});

// ---------------------------------------------------------------------------
// Batch-import
// ---------------------------------------------------------------------------

describe('batchImportNotesV1', () => {
  // The import pre-flights a GET of the notebook's folders (the backend's
  // se-batch-import does not resolve the folder id itself; TLON-6307), so
  // every test that reaches the POST must serve the folders listing too.
  const mockFoldersThenImport = (
    importResponse: unknown,
    folderIds: number[] = [3, 7]
  ) => {
    requestJsonMock.mockImplementation((_path: string, method: string) =>
      method === 'GET'
        ? Promise.resolve(
            folderIds.map((id) => ({
              id,
              name: `folder-${id}`,
              parentFolderId: null,
            }))
          )
        : Promise.resolve(importResponse)
    );
  };

  test('is registered on the notesV1 and notes API objects', () => {
    expect(notesV1.batchImport).toBe(batchImportNotesV1);
    expect(notes.batchImport).toBe(notesV1.batchImport);
  });

  test('sends exact envelope shape with string flag, caller requestId, and non-zero folder', async () => {
    mockFoldersThenImport({
      requestId: '0v1',
      body: { type: 'ok' },
    });

    const result = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 7,
      notes: [
        { title: 'Note A', body: 'body-a' },
        { title: 'Note B', body: 'body-b' },
      ],
      requestId: '0v1',
    });

    expect(result).toBe('0v1');

    // The fourth argument is the whole of the reauth contract notesApi owns;
    // replaying the POST on 401/403 is requestJson's behavior, covered in
    // src/__tests__/requestJson.test.ts.
    expect(requestJsonMock).toHaveBeenCalledWith(
      '/notes/~/v1',
      'POST',
      {
        requestId: '0v1',
        action: {
          type: 'notebook',
          flag: '~zod/blog',
          action: {
            type: 'batch-import',
            folder: 7,
            notes: [
              { title: 'Note A', body: 'body-a' },
              { title: 'Note B', body: 'body-b' },
            ],
          },
        },
      },
      { reauthStatuses: [401, 403] }
    );

    // The folders pre-flight runs before the POST and shares the import's
    // reauth policy (%notes v1 reads 401 on expired sessions).
    expect(requestJsonMock.mock.calls[0][0]).toBe(
      '/notes/~/v1/notebooks/~zod/blog/folders'
    );
    expect(requestJsonMock.mock.calls[0][1]).toBe('GET');
    expect(requestJsonMock.mock.calls[0][3]).toEqual({
      reauthStatuses: [401, 403],
    });
    const sent = requestJsonMock.mock.calls[1][2];
    expect(sent.action.flag).toBe('~zod/blog');
    expect(typeof sent.action.flag).toBe('string');
    expect(sent.action.action.folder).toBe(7);
  });

  test('returns server-reported requestId so caller can assert match', async () => {
    mockFoldersThenImport({
      requestId: '0v3',
      body: { type: 'ok' },
    });

    const result = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 3,
      notes: [],
      requestId: '0v2',
    });

    expect(result).toBe('0v3');
  });

  test('throws when server omits requestId', async () => {
    mockFoldersThenImport({ body: { type: 'ok' } });

    await expect(
      batchImportNotesV1({
        flag: '~zod/blog',
        folder: 3,
        notes: [],
        requestId: '0v1',
      })
    ).rejects.toThrow(/missing requestId/);
  });

  // Malformed envelope bodies are assertWriteOk's job now; its full table
  // lives in 'void writes require an envelope body ...' above. This only pins
  // that batch import delegates to it.
  test('delegates envelope validation to assertWriteOk', async () => {
    mockFoldersThenImport({ requestId: '0v1', body: 'ok' });

    await expect(
      batchImportNotesV1({
        flag: '~zod/blog',
        folder: 3,
        notes: [],
        requestId: '0v1',
      })
    ).rejects.toThrow(/Unexpected %notes write response body: "ok"/);
  });

  test('throws on error envelope', async () => {
    mockFoldersThenImport({
      requestId: '0v1',
      body: { type: 'error', errorType: 'not-found', message: [] },
    });

    const err = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 3,
      notes: [],
      requestId: '0v1',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(NotesV1WriteError);
    expect(err.message).toMatch(/not-found/);
  });

  test('rejects an unknown destination folder before submitting', async () => {
    mockFoldersThenImport({ requestId: '0v1', body: { type: 'ok' } }, [1, 2]);

    const err = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 7,
      notes: [{ title: 'Note A', body: 'body-a' }],
      requestId: '0v1',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(NotesUnknownFolderError);
    expect(err.message).toBe('%notes folder 7 does not exist in ~zod/blog');
    expect(err.folderId).toBe(7);
    expect(err.flag).toBe('~zod/blog');
    // The pre-flight GET is the only request; nothing was submitted.
    expect(requestJsonMock.mock.calls.map((c: any[]) => c[1])).toEqual(['GET']);
  });

  test('rejects non-@uv requestId before fetching', async () => {
    const err = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 3,
      notes: [],
      requestId: 'req-42',
    }).catch((e) => e);
    expect(err).toBeInstanceOf(NotesInvalidRequestIdError);
    expect(err.message).toMatch(/req-42/);
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  test('rejects zero @uv requestId before fetching', async () => {
    const err = await batchImportNotesV1({
      flag: '~zod/blog',
      folder: 3,
      notes: [],
      requestId: '0v0',
    }).catch((e) => e);

    expect(err).toBeInstanceOf(NotesInvalidRequestIdError);
    expect(err.message).toMatch(/non-zero/);
    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});
