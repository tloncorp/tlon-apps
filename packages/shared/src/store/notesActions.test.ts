import * as api from '@tloncorp/api';
import { afterEach, expect, test, vi } from 'vitest';

import * as db from '../db';
import { useDebugStore } from '../debug';
import { AnalyticsEvent } from '../domain';
import { publishedNotePath, publishedNoteUrl } from '../logic';
import { setupDatabaseTestSuite } from '../test/helpers';
import {
  makeApiNotesFolder,
  makeApiNotesNote,
  makeFolderUpdate,
  makeNoteUpdate,
  makeNotesFolder,
  makeNotesNote,
  makeNotesNotebook,
  testNotebookFlag as notebookFlag,
} from '../test/notesFixtures';
import {
  NotesNoteConflictError,
  adoptNotebookNoteRemote,
  applyNotesUpdate,
  createNotebookFolder,
  createNotebookNote,
  deleteNotebookFolder,
  deleteNotebookNote,
  importNotebookTree,
  moveNotebookNote,
  noteIsPublished,
  publishNotebookNote,
  renameNotebookFolder,
  saveNotebookNote,
  syncNotesNotebook,
  unpublishNotebookNote,
} from './notesActions';

setupDatabaseTestSuite();

const notebookSummary: api.NotesNotebookDetail = {
  id: notebookFlag,
  host: '~zod',
  flagName: 'native-notes',
  notebookId: 1,
  title: 'Native notes',
  visibility: 'private',
  rootFolderId: 2,
  createdBy: '~zod',
  createdAt: 100,
  updatedBy: '~zod',
  updatedAt: 100,
};

const rootFolder = makeNotesFolder(2, '/', null);

function makeNote(title: string): db.NotesNote {
  return makeNotesNote(3, rootFolder.folderId, title, {
    bodyMd: 'body',
    createdAt: 100,
    updatedAt: 100,
  });
}

function makeApiNoteSummary(note: db.NotesNote): api.NotesNote {
  return {
    id: note.id,
    notebookFlag,
    noteId: note.noteId,
    title: note.title,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  useDebugStore.setState({ errorLogger: null });
});

test('saveNotebookNote preserves an empty title', async () => {
  const note = makeNote('Untitled');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const renameNote = vi.spyOn(api.notes, 'renameNote').mockResolvedValue(null);

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

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([]);
  vi.spyOn(api.notes, 'listMembers').mockRejectedValue(
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
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([
    { notebookFlag, contactId: '~role-less', role: null },
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

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
    makeApiNotesFolder(childFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    { ...makeApiNoteSummary(cachedNote), title: 'Remote title' },
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);

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

test('createNotebookNote persists the created note from the write response alone', async () => {
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

  const listNotes = vi.spyOn(api.notes, 'listNotes');
  const getNote = vi.spyOn(api.notes, 'getNote');
  vi.spyOn(api.notes, 'createNote').mockResolvedValue(
    makeNoteUpdate('note-created', createdNote)
  );

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: createdNote.title,
    body: createdNote.bodyMd,
  });

  expect(note).toMatchObject({
    noteId: createdNote.noteId,
    title: createdNote.title,
    bodyMd: createdNote.bodyMd,
    revision: createdNote.revision,
  });
  // The whole point: no read-back of any kind.
  expect(listNotes).not.toHaveBeenCalled();
  expect(getNote).not.toHaveBeenCalled();
});

test('createNotebookNote does not return a same-titled existing note when the response carries no update', async () => {
  const existingNote = makeNotesNote(4, rootFolder.folderId, 'Untitled');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [existingNote],
    members: [],
  });

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(existingNote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'createNote').mockResolvedValue(null);

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: existingNote.title,
  });

  expect(note).toBeNull();
});

test('createNotebookNote falls back to sync when the response carries no update', async () => {
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

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(createdNote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'createNote').mockResolvedValue(null);

  const note = await createNotebookNote({
    notebookFlag,
    folderId: rootFolder.folderId,
    title: createdNote.title,
    body: createdNote.bodyMd,
  });

  expect(note?.noteId).toBe(createdNote.noteId);
});

test('saveNotebookNote persists sent content from the response contract, no read-back', async () => {
  const note = makeNote('Draft note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const getNote = vi.spyOn(api.notes, 'getNote');
  const listNotes = vi.spyOn(api.notes, 'listNotes');
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockResolvedValue({ status: 'ok', note: null });
  const renameNote = vi.spyOn(api.notes, 'renameNote').mockResolvedValue(null);

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: 'New title',
    body: 'updated body',
  });

  expect(updateNoteBody).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    body: 'updated body',
    expectedRevision: note.revision,
  });
  expect(renameNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    title: 'New title',
  });
  // Successful writes fully determine the result — the save path must not
  // fetch anything to learn what it just wrote.
  expect(getNote).not.toHaveBeenCalled();
  expect(listNotes).not.toHaveBeenCalled();
  expect(saved).toMatchObject({
    title: 'New title',
    bodyMd: 'updated body',
    revision: note.revision + 1,
  });
});

