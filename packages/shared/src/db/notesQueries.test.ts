import { expect, test } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';

setupDatabaseTestSuite();

const notebookFlag = '~zod/native-notes';

function makeNotebook(
  overrides: Partial<db.NotesNotebook> = {}
): db.NotesNotebook {
  return {
    id: notebookFlag,
    host: '~zod',
    flagName: 'native-notes',
    notebookId: 1,
    title: 'Native notes',
    visibility: 'private',
    rootFolderId: 1,
    createdBy: '~zod',
    createdAt: 100,
    updatedBy: '~zod',
    updatedAt: 100,
    syncedAt: 100,
    lastOpenedAt: null,
    currentUserRole: 'owner',
    ...overrides,
  };
}

function makeFolder(
  folderId: number,
  name: string,
  parentFolderId: number | null
): db.NotesFolder {
  return {
    id: `${notebookFlag}/folder/${folderId}`,
    notebookFlag,
    folderId,
    notebookId: 1,
    name,
    parentFolderId,
    createdBy: '~zod',
    createdAt: folderId,
    updatedBy: '~zod',
    updatedAt: folderId,
    syncedAt: 100,
  };
}

function makeNote(
  noteId: number,
  folderId: number,
  title: string
): db.NotesNote {
  return {
    id: `${notebookFlag}/note/${noteId}`,
    notebookFlag,
    noteId,
    notebookId: 1,
    folderId,
    title,
    slug: null,
    bodyMd: `${title} body`,
    createdBy: '~zod',
    createdAt: noteId,
    updatedBy: '~zod',
    updatedAt: noteId,
    revision: 1,
    syncedAt: 100,
  };
}

test('saveNotesNotebookSnapshot replaces stale folders, notes, and members', async () => {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotebook({ title: 'Before' }),
    folders: [makeFolder(1, '/', null), makeFolder(2, 'Old folder', 1)],
    notes: [makeNote(1, 2, 'Old note')],
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
    notebook: makeNotebook({ title: 'After', updatedAt: 200 }),
    folders: [makeFolder(1, '/', null), makeFolder(3, 'New folder', 1)],
    notes: [makeNote(2, 3, 'New note')],
    members: [
      {
        notebookFlag,
        contactId: '~new-member',
        role: 'editor',
        syncedAt: 200,
      },
    ],
  });

  await expect(
    db.getNotesNotebook({ notebookFlag })
  ).resolves.toMatchObject({
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
