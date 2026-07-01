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
  deleteNotebookNote,
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

function makeApiNoteSummary(note: db.NotesNote): api.NotesV1Note {
  return {
    id: note.noteId,
    title: note.title,
  };
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

test('syncNotesNotebook preserves members with no roles', async () => {
  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([
    { ship: '~role-less', roles: [] },
  ]);

  await syncNotesNotebook(notebookFlag);

  await expect(db.getNotesMembers({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ contactId: '~role-less', role: null }),
  ]);
});

test('syncNotesNotebook preserves cached note details when list notes omit them', async () => {
  const childFolder = makeNotesFolder(4, 'Child folder', rootFolder.folderId);
  const cachedNote = makeNotesNote(5, childFolder.folderId, 'Cached note', {
    bodyMd: 'cached body',
    revision: 7,
    slug: 'cached-note',
  });
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder, childFolder],
    notes: [cachedNote],
    members: [],
  });

  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
    makeApiNotesFolder(childFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([
    {
      id: cachedNote.noteId,
      title: 'Remote title',
    },
  ]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);

  await syncNotesNotebook(notebookFlag);

  await expect(
    db.getNotesNote({ notebookFlag, noteId: cachedNote.noteId })
  ).resolves.toMatchObject({
    title: 'Remote title',
    folderId: childFolder.folderId,
    bodyMd: 'cached body',
    revision: 7,
    slug: 'cached-note',
  });
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

test('createNotebookNote does not return an existing note when create sync times out', async () => {
  const existingNote = makeNotesNote(4, rootFolder.folderId, 'Untitled');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [],
    members: [],
  });

  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([
    makeApiNotesNote(existingNote),
  ]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notesV1, 'createNote').mockResolvedValue(undefined);

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: existingNote.title,
  });

  expect(note).toBeNull();
});

test('createNotebookNote hydrates created note details when list notes omit them', async () => {
  const createdNote = makeNotesNote(4, rootFolder.folderId, 'Created note', {
    bodyMd: 'created body',
    revision: 2,
  });
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [],
    members: [],
  });

  let created = false;
  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockImplementation(async () =>
    created ? [makeApiNoteSummary(createdNote)] : []
  );
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notesV1, 'getNote')
    .mockResolvedValue(makeApiNotesNote(createdNote));
  vi.spyOn(api.notesV1, 'createNote').mockImplementation(async () => {
    created = true;
  });

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: createdNote.title,
    body: createdNote.bodyMd,
  });

  expect(getNote).toHaveBeenCalledWith({
    flag: { host: '~zod', name: 'native-notes' },
    noteId: createdNote.noteId,
  });
  expect(note).toMatchObject({
    noteId: createdNote.noteId,
    bodyMd: createdNote.bodyMd,
    revision: createdNote.revision,
  });
});

test('saveNotebookNote hydrates saved note details when list notes omit them', async () => {
  const note = makeNote('Draft note');
  const savedNote = {
    ...note,
    bodyMd: 'updated body',
    revision: note.revision + 1,
  };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockResolvedValue([
    makeApiNoteSummary(savedNote),
  ]);
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notesV1, 'getNote')
    .mockResolvedValue(makeApiNotesNote(savedNote));
  const updateNoteBody = vi
    .spyOn(api.notesV1, 'updateNoteBody')
    .mockResolvedValue(undefined);

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: savedNote.bodyMd,
  });

  expect(updateNoteBody).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    body: savedNote.bodyMd,
    expectedRevision: note.revision,
  });
  expect(getNote).toHaveBeenCalledWith({
    flag: { host: '~zod', name: 'native-notes' },
    noteId: note.noteId,
  });
  expect(saved).toMatchObject({
    bodyMd: savedNote.bodyMd,
    revision: savedNote.revision,
  });
});

test('deleteNotebookNote waits for the deleted note to disappear from sync', async () => {
  const note = makeNote('Delete me');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  let readLagging = false;
  vi.spyOn(api.notesV1, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notesV1, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notesV1, 'listNotes').mockImplementation(async () => {
    if (readLagging) {
      readLagging = false;
      return [makeApiNotesNote(note)];
    }
    return [];
  });
  vi.spyOn(api.notesV1, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notesV1, 'deleteNote').mockImplementation(async () => {
    readLagging = true;
  });

  await deleteNotebookNote({ notebookFlag, noteId: note.noteId });

  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toBeNull();
});