test('saveNotebookNote persists host stamps from write-response payloads', async () => {
  const note = makeNote('Stamped note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const hostStamp = (note.updatedAt ?? 0) + 5_000;
  vi.spyOn(api.notes, 'updateNoteBody').mockResolvedValue({
    status: 'ok',
    note: {
      id: note.noteId,
      title: 'Renamed by host payload',
      bodyMd: 'updated body',
      // Another client's same-revision move rode along on the host row —
      // the payload's folder is authoritative.
      folderId: rootFolder.folderId + 7,
      revision: note.revision + 1,
      updatedAt: hostStamp,
      updatedBy: '~zod',
    },
  });
  vi.spyOn(api.notes, 'renameNote').mockResolvedValue({
    id: note.noteId,
    title: 'Renamed by host payload',
    bodyMd: 'updated body',
    revision: note.revision + 1,
    updatedAt: hostStamp + 1,
    updatedBy: '~zod',
  });

  await saveNotebookNote({
    notebookFlag,
    note,
    title: 'Renamed by host payload',
    body: 'updated body',
  });

  // The row carries the host's stamps, so the snapshot merge's
  // equal-revision tiebreak defends this write against a stale snapshot
  // already in flight (which is exactly how a rename-only save would
  // otherwise get reverted).
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    title: 'Renamed by host payload',
    bodyMd: 'updated body',
    folderId: rootFolder.folderId + 7,
    revision: note.revision + 1,
    updatedAt: hostStamp + 1,
    updatedBy: '~zod',
  });
});

test('saveNotebookNote treats a conflict as applied when the host already has our content', async () => {
  const note = makeNote('Flushed note');
  const body = 'flushed body';
  const hostNote = { ...note, bodyMd: body, revision: note.revision + 1 };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(hostNote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'getNote').mockResolvedValue(makeApiNotesNote(hostNote));
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockRejectedValue(
      new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
    );

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body,
  });

  expect(updateNoteBody).toHaveBeenCalledTimes(1);
  expect(saved).toMatchObject({ bodyMd: body, revision: hostNote.revision });
});

test('saveNotebookNote rebases onto its own previous save and retries once', async () => {
  const note = makeNote('Evolving note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const firstBody = 'first draft';
  const firstSaved = {
    ...note,
    bodyMd: firstBody,
    revision: note.revision + 1,
  };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  const listNotes = vi
    .spyOn(api.notes, 'listNotes')
    .mockResolvedValue([makeApiNotesNote(firstSaved)]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notes, 'getNote')
    .mockResolvedValue(makeApiNotesNote(firstSaved));
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockResolvedValue({ status: 'ok', note: null });

  // Save 1 lands `firstBody` at revision + 1 on the host.
  await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: firstBody,
  });

  // Save 2 is issued from a stale base (the editor never learned save 1's
  // revision). The host rejects it as a conflict; the recovery recognizes
  // the host content as our own previous save and retries rebased.
  const secondBody = 'first draft plus more typing';
  const secondSaved = {
    ...note,
    bodyMd: secondBody,
    revision: firstSaved.revision + 1,
  };
  updateNoteBody
    .mockRejectedValueOnce(
      new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
    )
    .mockResolvedValueOnce({ status: 'ok', note: null });
  listNotes.mockResolvedValue([makeApiNotesNote(secondSaved)]);
  getNote.mockResolvedValue(makeApiNotesNote(firstSaved));

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: secondBody,
  });

  expect(updateNoteBody).toHaveBeenLastCalledWith({
    flag: notebookFlag,
    noteId: note.noteId,
    body: secondBody,
    expectedRevision: firstSaved.revision,
  });
  expect(saved).toMatchObject({
    bodyMd: secondBody,
    revision: secondSaved.revision,
  });
});

test('saveNotebookNote keeps the local revision when the host reports no-change', async () => {
  const note = makeNote('Converging note');
  const body = 'body already on host';
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  // The host body already matched, so the revision was NOT bumped.
  vi.spyOn(api.notes, 'updateNoteBody').mockResolvedValue({
    status: 'no-change',
    note: null,
  });

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body,
  });

  // Persisting expected + 1 here would leave the local DB one revision
  // ahead of the host and wedge the next save on a phantom conflict.
  expect(saved).toMatchObject({ bodyMd: body, revision: note.revision });
});

test('saveNotebookNote does not auto-rebase over a remote revert to our old content', async () => {
  const note = makeNote('Reverted note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const firstBody = 'our earlier save';
  const firstSaved = {
    ...note,
    bodyMd: firstBody,
    revision: note.revision + 1,
  };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(firstSaved),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notes, 'getNote')
    .mockResolvedValue(makeApiNotesNote(firstSaved));
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockResolvedValue({ status: 'ok', note: null });

  // Save 1 seeds the last-saved cache with firstBody at revision + 1.
  await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: firstBody,
  });

  // Meanwhile other edits landed and someone restored our old content via
  // note history: same bytes as our cached save, but at a later revision.
  // That is a genuine conflict — auto-rebasing would silently overwrite
  // the restore.
  const revertedRemote = {
    ...note,
    bodyMd: firstBody,
    revision: firstSaved.revision + 3,
  };
  updateNoteBody.mockRejectedValue(
    new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
  );
  getNote.mockResolvedValue(makeApiNotesNote(revertedRemote));

  const attempt = saveNotebookNote({
    notebookFlag,
    note: firstSaved,
    title: note.title,
    body: 'draft typed after our save',
  });

  await expect(attempt).rejects.toBeInstanceOf(NotesNoteConflictError);
  // Only the failed initial PUT from save 2 — no rebased retry.
  expect(updateNoteBody).toHaveBeenCalledTimes(2);
});

