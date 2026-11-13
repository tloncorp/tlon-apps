import { afterEach, expect, test, vi } from 'vitest';

import { DurableClient, configureDurableClient } from '../client/durable';
import {
  isNotesV1ConflictError,
  notes,
  subscribeToNotesNotebook,
  unsubscribeFromNotesNotebook,
} from '../client/notesApi';

const channelId = 'notes/~sampel-palnet/book';
const flag = '~sampel-palnet/book';
const base = '/rooms/group-book/notebook';

function fixture() {
  const client = new DurableClient('brian');
  client.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [{ id: 'brian', contactId: '~sampel-palnet', name: 'Brian' }],
    bot: null,
    revision: 1,
    groups: [
      {
        id: '~sampel-palnet/group',
        title: 'Group',
        owner: 'brian',
        members: ['brian'],
        invited: [],
        privacy: 'private',
      },
    ],
    rooms: [
      {
        id: 'group-book',
        channelId,
        title: 'Book',
        members: ['brian'],
        groupId: '~sampel-palnet/group',
        kind: 'channel',
      },
    ],
  };
  configureDurableClient(client);
  return client;
}

const note = {
  id: 3,
  notebookId: 1,
  folderId: 1,
  title: 'Plan',
  slug: null,
  bodyMd: 'Body',
  revision: 1,
  createdBy: '~sampel-palnet',
  createdAt: 1,
  updatedBy: '~sampel-palnet',
  updatedAt: 2,
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('notes channels read their notebook from the room and keep v1 shapes', async () => {
  const client = fixture();
  expect(client.channels()[0]).toMatchObject({ id: channelId, type: 'notes' });
  const request = vi
    .spyOn(client, 'request')
    .mockImplementation(async (path: string) => {
      if (path === base)
        return {
          notebook: { id: 1, title: 'Book', rootFolderId: 1 },
          members: [{ ship: '~sampel-palnet', role: 'owner' }],
        };
      if (path === `${base}/folders`)
        return [{ id: 1, notebookId: 1, name: '/', parentFolderId: null }];
      if (path === `${base}/notes`) return [note];
      throw new Error(`unexpected ${path}`);
    });

  expect(await notes.getNotebook(flag)).toMatchObject({
    id: flag,
    notebookId: 1,
    rootFolderId: 1,
    title: 'Book',
  });
  expect(await notes.listMembers(flag)).toEqual([
    { notebookFlag: flag, contactId: '~sampel-palnet', role: 'owner' },
  ]);
  expect(await notes.listFolders(flag)).toMatchObject([
    { id: `${flag}/folder/1`, folderId: 1, parentFolderId: null },
  ]);
  expect(await notes.listNotes(flag)).toMatchObject([
    { id: `${flag}/note/3`, noteId: 3, bodyMd: 'Body', revision: 1 },
  ]);
  expect(await notes.listNotebooks()).toMatchObject([
    { id: flag, host: '~sampel-palnet', flagName: 'book' },
  ]);
  expect(await notes.listPublished()).toEqual([]);
  expect(request).toHaveBeenCalledTimes(4);
});

test('note writes return the applied note, no-change and typed conflicts', async () => {
  const client = fixture();
  const request = vi.spyOn(client, 'request');
  request.mockResolvedValueOnce({ ...note, revision: 0 });
  expect(
    await notes.createNote({ flag, folder: 1, title: 'Plan', body: 'Body' })
  ).toMatchObject({ id: 3, revision: 0 });
  expect(request).toHaveBeenLastCalledWith(`${base}/notes`, {
    folder: 1,
    title: 'Plan',
    body: 'Body',
  });

  request.mockResolvedValueOnce({ status: 'ok', note });
  expect(
    await notes.updateNoteBody({
      flag,
      noteId: 3,
      body: 'Body',
      expectedRevision: 0,
    })
  ).toEqual({ status: 'ok', note: expect.objectContaining({ revision: 1 }) });

  request.mockResolvedValueOnce({ status: 'no-change', note });
  expect(
    (
      await notes.updateNoteBody({
        flag,
        noteId: 3,
        body: 'Body',
        expectedRevision: 1,
      })
    ).status
  ).toBe('no-change');

  request.mockRejectedValueOnce(
    new Error('Local backend: 409 {"error":"conflict"}')
  );
  const conflict = await notes
    .updateNoteBody({ flag, noteId: 3, body: 'Old', expectedRevision: 0 })
    .catch((error) => error);
  expect(isNotesV1ConflictError(conflict)).toBe(true);

  request.mockResolvedValueOnce({ deleted: true });
  await notes.deleteFolder({ flag, folderId: 4, recursive: true });
  expect(request).toHaveBeenLastCalledWith(`${base}/folders/4`, {
    delete: true,
    recursive: true,
  });
});

test('note history reads every page the local backend serves', async () => {
  const client = fixture();
  const request = vi
    .spyOn(client, 'request')
    .mockResolvedValueOnce({
      revisions: [{ revision: 1, editedAt: 5, author: '~nec', bodyMd: 'b' }],
      nextCursor: 1,
    })
    .mockResolvedValueOnce({
      revisions: [{ revision: 0, editedAt: 4, author: '~nec', bodyMd: 'a' }],
      nextCursor: null,
    });
  expect(await notes.listNoteHistory({ flag, noteId: 3 })).toEqual([
    { revision: 1, editedAt: 5, author: '~nec', bodyMd: 'b' },
    { revision: 0, editedAt: 4, author: '~nec', bodyMd: 'a' },
  ]);
  expect(request).toHaveBeenLastCalledWith(`${base}/notes/3/history?before=1`);
});

test('notebook search hands the local cursor back as a number', async () => {
  const client = fixture();
  const request = vi
    .spyOn(client, 'request')
    .mockResolvedValueOnce({ notes: [note], nextCursor: 'opaque' })
    .mockResolvedValueOnce({ notes: [], nextCursor: null });
  const first = await notes.searchNotes({ flag, needle: 'plan' });
  expect(first.last).not.toBe(0);
  expect(first.notes).toMatchObject([{ noteId: 3 }]);
  const second = await notes.searchNotes({
    flag,
    needle: 'plan',
    from: first.last,
  });
  expect(second.last).toBe(0);
  expect(request).toHaveBeenLastCalledWith(
    `${base}/search?needle=plan&cursor=opaque`
  );
});

test('only a stale note revision becomes a conflict', async () => {
  const client = fixture();
  vi.spyOn(client, 'request').mockRejectedValueOnce(
    new Error('Local backend: 409 {"error":"Folder is not empty"}')
  );
  const error = await notes
    .deleteFolder({ flag, folderId: 4, recursive: false })
    .catch((error) => error);
  expect(isNotesV1ConflictError(error)).toBe(false);
  expect(error.message).toContain('Folder is not empty');
});

test('group notebooks are created as notes channels and stream room events', async () => {
  const client = fixture();
  const directory = vi.spyOn(client, 'directory').mockResolvedValue({});
  const created = await notes.createGroupNotebook({
    title: 'Plans',
    group: { host: '~sampel-palnet', flagName: 'group' },
    readers: ['crew'],
  });
  expect(created).toMatchObject({ host: '~sampel-palnet', title: 'Plans' });
  expect(directory).toHaveBeenCalledWith({
    type: 'createChannel',
    groupId: '~sampel-palnet/group',
    id: `notes/~sampel-palnet/${created.flagName}`,
    title: 'Plans',
    readers: ['crew'],
  });

  const stream = {
    onmessage: null,
    onopen: null,
    onerror: null,
    close: vi.fn(),
  };
  vi.spyOn(client, 'events').mockReturnValue(stream);
  const handler = vi.fn();
  const id = await subscribeToNotesNotebook(flag, handler);
  expect(client.events).toHaveBeenCalledWith('group-book');
  (stream.onmessage as unknown as () => void)();
  expect(handler).toHaveBeenCalledWith({
    type: 'update',
    host: '~sampel-palnet',
    flagName: 'book',
  });
  await unsubscribeFromNotesNotebook(id);
  expect(stream.close).toHaveBeenCalled();
});
