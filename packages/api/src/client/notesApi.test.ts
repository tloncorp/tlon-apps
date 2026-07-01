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
  NotesV1PendingWriteError,
  createNotesNote,
  deleteNotesNotebook,
  deleteNotesNotebookBestEffort,
  deleteNotesNotebookStrict,
  formatNotesFlag,
  joinNotesChannel,
  leaveNotesChannel,
  listNotesNotebooks,
  normalizeNotesTarget,
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
    scry: vi.fn(),
    requestJson: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
});

const pokeMock = poke as unknown as Mock;
const scryMock = scry as unknown as Mock;
const requestJsonMock = requestJson as unknown as Mock;
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
  scryMock.mockResolvedValue([]);
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

describe('v0 surface preserves #5990 scry/poke semantics', () => {
  test('listNotesNotebooks scries /v0/notebooks', async () => {
    scryMock.mockResolvedValue([{ host: '~zod' }]);
    const result = await listNotesNotebooks();
    expect(scryMock).toHaveBeenCalledWith({
      app: 'notes',
      path: '/v0/notebooks',
    });
    expect(result).toEqual([{ host: '~zod' }]);
  });

  test('createNotesNote pokes a %notes notebook action (not %channels, not v1)', async () => {
    await createNotesNote({
      flag: '~zod/blog',
      folder: 3,
      title: 'T',
      body: 'B',
    });
    expect(requestJsonMock).not.toHaveBeenCalled();
    expect(pokeMock).toHaveBeenCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag: '~zod/blog',
        action: { type: 'create-note', folder: 3, title: 'T', body: 'B' },
      },
    });
  });

  test('stream helpers subscribe to /v0/.../stream and pass unsubscribe through', async () => {
    subscribeMock.mockResolvedValue(7);
    const handler = vi.fn();
    const id = await subscribeToNotesNotebook('~zod/blog', handler);
    expect(subscribeMock).toHaveBeenCalledWith(
      { app: 'notes', path: '/v0/notes/~zod/blog/stream' },
      handler
    );
    expect(id).toBe(7);

    await unsubscribeFromNotesNotebook(7);
    expect(unsubscribeMock).toHaveBeenCalledWith(7);
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
      body: { type: 'error', message: 'target ship is unavailable' },
    });
    await expect(notesV1.getRequest('0verr')).resolves.toEqual({
      requestId: '0verr',
      body: { type: 'error', message: 'target ship is unavailable' },
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

describe('notesV1 writes send pinned v1 HTTP bodies', () => {
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
      { type: 'error', message: 'no' },
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
    requestJsonMock.mockResolvedValue({ body: { type: 'error', message: '' } });

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

  test('void writes accept bare/empty success but reject error/pending/unexpected', async () => {
    // bare folder object from a convenience route
    requestJsonMock.mockResolvedValue({ id: 5, folderName: 'Drafts' });
    await expect(
      notesV1.createFolder({ flag: 'notes/~zod/blog', name: 'Drafts' })
    ).resolves.toBeUndefined();
    // empty/undefined
    requestJsonMock.mockResolvedValue(undefined);
    await expect(
      notesV1.deleteNote({ flag: 'notes/~zod/blog', noteId: 1 })
    ).resolves.toBeUndefined();
    // explicit ok envelope
    requestJsonMock.mockResolvedValue({ body: { type: 'ok' } });
    await expect(
      notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 1, title: 'x' })
    ).resolves.toBeUndefined();
    // error / pending / unexpected envelopes reject
    for (const body of [
      { type: 'error', message: 'nope' },
      { type: 'pending' },
      { type: 'api-key' },
    ]) {
      requestJsonMock.mockResolvedValue({ body });
      await expect(
        notesV1.renameNote({ flag: 'notes/~zod/blog', noteId: 1, title: 'x' })
      ).rejects.toThrow();
    }
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
      body: { type: 'error', message: '  ' },
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
  test('legacy deleteNotesNotebook(channelId) is best-effort and swallows failures', async () => {
    pokeMock.mockRejectedValue(new Error('not host'));
    await expect(
      deleteNotesNotebook('notes/~zod/blog')
    ).resolves.toBeUndefined();
    // pokes a %notes notebook-delete action with the ~host/name flag (never a
    // raw flag with host "notes").
    expect(pokeMock).toHaveBeenCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag: '~zod/blog',
        action: { type: 'delete' },
      },
    });
  });

  test('legacy deleteNotesNotebook only acts on an exact notes/<host>/<name> nest', async () => {
    // Bare flag, malformed nest, and over-long note/cite paths all no-op.
    for (const id of [
      '~zod/blog',
      'notes/~zod',
      'notes/~zod/blog/12',
      'notes/~zod/blog/note/12',
      'notes//blog',
    ]) {
      await deleteNotesNotebook(id);
    }
    expect(pokeMock).not.toHaveBeenCalled();

    // The exact nest still deletes.
    await deleteNotesNotebook('notes/~zod/blog');
    expect(pokeMock).toHaveBeenCalledWith({
      app: 'notes',
      mark: 'notes-action',
      json: { type: 'notebook', flag: '~zod/blog', action: { type: 'delete' } },
    });
  });

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