test('saveNotebookNote surfaces a conflict when the rebased retry races another edit', async () => {
  const note = makeNote('Racing note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const firstBody = 'first draft';
  const firstSaved = {
    ...note,
    bodyMd: firstBody,
    revision: note.revision + 1,
  };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(firstSaved),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notes, 'getNote')
    .mockResolvedValue(makeApiNotesNote(firstSaved));
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockResolvedValue({ status: 'ok', note: null });

  // Save 1 seeds the last-saved cache.
  await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: firstBody,
  });

  // Save 2 conflicts; the recovery fetch matches our own save, but another
  // edit lands between that fetch and the rebased retry, so the retry
  // conflicts too. It must surface the latest remote copy as a typed
  // conflict, not escape as a generic error.
  const racedRemote = {
    ...note,
    bodyMd: 'racing writer content',
    revision: firstSaved.revision + 1,
  };
  const conflict = new api.NotesV1WriteError(
    '%notes error: revision-mismatch',
    'conflict'
  );
  updateNoteBody.mockRejectedValue(conflict);
  getNote
    .mockResolvedValueOnce(makeApiNotesNote(firstSaved))
    .mockResolvedValueOnce(makeApiNotesNote(racedRemote));

  const attempt = saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: 'first draft plus more typing',
  });

  await expect(attempt).rejects.toBeInstanceOf(NotesNoteConflictError);
  await expect(attempt).rejects.toMatchObject({
    remoteNote: expect.objectContaining({
      bodyMd: racedRemote.bodyMd,
      revision: racedRemote.revision,
    }),
  });
});

test('saveNotebookNote surfaces a typed conflict when the host content diverged', async () => {
  const note = makeNote('Contested note');
  const remoteNote = {
    ...note,
    bodyMd: 'someone else rewrote this',
    revision: note.revision + 1,
  };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(remoteNote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'getNote').mockResolvedValue(
    makeApiNotesNote(remoteNote)
  );
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockRejectedValue(
      new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
    );

  const attempt = saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: 'my competing edit',
  });

  await expect(attempt).rejects.toBeInstanceOf(NotesNoteConflictError);
  await expect(attempt).rejects.toMatchObject({
    remoteNote: expect.objectContaining({
      bodyMd: remoteNote.bodyMd,
      revision: remoteNote.revision,
    }),
  });
  expect(updateNoteBody).toHaveBeenCalledTimes(1);
});

test('saveNotebookNote waits out a stale replica before classifying a conflict', async () => {
  const note = makeNote('Laggy replica note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  // The host rejected our revision, but the subscriber replica still
  // serves the pre-conflict copy on the first read; the remote edit's
  // broadcast lands between polls.
  const staleReplica = makeApiNotesNote(note);
  const advancedRemote = {
    ...note,
    bodyMd: 'remote edit that caused the conflict',
    revision: note.revision + 1,
  };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(advancedRemote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  const getNote = vi
    .spyOn(api.notes, 'getNote')
    .mockResolvedValueOnce(staleReplica)
    .mockResolvedValueOnce(staleReplica)
    .mockResolvedValue(makeApiNotesNote(advancedRemote));
  vi.spyOn(api.notes, 'updateNoteBody').mockRejectedValue(
    new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
  );

  const attempt = saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: 'my draft',
  });

  // The stale reads must not be classified: "theirs" is the advanced copy,
  // never the replica echo of our own base.
  await expect(attempt).rejects.toBeInstanceOf(NotesNoteConflictError);
  await expect(attempt).rejects.toMatchObject({
    remoteNote: expect.objectContaining({
      bodyMd: advancedRemote.bodyMd,
      revision: advancedRemote.revision,
    }),
  });
  expect(getNote.mock.calls.length).toBeGreaterThanOrEqual(3);
});

test('saveNotebookNote rethrows the raw conflict when the replica never advances', async () => {
  const note = makeNote('Stuck replica note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([makeApiNotesNote(note)]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'getNote').mockResolvedValue(makeApiNotesNote(note));
  vi.spyOn(api.notes, 'updateNoteBody').mockRejectedValue(
    new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
  );

  const attempt = saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: 'my draft',
  });

  // Unclassifiable — must NOT become a NotesNoteConflictError built from
  // the stale echo; the raw typed error lets the next autosave retry.
  await expect(attempt).rejects.toBeInstanceOf(api.NotesV1WriteError);
}, 15_000);

