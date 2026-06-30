import { expect, test } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';
import {
  makeNotesFolder,
  makeNotesNote,
  makeNotesNotebook,
  testNotebookFlag as notebookFlag,
} from '../test/notesFixtures';

setupDatabaseTestSuite();

test('saveNotesNotebookSnapshot replaces stale folders, notes, and members', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ title: 'Before' }),
    folders: [
      makeNotesFolder(1, '/', null),
      makeNotesFolder(2, 'Old folder', 1),
    ],
    notes: [makeNotesNote(1, 2, 'Old note')],
    members: [
      {
        notebookFlag,
        contactId: '~old-member',
        role: 'viewer',
        syncedAt: 100,
      },
    ],
  });

  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ title: 'After', updatedAt: 200 }),
    folders: [
      makeNotesFolder(1, '/', null),
      makeNotesFolder(3, 'New folder', 1),
    ],
    notes: [makeNotesNote(2, 3, 'New note')],
    members: [
      {
        notebookFlag,
        contactId: '~new-member',
        role: 'editor',
        syncedAt: 200,
      },
    ],
  });

  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    title: 'After',
    updatedAt: 200,
  });
  await expect(db.getNotesFolders({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ folderId: 1, name: '/' }),
    expect.objectContaining({ folderId: 3, name: 'New folder' }),
  ]);
  await expect(db.getNotesNotes({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ noteId: 2, title: 'New note' }),
  ]);
  await expect(db.getNotesMembers({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ contactId: '~new-member', role: 'editor' }),
  ]);
});

test('saveNotesNotebookSnapshot preserves local notebook open time', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ lastOpenedAt: 150 }),
    folders: [makeNotesFolder(1, '/', null)],
    notes: [],
    members: [],
  });

  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ title: 'After', lastOpenedAt: null }),
    folders: [makeNotesFolder(1, '/', null)],
    notes: [],
    members: [],
  });

  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    title: 'After',
    lastOpenedAt: 150,
  });
});

test('saveNotesNotebookSnapshot stores multiple roles for one notes member', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook(),
    folders: [makeNotesFolder(1, '/', null)],
    notes: [],
    members: [
      {
        notebookFlag,
        contactId: '~multi-role',
        role: 'editor',
        syncedAt: 100,
      },
      {
        notebookFlag,
        contactId: '~multi-role',
        role: 'viewer',
        syncedAt: 100,
      },
    ],
  });

  await expect(db.getNotesMembers({ notebookFlag })).resolves.toMatchObject([
    expect.objectContaining({ contactId: '~multi-role', role: 'editor' }),
    expect.objectContaining({ contactId: '~multi-role', role: 'viewer' }),
  ]);
});

test('deleteNotesFolders removes folders and notes in those folders', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook(),
    folders: [
      makeNotesFolder(1, '/', null),
      makeNotesFolder(2, 'Projects', 1),
      makeNotesFolder(3, 'Archive', 1),
      makeNotesFolder(4, 'Backlog', 2),
    ],
    notes: [
      makeNotesNote(1, 1, 'Root note'),
      makeNotesNote(2, 2, 'Project note'),
      makeNotesNote(3, 4, 'Backlog note'),
      makeNotesNote(4, 3, 'Archive note'),
    ],
    members: [],
  });

  await db.deleteNotesFolders({
    notebookFlag,
    folderIds: [2, 4],
  });

  const folders = await db.getNotesFolders({ notebookFlag });
  const notes = await db.getNotesNotes({ notebookFlag });

  expect(folders.map((folder) => folder.folderId).sort()).toEqual([1, 3]);
  expect(notes.map((note) => note.noteId).sort()).toEqual([1, 4]);
});

test('deleteNotesNotebook removes child rows explicitly', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook(),
    folders: [makeNotesFolder(1, '/', null), makeNotesFolder(2, 'Projects', 1)],
    notes: [makeNotesNote(1, 2, 'Project note')],
    members: [
      {
        notebookFlag,
        contactId: '~member',
        role: 'editor',
        syncedAt: 100,
      },
    ],
  });

  await db.deleteNotesNotebook(notebookFlag);

  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toBeNull();
  await expect(db.getNotesFolders({ notebookFlag })).resolves.toEqual([]);
  await expect(db.getNotesNotes({ notebookFlag })).resolves.toEqual([]);
  await expect(db.getNotesMembers({ notebookFlag })).resolves.toEqual([]);
});
