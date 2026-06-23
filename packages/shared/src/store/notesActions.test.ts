import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import { publishedNotePath } from '../logic';
import { setupDatabaseTestSuite } from '../test/helpers';
import {
  noteIsPublished,
  publishNotebookNote,
  saveNotebookNote,
  unpublishNotebookNote,
} from './notesActions';

setupDatabaseTestSuite();

const notebookFlag = '~zod/native-notes';
const notebookSummary: api.NotesNotebookSummary = {
  host: '~zod',
  flagName: 'native-notes',
  visibility: 'private',
  notebook: {
    id: 1,
    title: 'Native notes',
    createdBy: '~zod',
    createdAt: 100,
    updatedBy: '~zod',
    updatedAt: 100,
  },
};

const rootFolder: db.NotesFolder = {
  id: `${notebookFlag}/folder/2`,
  notebookFlag,
  folderId: 2,
  notebookId: 1,
  name: '/',
  parentFolderId: null,
  createdBy: '~zod',
  createdAt: 100,
  updatedBy: '~zod',
  updatedAt: 100,
  syncedAt: 100,
};

function makeNotebook(): db.NotesNotebook {
  return {
    id: notebookFlag,
    host: '~zod',
    flagName: 'native-notes',
    notebookId: 1,
    title: 'Native notes',
    visibility: 'private',
    rootFolderId: rootFolder.folderId,
    createdBy: '~zod',
    createdAt: 100,
    updatedBy: '~zod',
    updatedAt: 100,
    syncedAt: 100,
    lastOpenedAt: null,
    currentUserRole: 'owner',
  };
}

function makeNote(title: string): db.NotesNote {
  return {
    id: `${notebookFlag}/note/3`,
    notebookFlag,
    noteId: 3,
    notebookId: 1,
    folderId: rootFolder.folderId,
    title,
    slug: null,
    bodyMd: 'body',
    createdBy: '~zod',
    createdAt: 100,
    updatedBy: '~zod',
    updatedAt: 100,
    revision: 1,
    syncedAt: 100,
  };
}

function makeApiFolder(folder: db.NotesFolder): api.NotesFolder {
  return {
    id: folder.folderId,
    notebookId: folder.notebookId,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    createdBy: folder.createdBy ?? '~zod',
    createdAt: folder.createdAt ?? 100,
    updatedBy: folder.updatedBy ?? '~zod',
    updatedAt: folder.updatedAt ?? 100,
  };
}

function makeApiNote(note: db.NotesNote): api.NotesNote {
  return {
    id: note.noteId,
    notebookId: note.notebookId,
    folderId: note.folderId,
    title: note.title,
    slug: note.slug ?? null,
    bodyMd: note.bodyMd,
    createdBy: note.createdBy ?? '~zod',
    createdAt: note.createdAt ?? 100,
    updatedBy: note.updatedBy ?? '~zod',
    updatedAt: note.updatedAt ?? 100,
    revision: note.revision,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('saveNotebookNote preserves an empty title', async () => {
  const note = makeNote('Untitled');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotebook(),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const renamedNote = makeApiNote(makeNote(''));
  vi.spyOn(api, 'getNotesNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api, 'listNotesFolders').mockResolvedValue([
    makeApiFolder(rootFolder),
  ]);
  vi.spyOn(api, 'listNotes').mockResolvedValue([renamedNote]);
  vi.spyOn(api, 'listNotesMembers').mockResolvedValue([]);
  const renameNotesNote = vi.spyOn(api, 'renameNotesNote').mockResolvedValue(1);

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: '',
    body: note.bodyMd,
  });

  expect(renameNotesNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    title: '',
  });
  expect(saved?.title).toBe('');
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({ title: '' });
});

test('publishNotebookNote renders current markdown and marks note published', async () => {
  const publishNotesNote = vi
    .spyOn(api, 'publishNotesNote')
    .mockResolvedValue(1);
  vi.spyOn(api, 'listPublishedNotes').mockResolvedValue([
    { host: '~zod', flagName: 'native-notes', noteId: 3 },
  ]);

  const path = await publishNotebookNote({
    notebookFlag,
    noteId: 3,
    title: 'Public & safe',
    body: 'Hello **world**',
  });

  expect(path).toBe(publishedNotePath(notebookFlag, 3));
  expect(publishNotesNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: 3,
    html: expect.stringContaining('<strong>world</strong>'),
  });
  expect(publishNotesNote.mock.calls[0]?.[0].html).toContain(
    '<title>Public &amp; safe</title>'
  );
});

test('unpublishNotebookNote waits for the note to leave published records', async () => {
  const unpublishNotesNote = vi
    .spyOn(api, 'unpublishNotesNote')
    .mockResolvedValue(1);
  vi.spyOn(api, 'listPublishedNotes').mockResolvedValue([]);

  await unpublishNotebookNote({ notebookFlag, noteId: 3 });

  expect(unpublishNotesNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: 3,
  });
});

test('noteIsPublished matches published records by note id', () => {
  expect(
    noteIsPublished([{ host: '~zod', flagName: 'native-notes', noteId: 3 }], 3)
  ).toBe(true);
  expect(
    noteIsPublished([{ host: '~zod', flagName: 'native-notes', noteId: 3 }], 4)
  ).toBe(false);
});