test('saveNotesNotebookSnapshot does not regress a locally persisted newer revision', async () => {
  const note = makeNote('Write-through note');
  const snapshot = {
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  };
  await db.saveNotesNotebookSnapshot(snapshot);

  // A conflict resolved with "use theirs" adopts the host copy — body,
  // revision, AND title — via the same local write path.
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    title: 'Adopted title',
    bodyMd: 'freshly saved body',
    revision: note.revision + 1,
  });

  // ...then a sync that fetched before the save lands with the old copy.
  await db.saveNotesNotebookSnapshot(snapshot);

  // The stored row must survive wholesale: splicing only body/revision
  // onto the stale copy would fabricate a new-revision row with the old
  // title, which the editor would then adopt.
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    title: 'Adopted title',
    bodyMd: 'freshly saved body',
    revision: note.revision + 1,
  });
});

test('saveNotebookNote ignores replica reads trailing below the rejected revision', async () => {
  // Local state is ahead of the replica: the write-through landed rev 2
  // locally, the replica still serves rev 1, and the host rejected rev 2
  // because it moved on to rev 3.
  const base = makeNote('Trailing replica note');
  const localNote = { ...base, bodyMd: 'our saved body', revision: 2 };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [localNote],
    members: [],
  });

  const trailingReplica = { ...base, bodyMd: 'ancient body', revision: 1 };
  const advancedRemote = { ...base, bodyMd: 'newest host body', revision: 3 };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(advancedRemote),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'getNote')
    .mockResolvedValueOnce(makeApiNotesNote(trailingReplica))
    .mockResolvedValue(makeApiNotesNote(advancedRemote));
  vi.spyOn(api.notes, 'updateNoteBody').mockRejectedValue(
    new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
  );

  const attempt = saveNotebookNote({
    notebookFlag,
    note: localNote,
    title: localNote.title,
    body: 'my draft',
  });

  // The rev-1 read is older than the user's own base — offering it as
  // "theirs" would let a resolution regress the note. Only the advanced
  // copy may be classified.
  await expect(attempt).rejects.toBeInstanceOf(NotesNoteConflictError);
  await expect(attempt).rejects.toMatchObject({
    remoteNote: expect.objectContaining({
      bodyMd: advancedRemote.bodyMd,
      revision: advancedRemote.revision,
    }),
  });
});

test('saveNotesNotebookSnapshot keeps newer metadata at an equal revision', async () => {
  // Renames/moves don't bump the revision, so a stale snapshot can carry
  // the same revision with older metadata.
  const note = makeNote('Renamed note');
  const staleSnapshot = {
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  };
  await db.saveNotesNotebookSnapshot(staleSnapshot);

  // An adoption writes a newer title at the SAME revision (host rename).
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    title: 'Adopted rename',
    updatedAt: (note.updatedAt ?? 0) + 1_000,
  });

  await db.saveNotesNotebookSnapshot(staleSnapshot);

  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({ title: 'Adopted rename' });
});

test('saveNotebookNote rethrows the raw error when the retry races and the replica lags', async () => {
  const note = makeNote('Retry-lag note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const firstBody = 'first draft';
  const firstSaved = {
    ...note,
    bodyMd: firstBody,
    revision: note.revision + 1,
  };
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(firstSaved),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  // The replica serves our own previous save forever: good enough to
  // classify the first conflict as own-echo, but it never advances past
  // the rebased retry's rejected revision.
  vi.spyOn(api.notes, 'getNote').mockResolvedValue(
    makeApiNotesNote(firstSaved)
  );
  const updateNoteBody = vi
    .spyOn(api.notes, 'updateNoteBody')
    .mockResolvedValue({ status: 'ok', note: null });

  await saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: firstBody,
  });

  updateNoteBody.mockRejectedValue(
    new api.NotesV1WriteError('%notes error: revision-mismatch', 'conflict')
  );

  const attempt = saveNotebookNote({
    notebookFlag,
    note,
    title: note.title,
    body: 'first draft plus more typing',
  });

  // Building a conflict from our own previous save would offer the user's
  // discarded past as "theirs" — the raw error must escape instead.
  await expect(attempt).rejects.toBeInstanceOf(api.NotesV1WriteError);
}, 15_000);

test('adoptNotebookNoteRemote refuses to downgrade a row that advanced past the copy', async () => {
  const note = makeNote('Advanced note');
  const advancedRow = {
    ...note,
    bodyMd: 'newer synced body',
    revision: note.revision + 4,
  };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [advancedRow],
    members: [],
  });

  // The conflict banner's captured copy is older than what the row has
  // since synced to.
  const staleConflictCopy = makeApiNotesNote({
    ...note,
    bodyMd: 'older conflict copy',
    revision: note.revision + 1,
  });

  const adopted = await adoptNotebookNoteRemote({
    notebookFlag,
    remote: staleConflictCopy,
  });

  expect(adopted).toMatchObject({
    bodyMd: 'newer synced body',
    revision: advancedRow.revision,
  });
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    bodyMd: 'newer synced body',
    revision: advancedRow.revision,
  });
});

