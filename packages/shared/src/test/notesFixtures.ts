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
    id: folder.id,
    notebookFlag: folder.notebookFlag,
    folderId: folder.folderId,
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
    id: note.id,
    notebookFlag: note.notebookFlag,
    noteId: note.noteId,
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

// Wire shapes, as a write response or stream fact delivers them: `id` rather
// than `noteId`/`folderId`, and no notebookFlag.
export function makeNotesV1Note(note: db.NotesNote): api.NotesV1Note {
  return {
    id: note.noteId,
    notebookId: note.notebookId,
    folderId: note.folderId,
    title: note.title,
    slug: note.slug ?? null,
    bodyMd: note.bodyMd,
    revision: note.revision,
    ...auditFields,
    createdAt: note.createdAt ?? 100,
    updatedAt: note.updatedAt ?? 100,
  };
}

export function makeNoteUpdate(
  type: 'note-created' | 'note-updated',
  note: db.NotesNote
): api.NotesUpdate {
  return { type, noteId: note.noteId, note: makeNotesV1Note(note) };
}

export function makeFolderUpdate(
  type: 'folder-created' | 'folder-updated',
  folder: db.NotesFolder
): api.NotesUpdate {
  return {
    type,
    folderId: folder.folderId,
    folder: {
      id: folder.folderId,
      notebookId: folder.notebookId,
      name: folder.name,
      parentFolderId: folder.parentFolderId ?? null,
      ...auditFields,
      createdAt: folder.createdAt ?? 100,
      updatedAt: folder.updatedAt ?? 100,
    },
  };
}
