import * as api from '@tloncorp/api';

import * as db from '../db';

export const testNotebookFlag = '~zod/native-notes';
const auditFields = { createdBy: '~zod', updatedBy: '~zod' };
const dbFields = {
  notebookFlag: testNotebookFlag,
  notebookId: 1,
  ...auditFields,
  syncedAt: 100,
};

export function makeNotesNotebook(
  overrides: Partial<db.NotesNotebook> = {}
): db.NotesNotebook {
  return {
    id: testNotebookFlag,
    host: '~zod',
    flagName: 'native-notes',
    notebookId: 1,
    title: 'Native notes',
    visibility: 'private',
    rootFolderId: 1,
    ...auditFields,
    createdAt: 100,
    updatedAt: 100,
    syncedAt: 100,
    lastOpenedAt: null,
    currentUserRole: 'owner',
    ...overrides,
  };
}

export function makeNotesFolder(
  folderId: number,
  name: string,
  parentFolderId: number | null
): db.NotesFolder {
  return {
    ...dbFields,
    id: `${testNotebookFlag}/folder/${folderId}`,
    folderId,
    name,
    parentFolderId,
    createdAt: folderId,
    updatedAt: folderId,
  };
}

export function makeNotesNote(
  noteId: number,
  folderId: number,
  title: string,
  overrides: Partial<db.NotesNote> = {}
): db.NotesNote {
  return {
    ...dbFields,
    id: `${testNotebookFlag}/note/${noteId}`,
    noteId,
    folderId,
    title,
    slug: null,
    bodyMd: `${title} body`,
    createdAt: noteId,
    updatedAt: noteId,
    revision: 1,
    ...overrides,
  };
}

export function makeApiNotesFolder(folder: db.NotesFolder): api.NotesFolder {
  return {
    id: folder.folderId,
    notebookId: folder.notebookId,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    ...auditFields,
    createdAt: folder.createdAt ?? 100,
    updatedAt: folder.updatedAt ?? 100,
  };
}

export function makeApiNotesNote(note: db.NotesNote): api.NotesNote {
  return {
    id: note.noteId,
    notebookId: note.notebookId,
    folderId: note.folderId,
    title: note.title,
    slug: note.slug ?? null,
    bodyMd: note.bodyMd,
    ...auditFields,
    createdAt: note.createdAt ?? 100,
    updatedAt: note.updatedAt ?? 100,
    revision: note.revision,
  };
}