test('rename-only save adopts a raced remote body from the payload', async () => {
  const note = makeNote('Raced rename');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  // Another client's body edit landed first; the host applied our rename on
  // top and the payload carries the complete newer note.
  const remoteBody = 'body edited by someone else';
  vi.spyOn(api.notes, 'renameNote').mockResolvedValue({
    id: note.noteId,
    title: 'Renamed locally',
    bodyMd: remoteBody,
    revision: note.revision + 1,
    updatedAt: (note.updatedAt ?? 0) + 100,
    updatedBy: '~zod',
  });

  const saved = await saveNotebookNote({
    notebookFlag,
    note,
    title: 'Renamed locally',
    body: note.bodyMd, // body untouched locally
  });

  // Persisting the payload's revision WITHOUT its body would fabricate a
  // row whose next body edit passes optimistic concurrency and silently
  // overwrites the remote edit.
  expect(saved).toMatchObject({
    title: 'Renamed locally',
    bodyMd: remoteBody,
    revision: note.revision + 1,
  });
});

test('updateNotesNote is revision-monotonic in a single atomic write', async () => {
  const note = makeNote('Guarded note');
  const row = { ...note, revision: 5, updatedAt: 1_000 };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [row],
    members: [],
  });

  // Older revision: skipped.
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    bodyMd: 'stale write',
    revision: 4,
  });
  // Equal revision with an older stamp: skipped.
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    title: 'stale rename',
    revision: 5,
    updatedAt: 500,
  });
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    bodyMd: row.bodyMd,
    title: row.title,
    revision: 5,
  });

  // Equal revision with a newer stamp: applies (rename/move semantics).
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    title: 'fresh rename',
    revision: 5,
    updatedAt: 2_000,
  });
  // Newer revision: applies.
  await db.updateNotesNote({
    notebookFlag,
    noteId: note.noteId,
    bodyMd: 'fresh body',
    revision: 6,
  });
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    title: 'fresh rename',
    bodyMd: 'fresh body',
    revision: 6,
  });
});

test('adoptNotebookNoteRemote keeps newer same-revision metadata', async () => {
  // Renames/moves don't bump the revision: a rename synced after the
  // conflict copy was captured leaves the row at the same revision with
  // newer metadata.
  const note = makeNote('Renamed while deciding');
  const renamedRow = {
    ...note,
    title: 'Newer synced title',
    updatedAt: (note.updatedAt ?? 0) + 1_000,
  };
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [renamedRow],
    members: [],
  });

  const staleConflictCopy = makeApiNotesNote(note);
  const adopted = await adoptNotebookNoteRemote({
    notebookFlag,
    remote: staleConflictCopy,
  });

  expect(adopted).toMatchObject({ title: 'Newer synced title' });
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({ title: 'Newer synced title' });
});

test('adoptNotebookNoteRemote persists the host copy locally', async () => {
  const note = makeNote('Local note');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const remote = makeApiNotesNote({
    ...note,
    title: 'Remote title',
    bodyMd: 'remote body',
    folderId: rootFolder.folderId + 5,
    revision: note.revision + 2,
    updatedAt: 500,
  });

  const adopted = await adoptNotebookNoteRemote({ notebookFlag, remote });

  expect(adopted).toMatchObject({
    title: 'Remote title',
    bodyMd: 'remote body',
    folderId: rootFolder.folderId + 5,
    revision: note.revision + 2,
  });
  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({
    title: 'Remote title',
    bodyMd: 'remote body',
    revision: note.revision + 2,
  });
});

test('deleteNotebookNote removes the note from the write response alone', async () => {
  const note = makeNote('Delete me');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  const listNotes = vi.spyOn(api.notes, 'listNotes');
  vi.spyOn(api.notes, 'deleteNote').mockResolvedValue({
    type: 'note-deleted',
    noteId: note.noteId,
  });

  await deleteNotebookNote({ notebookFlag, noteId: note.noteId });

  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toBeNull();
  expect(listNotes).not.toHaveBeenCalled();
});

test('deleteNotebookNote reports the delete on the write response, not on read-back', async () => {
  const capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });
  const note = makeNote('Delete me');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notes, 'deleteNote').mockResolvedValue({
    type: 'note-deleted',
    noteId: note.noteId,
  });

  await deleteNotebookNote({ notebookFlag, noteId: note.noteId });

  // The ok envelope is the host's confirmation — nothing else is needed to
  // know the delete happened.
  expect(
    capture.mock.calls.some(([event]) => event === AnalyticsEvent.NoteDeleted)
  ).toBe(true);
});

test('deleteNotebookNote keeps the local delete when the fallback sync stays stale', async () => {
  const note = makeNote('Delete me eventually');
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders: [rootFolder],
    notes: [note],
    members: [],
  });

  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([makeApiNotesNote(note)]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);
  vi.spyOn(api.notes, 'deleteNote').mockResolvedValue(null);

  await deleteNotebookNote({ notebookFlag, noteId: note.noteId });

  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toBeNull();
});

