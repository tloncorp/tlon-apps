import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import {
  makeApiNotesFolder,
  makeApiNotesNote,
  makeNotesFolder,
  makeNotesNote,
  makeNotesNotebook,
  testNotebookFlag as notebookFlag,
} from '../test/notesFixtures';
import {
  createNotebookNote,
  saveNotebookNote,
  syncNotesNotebook,
} from './notesActions';

setupDatabaseTestSuite();

const notebookSummary: api.NotesV1NotebookDetailSummary = {
  host: '~zod',
  flagName: 'native-notes',
  visibility: 'private',
  notebook: {
    id: 1,
    title: 'Native notes',
    rootFolderId: 2,
    createdBy: '~zod',
    createdAt: 100,
    updatedBy: '~zod',
    updatedAt: 100,
  },
};

const rootFolder = makeNotesFolder(2, '/', null);

function makeNote(title: string): db.NotesNote {
  return makeNotesNote(3, rootFolder.folderId, title, {
    bodyMd: 'body',
    createdAt: 100,
    updatedAt: 100,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('saveNotebookNote preserves an empty title', async () => {
  const note = makeNote('Untitled');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const renamedNote = makeApiNotesNote(makeNote(''));
  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([renamedNote]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  const renameNote = vi
    .spyOn(api.notesV1, 'renameNote')
    .mockResolvedValue(undefined);

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: '',
    body: note.bodyMd,
  });

  expect(renameNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    title: '',
  });
  expect(saved?.title).toBe('');
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({ title: '' });
});

test('syncNotesNotebook preserves cached members when member sync fails', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({
      rootFolderId: rootFolder.folderId,
      currentUserRole: 'editor',
    }),
    folders: [rootFolder],
    notes: [],
    members: [
      {
        notebookFlag,
        contactId: '~zod',
        role: 'editor',
        syncedAt: 100,
      },
    ],
  });

  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([]);
  vi.spyOn(api.notesV1, 'listMembers').mockRejectedValue(
    new Error('member sync failed')
  );

  await syncNotesNotebook(notebookFlag);

  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    currentUserRole: 'editor',
  });
  await expect(db.getNotesMembers({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ contactId: '~zod', role: 'editor' }),
  ]);
});

test('createNotebookNote uses a fresh baseline before finding the created note', async () => {
  const cachedNote = makeNote('Cached note');
  const staleRemoteNote = makeNotesNote(4, rootFolder.folderId, 'Stale remote');
  const createdNote = makeNotesNote(5, rootFolder.folderId, 'Created note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [cachedNote],
    members: [],
  });

  let created = false;
  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockImplementation(async () => [
    makeApiNotesNote(staleRemoteNote),
    ...(created ? [makeApiNotesNote(createdNote)] : []),
  ]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notesV1, 'createNote').mockImplementation(async () => {
    created = true;
  });

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: createdNote.title,
  });

  expect(note?.noteId).toBe(createdNote.noteId);
});