test('publishNotebookNote renders current markdown and marks note published', async () => {
  const publishNotesNote = vi
    .spyOn(api.notes, 'publishNote')
    .mockResolvedValue(1);
  vi.spyOn(api.notes, 'listPublished').mockResolvedValue([
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

test('publishedNoteUrl builds links from the ship URL', () => {
  expect(
    publishedNoteUrl(
      publishedNotePath(notebookFlag, 3),
      'https://zod.tlon.network'
    )
  ).toBe('https://zod.tlon.network/notes/pub/~zod/native-notes/3');
});

test('publishNotebookNote fails loudly when the publish never confirms', async () => {
  vi.spyOn(api.notes, 'publishNote').mockResolvedValue(1);
  vi.spyOn(api.notes, 'listPublished').mockResolvedValue([]);

  await expect(
    publishNotebookNote({
      notebookFlag,
      noteId: 3,
      title: 'Unconfirmed',
      body: 'body',
    })
  ).rejects.toThrow('publish is not yet confirmed');
});

test('unpublishNotebookNote waits for the note to leave published records', async () => {
  const unpublishNotesNote = vi
    .spyOn(api.notes, 'unpublishNote')
    .mockResolvedValue(1);
  vi.spyOn(api.notes, 'listPublished').mockResolvedValue([]);

  await unpublishNotebookNote({ notebookFlag, noteId: 3 });

  expect(unpublishNotesNote).toHaveBeenCalledWith({
    flag: notebookFlag,
    noteId: 3,
  });
});

test('noteIsPublished matches published records by note id', () => {
  const published = [{ host: '~zod', flagName: 'native-notes', noteId: 3 }];

  expect(noteIsPublished(published, 3)).toBe(true);
  expect(noteIsPublished(published, 4)).toBe(false);
});

// ---------------------------------------------------------------------------
// applyNotesUpdate — the shared reducer behind both the write path and the
// stream. These cover the variants no mutation test exercises end to end.
// ---------------------------------------------------------------------------

async function seedNotebook(
  notes: db.NotesNote[] = [],
  folders: db.NotesFolder[] = [rootFolder]
) {
  await db.saveNotesNotebookSnapshot({
    notebook: makeNotesNotebook({ rootFolderId: rootFolder.folderId }),
    folders,
    notes,
    members: [],
  });
}

test('applyNotesUpdate upserts a created note', async () => {
  await seedNotebook();
  const note = makeNotesNote(9, rootFolder.folderId, 'From the stream', {
    bodyMd: 'streamed body',
    revision: 3,
  });

  await expect(
    applyNotesUpdate(notebookFlag, makeNoteUpdate('note-created', note))
  ).resolves.toBe(true);

  await expect(
    db.getNotesNote({ notebookFlag, noteId: 9 })
  ).resolves.toMatchObject({
    title: 'From the stream',
    bodyMd: 'streamed body',
    revision: 3,
    folderId: rootFolder.folderId,
  });
});

test('applyNotesUpdate ignores a note update older than the stored revision', async () => {
  const stored = makeNotesNote(9, rootFolder.folderId, 'Current', {
    bodyMd: 'current body',
    revision: 5,
    updatedAt: 500,
  });
  await seedNotebook([stored]);

  const stale = makeNotesNote(9, rootFolder.folderId, 'Stale', {
    bodyMd: 'stale body',
    revision: 4,
    updatedAt: 400,
  });
  await expect(
    applyNotesUpdate(notebookFlag, makeNoteUpdate('note-updated', stale))
  ).resolves.toBe(true);

  await expect(
    db.getNotesNote({ notebookFlag, noteId: 9 })
  ).resolves.toMatchObject({ title: 'Current', revision: 5 });
});

test('applyNotesUpdate applies a note update at the same revision with a newer stamp', async () => {
  const stored = makeNotesNote(9, rootFolder.folderId, 'Before', {
    revision: 5,
    updatedAt: 500,
  });
  await seedNotebook([stored]);

  // Renames and moves don't bump the revision — the host stamp breaks the tie.
  const renamed = makeNotesNote(9, rootFolder.folderId, 'After', {
    revision: 5,
    updatedAt: 600,
  });
  await applyNotesUpdate(notebookFlag, makeNoteUpdate('note-updated', renamed));

  await expect(
    db.getNotesNote({ notebookFlag, noteId: 9 })
  ).resolves.toMatchObject({ title: 'After', revision: 5 });
});

test('applyNotesUpdate deletes a note', async () => {
  const note = makeNotesNote(9, rootFolder.folderId, 'Doomed');
  await seedNotebook([note]);

  await applyNotesUpdate(notebookFlag, { type: 'note-deleted', noteId: 9 });

  await expect(
    db.getNotesNote({ notebookFlag, noteId: 9 })
  ).resolves.toBeNull();
});

test('applyNotesUpdate upserts a created folder and updates it in place', async () => {
  await seedNotebook();
  const folder = makeNotesFolder(8, 'Drafts', rootFolder.folderId);

  await applyNotesUpdate(
    notebookFlag,
    makeFolderUpdate('folder-created', folder)
  );
  await expect(db.getNotesFolders({ notebookFlag })).resolves.toContainEqual(
    expect.objectContaining({ folderId: 8, name: 'Drafts' })
  );

  await applyNotesUpdate(
    notebookFlag,
    makeFolderUpdate('folder-updated', { ...folder, name: 'Published' })
  );
  const folders = await db.getNotesFolders({ notebookFlag });
  expect(folders.filter((f) => f.folderId === 8)).toEqual([
    expect.objectContaining({ name: 'Published' }),
  ]);
});

test('applyNotesUpdate deletes a folder subtree and the notes inside it', async () => {
  const parent = makeNotesFolder(8, 'Parent', rootFolder.folderId);
  const child = makeNotesFolder(9, 'Child', parent.folderId);
  const noteInChild = makeNotesNote(20, child.folderId, 'Nested note');
  const keptNote = makeNotesNote(21, rootFolder.folderId, 'Kept note');
  await seedNotebook([noteInChild, keptNote], [rootFolder, parent, child]);

  await applyNotesUpdate(notebookFlag, {
    type: 'folder-deleted',
    folderId: parent.folderId,
  });

  const folders = await db.getNotesFolders({ notebookFlag });
  expect(folders.map((f) => f.folderId)).toEqual([rootFolder.folderId]);
  await expect(
    db.getNotesNote({ notebookFlag, noteId: 20 })
  ).resolves.toBeNull();
  await expect(
    db.getNotesNote({ notebookFlag, noteId: 21 })
  ).resolves.not.toBeNull();
});

test('applyNotesUpdate tracks members joining and leaving', async () => {
  await seedNotebook();

  await applyNotesUpdate(notebookFlag, {
    type: 'member-joined',
    who: '~ten',
    role: 'editor',
  });
  await expect(db.getNotesMembers({ notebookFlag })).resolves.toEqual([
    expect.objectContaining({ contactId: '~ten', role: 'editor' }),
  ]);

  await applyNotesUpdate(notebookFlag, { type: 'member-left', who: '~ten' });
  await expect(db.getNotesMembers({ notebookFlag })).resolves.toEqual([]);
});

test('applyNotesUpdate records the current user role when we are the member', async () => {
  await seedNotebook();
  vi.spyOn(api, 'getCurrentUserId').mockReturnValue('~ten');

  await applyNotesUpdate(notebookFlag, {
    type: 'member-joined',
    who: '~ten',
    role: 'viewer',
  });
  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    currentUserRole: 'viewer',
  });

  await applyNotesUpdate(notebookFlag, { type: 'member-left', who: '~ten' });
  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    currentUserRole: null,
  });
});

test('applyNotesUpdate applies notebook title and visibility changes', async () => {
  await seedNotebook();

  await applyNotesUpdate(notebookFlag, {
    type: 'notebook-updated',
    notebook: { id: 1, title: 'Renamed notebook', updatedAt: 900 },
  });
  await applyNotesUpdate(notebookFlag, {
    type: 'notebook-visibility-changed',
    visibility: 'public',
  });

  await expect(db.getNotesNotebook({ notebookFlag })).resolves.toMatchObject({
    title: 'Renamed notebook',
    visibility: 'public',
    updatedAt: 900,
  });
});

test('applyNotesUpdate defers to a full sync when the notebook is not local yet', async () => {
  const note = makeNotesNote(9, rootFolder.folderId, 'Orphan');

  // No notebook row: nothing to attach the note to.
  await expect(
    applyNotesUpdate(notebookFlag, makeNoteUpdate('note-created', note))
  ).resolves.toBe(false);
});

test('applyNotesUpdate serializes overlapping updates for one notebook', async () => {
  await seedNotebook();
  const note = (revision: number, title: string) =>
    makeNotesNote(9, rootFolder.folderId, title, {
      revision,
      updatedAt: revision * 100,
    });

  await Promise.all([
    applyNotesUpdate(
      notebookFlag,
      makeNoteUpdate('note-created', note(1, 'v1'))
    ),
    applyNotesUpdate(
      notebookFlag,
      makeNoteUpdate('note-updated', note(3, 'v3'))
    ),
    applyNotesUpdate(
      notebookFlag,
      makeNoteUpdate('note-updated', note(2, 'v2'))
    ),
  ]);

  // Whatever the interleaving, the highest revision is what survives.
  await expect(
    db.getNotesNote({ notebookFlag, noteId: 9 })
  ).resolves.toMatchObject({ title: 'v3', revision: 3 });
});

// ---------------------------------------------------------------------------
// Mutations that now cost one request
// ---------------------------------------------------------------------------

test('moveNotebookNote applies the response without reading back', async () => {
  const note = makeNotesNote(9, rootFolder.folderId, 'Movable');
  const target = makeNotesFolder(8, 'Target', rootFolder.folderId);
  await seedNotebook([note], [rootFolder, target]);

  const listNotes = vi.spyOn(api.notes, 'listNotes');
  vi.spyOn(api.notes, 'moveNote').mockResolvedValue(
    makeNoteUpdate('note-updated', {
      ...note,
      folderId: target.folderId,
      updatedAt: (note.updatedAt ?? 0) + 100,
    })
  );

  await moveNotebookNote({
    notebookFlag,
    noteId: note.noteId,
    folderId: target.folderId,
  });

  await expect(
    db.getNotesNote({ notebookFlag, noteId: note.noteId })
  ).resolves.toMatchObject({ folderId: target.folderId });
  expect(listNotes).not.toHaveBeenCalled();
});

test('renameNotebookFolder applies the response without reading back', async () => {
  const folder = makeNotesFolder(8, 'Old name', rootFolder.folderId);
  await seedNotebook([], [rootFolder, folder]);

  const listFolders = vi.spyOn(api.notes, 'listFolders');
  vi.spyOn(api.notes, 'renameFolder').mockResolvedValue(
    makeFolderUpdate('folder-updated', { ...folder, name: 'New name' })
  );

  await renameNotebookFolder({ notebookFlag, folder, name: 'New name' });

  await expect(db.getNotesFolders({ notebookFlag })).resolves.toContainEqual(
    expect.objectContaining({ folderId: 8, name: 'New name' })
  );
  expect(listFolders).not.toHaveBeenCalled();
});

test('deleteNotebookFolder removes the subtree from the response alone', async () => {
  const parent = makeNotesFolder(8, 'Parent', rootFolder.folderId);
  const child = makeNotesFolder(9, 'Child', parent.folderId);
  await seedNotebook([], [rootFolder, parent, child]);

  const listFolders = vi.spyOn(api.notes, 'listFolders');
  vi.spyOn(api.notes, 'deleteFolder').mockResolvedValue({
    type: 'folder-deleted',
    folderId: parent.folderId,
  });

  await deleteNotebookFolder({ notebookFlag, folder: parent });

  await expect(db.getNotesFolders({ notebookFlag })).resolves.toEqual([
    expect.objectContaining({ folderId: rootFolder.folderId }),
  ]);
  expect(listFolders).not.toHaveBeenCalled();
});

test('createNotebookFolder returns the created folder from the response alone', async () => {
  await seedNotebook();
  const created = makeNotesFolder(8, 'Drafts', rootFolder.folderId);

  const listFolders = vi.spyOn(api.notes, 'listFolders');
  vi.spyOn(api.notes, 'createFolder').mockResolvedValue(
    makeFolderUpdate('folder-created', created)
  );

  const folder = await createNotebookFolder({
    notebookFlag,
    parentFolderId: rootFolder.folderId,
    name: 'Drafts',
  });

  expect(folder).toMatchObject({ folderId: 8, name: 'Drafts' });
  expect(listFolders).not.toHaveBeenCalled();
});

test('importNotebookTree submits one poke for the whole tree', async () => {
  await seedNotebook();
  const child = makeNotesFolder(8, 'Imported', rootFolder.folderId);
  const imported = makeNotesNote(20, child.folderId, 'Nested note');

  const batchImport = vi
    .spyOn(api, 'batchImportNotesTreeV1')
    .mockResolvedValue('0vserver');
  const createNote = vi.spyOn(api.notes, 'createNote');
  const createFolder = vi.spyOn(api.notes, 'createFolder');
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
    makeApiNotesFolder(child),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([
    makeApiNotesNote(imported),
  ]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);

  const tree: api.NotesImportNode[] = [
    {
      name: 'Imported',
      children: [
        { title: 'Nested note', body: 'nested body' },
        { title: 'Second note', body: 'second body' },
      ],
    },
    { title: 'Top note', body: 'top body' },
  ];

  const result = await importNotebookTree({
    notebookFlag,
    parentFolderId: rootFolder.folderId,
    tree,
  });

  expect(result).toEqual({ noteCount: 3 });
  expect(batchImport).toHaveBeenCalledTimes(1);
  expect(batchImport).toHaveBeenCalledWith(
    expect.objectContaining({
      flag: notebookFlag,
      parent: rootFolder.folderId,
      tree,
    })
  );
  // Not one request per note or per folder.
  expect(createNote).not.toHaveBeenCalled();
  expect(createFolder).not.toHaveBeenCalled();

  // The single trailing sync is what lands the created rows locally.
  await expect(
    db.getNotesNote({ notebookFlag, noteId: imported.noteId })
  ).resolves.toMatchObject({ title: 'Nested note' });
});

test('importNotebookTree counts notes at every depth', async () => {
  await seedNotebook();
  vi.spyOn(api, 'batchImportNotesTreeV1').mockResolvedValue('0vserver');
  vi.spyOn(api.notes, 'getNotebook').mockResolvedValue(notebookSummary);
  vi.spyOn(api.notes, 'listFolders').mockResolvedValue([
    makeApiNotesFolder(rootFolder),
  ]);
  vi.spyOn(api.notes, 'listNotes').mockResolvedValue([]);
  vi.spyOn(api.notes, 'listMembers').mockResolvedValue([]);

  const result = await importNotebookTree({
    notebookFlag,
    parentFolderId: rootFolder.folderId,
    tree: [
      {
        name: 'a',
        children: [
          { title: 'one', body: '' },
          { name: 'b', children: [{ title: 'two', body: '' }] },
          { name: 'empty', children: [] },
        ],
      },
      { title: 'three', body: '' },
    ],
  });

  expect(result).toEqual({ noteCount: 3 });
});

test('importNotebookTree does nothing for an empty tree', async () => {
  const batchImport = vi.spyOn(api, 'batchImportNotesTreeV1');
  const getNotebook = vi.spyOn(api.notes, 'getNotebook');

  await expect(
    importNotebookTree({
      notebookFlag,
      parentFolderId: rootFolder.folderId,
      tree: [],
    })
  ).resolves.toEqual({ noteCount: 0 });

  expect(batchImport).not.toHaveBeenCalled();
  expect(getNotebook).not.toHaveBeenCalled();
});
