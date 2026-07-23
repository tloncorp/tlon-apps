import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import type { WrappedQuery } from '../db/query';
import { createDevLogger } from '../debug';
import {
  publishedNotePath,
  renderPublishedNoteHtml,
  withRetry,
} from '../logic';
import { collectDescendantFolderIds } from '../logic/notesTree';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const logger = createDevLogger('notesActions', false);

const NOTES_SYNC_STALE_TIME = 15_000;
const NOTES_PUBLISHED_STALE_TIME = 15_000;

type SyncNotesNotebookOptions = {
  hydrateNoteIds?: readonly number[];
  requireHydratedNotes?: boolean;
};

type NotesNotebookSnapshot = Parameters<typeof db.saveNotesNotebookSnapshot>[0];
type ReadyValue<T> = T | false | null | undefined;

export function normalizeNotebookNoteTitle(title: string) {
  return title.trim();
}

export function notesNotebookFlagFromChannelId(channelId: string) {
  const flag = api.parseNotesChannelId(channelId);
  return flag ? api.formatNotesFlag(flag) : null;
}

function requireNotesNotebookFlag(flagInput: api.NotesFlag | string) {
  const parsed = api.normalizeNotesTarget(flagInput);
  const flag = api.formatNotesFlag(parsed);
  return { flag, parsed };
}

export async function syncNotesNotebook(
  flagInput: api.NotesFlag | string,
  options: SyncNotesNotebookOptions = {}
) {
  const { flag, snapshot } = await fetchNotesNotebookSnapshot(
    flagInput,
    options
  );
  await db.saveNotesNotebookSnapshot(snapshot);
  return db.getNotesNotebookWithRelations({ notebookFlag: flag });
}

async function fetchNotesNotebookSnapshot(
  flagInput: api.NotesFlag | string,
  options: SyncNotesNotebookOptions = {}
) {
  const { flag, parsed } = requireNotesNotebookFlag(flagInput);

  const [notebook, folders, notes, membersResult, existingNotes] =
    await Promise.all([
      api.notes.getNotebook(parsed),
      api.notes.listFolders(parsed),
      api.notes.listNotes(parsed),
      api.notes.listMembers(parsed).then(
        (members) => ({ ok: true as const, members }),
        (error) => ({ ok: false as const, error })
      ),
      db.getNotesNotes({ notebookFlag: flag }),
    ]);
  const notesForSnapshot = await hydrateNotesForSnapshot(
    parsed,
    notes,
    options
  );
  const existingNotesById = new Map(
    existingNotes.map((note) => [note.noteId, note])
  );
  const syncedAt = Date.now();
  let members: api.NotesMember[] = [];
  let dbMembers: db.NotesMember[] = [];
  let currentUserRole: db.NotesRole | null | undefined;
  if (membersResult.ok) {
    members = membersResult.members;
    dbMembers = members.map((member) => ({
      ...member,
      role: member.role ?? null,
      syncedAt,
    }));
  } else {
    logger.error('Failed to fetch notes members', membersResult.error);
    const [existingNotebook, existingMembers] = await Promise.all([
      db.getNotesNotebook({ notebookFlag: flag }),
      db.getNotesMembers({ notebookFlag: flag }),
    ]);
    currentUserRole = existingNotebook
      ? existingNotebook.currentUserRole ?? null
      : undefined;
    dbMembers = existingMembers;
  }

  return {
    flag,
    snapshot: {
      notebook: notebookForSnapshot(
        notebook,
        members,
        currentUserRole,
        syncedAt
      ),
      folders: folders.map((folder) =>
        folderForSnapshot(folder, notebook.notebookId, syncedAt)
      ),
      notes: notesForSnapshot.map((note) =>
        noteForSnapshot(
          note,
          notebook,
          existingNotesById.get(note.noteId),
          syncedAt
        )
      ),
      members: dbMembers,
    },
  };
}

async function ensureNotesNotebookJoined(flagInput: api.NotesFlag | string) {
  const { flag, parsed } = requireNotesNotebookFlag(flagInput);

  const currentUserId = api.getCurrentUserId();
  const isHost = parsed.host === currentUserId;
  if (isHost || (await notesNotebookIsJoined(parsed))) {
    await syncNotesNotebook(parsed).catch((e) => {
      logger.error('Failed to sync joined notes notebook', e);
    });
    return true;
  }

  await api.joinNotesNotebook(parsed);

  const joinConfirmed = await withRetry(
    async () => {
      if (!(await notesNotebookIsJoined(parsed))) {
        throw new Error(`Timed out joining notes notebook: ${flag}`);
      }
    },
    { numOfAttempts: 10, startingDelay: 350, timeMultiple: 1 }
  ).then(
    () => true,
    () => false
  );

  if (joinConfirmed) {
    await syncNotesNotebook(parsed);
  }
  return joinConfirmed;
}

export function useEnsureNotesNotebookJoined({
  notebookFlag,
  enabled = true,
}: {
  notebookFlag: string | null | undefined;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['notesEnsureJoined', notebookFlag],
    queryFn: () => ensureNotesNotebookJoined(notebookFlag!),
    enabled: enabled && Boolean(notebookFlag),
    retry: false,
    staleTime: NOTES_SYNC_STALE_TIME,
  });
}

export function useSyncNotesNotebook({
  notebookFlag,
  enabled = true,
}: {
  notebookFlag: string | null | undefined;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: ['notesSync', notebookFlag],
    queryFn: () => syncNotesNotebook(notebookFlag!),
    enabled: enabled && Boolean(notebookFlag),
    staleTime: NOTES_SYNC_STALE_TIME,
    retry: 1,
  });

  const syncActiveNotebook = useMemo(
    () =>
      debounce(
        (flag: string) => {
          syncNotesNotebook(flag).catch((e) => {
            logger.error('Failed to sync notes notebook from stream event', e);
          });
        },
        400,
        { leading: true, trailing: true }
      ),
    []
  );

  useEffect(() => {
    if (!enabled || !notebookFlag) return;

    let mounted = true;
    let subscriptionId: number | null = null;
    api
      .subscribeToNotesNotebook(notebookFlag, () => {
        syncActiveNotebook(notebookFlag);
      })
      .then((id) => {
        if (!mounted) {
          api.unsubscribeFromNotesNotebook(id);
        } else {
          subscriptionId = id;
        }
      })
      .catch((e) => {
        logger.error('Failed to subscribe to notes notebook stream', e);
      });

    return () => {
      mounted = false;
      syncActiveNotebook.cancel();
      if (subscriptionId !== null) {
        api.unsubscribeFromNotesNotebook(subscriptionId);
      }
    };
  }, [enabled, notebookFlag, syncActiveNotebook]);

  return query;
}

function createNotebookQueryHook<TReturn>(
  queryName: string,
  query: WrappedQuery<{ notebookFlag: string }, TReturn>
) {
  return function useNotebookQuery(
    notebookFlag: string | null | undefined,
    enabled = true
  ) {
    const deps = useKeyFromQueryDeps(query, {
      notebookFlag: notebookFlag ?? '',
    });
    return useQuery({
      queryKey: [queryName, deps, notebookFlag],
      queryFn: () => query({ notebookFlag: notebookFlag! }),
      enabled: enabled && Boolean(notebookFlag),
    });
  };
}

export const useNotesNotebook = createNotebookQueryHook(
  'notesNotebook',
  db.getNotesNotebook
);
export const useNotesNotebookWithRelations = createNotebookQueryHook(
  'notesNotebookWithRelations',
  db.getNotesNotebookWithRelations
);
export const useNotesFolders = createNotebookQueryHook(
  'notesFolders',
  db.getNotesFolders
);
export const useNotesNotes = createNotebookQueryHook(
  'notesNotes',
  db.getNotesNotes
);

export function usePublishedNotesForNotebook({
  notebookFlag,
  enabled = true,
}: {
  notebookFlag: string | null | undefined;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['notesPublished', notebookFlag],
    queryFn: () => listPublishedNotesForNotebook(notebookFlag!),
    enabled: enabled && Boolean(notebookFlag),
    staleTime: NOTES_PUBLISHED_STALE_TIME,
  });
}

async function listPublishedNotesForNotebook(notebookFlag: string) {
  const { parsed } = requireNotesNotebookFlag(notebookFlag);
  const published = await api.notes.listPublished();
  return published.filter(
    (record) => record.host === parsed.host && record.flagName === parsed.name
  );
}

export function noteIsPublished(
  published: api.NotesPublishedRecord[] | null | undefined,
  noteId: number | null | undefined
) {
  return noteId != null
    ? Boolean(published?.some((record) => record.noteId === noteId))
    : false;
}

async function createAndFindNewItem<T>({
  notebookFlag,
  getItems,
  getId,
  create,
  findFallback,
}: {
  notebookFlag: string;
  getItems: (snapshot: NotesNotebookSnapshot) => readonly T[];
  getId: (item: T) => number;
  create: () => Promise<unknown>;
  findFallback?: (items: readonly T[]) => T | null | undefined;
}): Promise<T | null> {
  const { snapshot: baseline } = await fetchNotesNotebookSnapshot(notebookFlag);
  await db.saveNotesNotebookSnapshot(baseline);

  const beforeIds = new Set(getItems(baseline).map(getId));
  const isNew = (item: T) => !beforeIds.has(getId(item));

  await create();
  return syncNotesNotebookUntil(notebookFlag, (snapshot) => {
    const newItems = getItems(snapshot).filter(isNew);
    return findFallback?.(newItems) ?? newItems[0] ?? null;
  });
}

export async function createNotebookNote({
  notebookFlag,
  folderId,
  title,
  body = '',
}: {
  notebookFlag: string;
  folderId: number;
  title: string;
  body?: string;
}) {
  const note = await createAndFindNewItem({
    notebookFlag,
    getItems: (snapshot) => snapshot.notes,
    getId: (note) => note.noteId,
    create: () =>
      api.notes.createNote({
        flag: notebookFlag,
        folder: folderId,
        title,
        body,
      }),
    findFallback: (notes) => notes.find((note) => note.title === title),
  });

  if (!note) {
    return null;
  }

  await syncNotesNotebookUntil(
    notebookFlag,
    (snapshot) =>
      snapshotNoteMatches(snapshot, note.noteId, (n) => n.bodyMd === body),
    { hydrateNoteIds: [note.noteId], requireHydratedNotes: true }
  );

  return db.getNotesNote({ notebookFlag, noteId: note.noteId });
}

export async function createNotebookFolder({
  notebookFlag,
  parentFolderId,
  name,
}: {
  notebookFlag: string;
  parentFolderId?: number | null;
  name: string;
}) {
  const parentId = parentFolderId ?? null;
  return createAndFindNewItem({
    notebookFlag,
    getItems: (snapshot) => snapshot.folders,
    getId: (folder) => folder.folderId,
    create: () =>
      api.notes.createFolder({
        flag: notebookFlag,
        parent: parentFolderId ?? undefined,
        name,
      }),
    findFallback: (folders) =>
      folders.find(
        (folder) =>
          folder.name === name && (folder.parentFolderId ?? null) === parentId
      ),
  });
}

export async function saveNotebookNote({
  notebookFlag,
  note,
  title,
  body,
}: {
  notebookFlag: string;
  note: db.NotesNote;
  title: string;
  body: string;
}) {
  const nextTitle = normalizeNotebookNoteTitle(title);
  const shouldRename = nextTitle !== note.title;
  const shouldUpdateBody = body !== note.bodyMd;

  if (!shouldRename && !shouldUpdateBody) {
    return note;
  }

  // The body update must land before the rename: it asserts expectedRevision,
  // which any other mutation would invalidate. Don't parallelize these.
  if (shouldUpdateBody) {
    await updateNotebookNoteBody({ notebookFlag, note, body });
  }

  if (shouldRename) {
    await api.notes.renameNote({
      flag: notebookFlag,
      noteId: note.noteId,
      title: nextTitle,
    });
  }

  await syncNotesNotebookUntil(
    notebookFlag,
    (snapshot) => {
      const updated = findSnapshotNote(snapshot, note.noteId);
      return Boolean(
        updated &&
          (!shouldRename || updated.title === nextTitle) &&
          (!shouldUpdateBody || updated.bodyMd === body)
      );
    },
    shouldUpdateBody
      ? { hydrateNoteIds: [note.noteId], requireHydratedNotes: true }
      : undefined
  );
  return db.getNotesNote({ notebookFlag, noteId: note.noteId });
}

// A revision conflict that isn't ours to auto-resolve: the note on the host
// diverged from the editor's base. Carries the host's copy so the UI can
// offer a real resolution instead of a blind retry (which can never succeed —
// the editor's base revision stays stale while it holds unsaved changes).
export class NotesNoteConflictError extends Error {
  readonly remoteNote: api.NotesNote;

  constructor(remoteNote: api.NotesNote) {
    super('This note was changed elsewhere. Your unsaved changes are kept.');
    this.name = 'NotesNoteConflictError';
    this.remoteNote = remoteNote;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// The exact state (content + resulting revision) this client last
// successfully wrote per note. Used to recognize a revision conflict caused
// by our *own* already-applied write — e.g. the read-back after an earlier
// save never landed locally — which is safe to rebase over. Both fields must
// match: content alone would also match a *remote* edit that restored our
// old text (e.g. via note history), which is a genuine conflict.
const lastSavedNoteState = new Map<
  string,
  { body: string; revision: number }
>();

// Poll the note read until it reports a revision GREATER than
// `staleRevision`, or null if it never does within the retry budget. Used by
// conflict recovery: a conflict proves the host has moved past
// `staleRevision`, so any read at or below it (the rejected copy itself, or
// an even older one — the replica can trail our local write-through) is a
// replica that hasn't caught up yet, not an answer. Classifying against it
// would offer content older than the user's own base as "theirs".
async function fetchNotePastRevision(
  notebookFlag: string,
  noteId: number,
  staleRevision: number
): Promise<api.NotesNote | null> {
  let latest: api.NotesNote | null = null;
  try {
    await withRetry(async () => {
      latest = await api.notes.getNote({ flag: notebookFlag, noteId });
      if ((latest.revision ?? 0) <= staleRevision) {
        throw notYetSynced;
      }
    }, notesRetryOptions);
  } catch (e) {
    if (e !== notYetSynced) {
      throw e;
    }
    return null;
  }
  return latest;
}

async function updateNotebookNoteBody({
  notebookFlag,
  note,
  body,
}: {
  notebookFlag: string;
  note: db.NotesNote;
  body: string;
}) {
  const noteKey = `${notebookFlag}/${note.noteId}`;
  const expectedRevision = note.revision;
  let result: Awaited<ReturnType<typeof api.notes.updateNoteBody>>;
  try {
    result = await api.notes.updateNoteBody({
      flag: notebookFlag,
      noteId: note.noteId,
      body,
      expectedRevision,
    });
  } catch (e) {
    if (!api.isNotesV1ConflictError(e)) {
      throw e;
    }
    // On subscribed notebooks the v1 GET serves our ship's replica, which
    // can still hold the very copy the host just rejected (its broadcast
    // may not have arrived). Classifying against that stale copy builds a
    // nonsense conflict — "theirs" identical to our base, and a resolution
    // that retries the same rejected revision. Wait for the replica to move
    // past the rejected revision; if it doesn't, we can't classify yet, so
    // rethrow and let the next autosave cycle try again.
    const remote = await fetchNotePastRevision(
      notebookFlag,
      note.noteId,
      expectedRevision
    );
    if (!remote) {
      throw e;
    }
    const remoteRevision = remote.revision ?? 0;
    if (remote.bodyMd === body) {
      // Our exact content is already on the host (an unload flush or an
      // earlier retry landed) — nothing left to send.
      lastSavedNoteState.set(noteKey, { body, revision: remoteRevision });
      await persistNoteWrite(notebookFlag, note.noteId, body, remoteRevision);
      return;
    }
    const lastSaved = lastSavedNoteState.get(noteKey);
    if (
      lastSaved &&
      remote.bodyMd === lastSaved.body &&
      remoteRevision === lastSaved.revision
    ) {
      // The "conflicting" revision is exactly the state our own previous
      // save produced, so its read-back just never landed locally. The
      // draft evolved from that content; rebasing onto the host's revision
      // loses nothing. The retry itself can race another writer — surface
      // that as a fresh conflict rather than a generic failure.
      try {
        await api.notes.updateNoteBody({
          flag: notebookFlag,
          noteId: note.noteId,
          body,
          expectedRevision: remoteRevision,
        });
      } catch (retryError) {
        if (!api.isNotesV1ConflictError(retryError)) {
          throw retryError;
        }
        // Surface the raced writer's copy once the replica has it. If it
        // hasn't advanced yet, rethrow the raw error instead of building a
        // conflict from `remote` — that copy is our OWN previous save, and
        // offering it as "theirs" would let a resolution regress the note.
        const raced = await fetchNotePastRevision(
          notebookFlag,
          note.noteId,
          remoteRevision
        );
        if (!raced) {
          throw retryError;
        }
        throw new NotesNoteConflictError(raced);
      }
      lastSavedNoteState.set(noteKey, {
        body,
        revision: remoteRevision + 1,
      });
      await persistNoteWrite(
        notebookFlag,
        note.noteId,
        body,
        remoteRevision + 1
      );
      return;
    }
    throw new NotesNoteConflictError(remote);
  }
  // %no-change means the host body already matched and the revision was NOT
  // bumped — persisting expected + 1 would put the local DB one revision
  // ahead of the host and re-wedge the next save.
  const nextRevision =
    result === 'no-change' ? expectedRevision : expectedRevision + 1;
  lastSavedNoteState.set(noteKey, { body, revision: nextRevision });
  await persistNoteWrite(notebookFlag, note.noteId, body, nextRevision);
}

// A successful body update moves the note to exactly expectedRevision + 1
// (the host bumps by one). Persist that immediately instead of relying on
// the snapshot read-back: the post-save poll gives up silently when replica
// propagation is slow, and a save that reports success while leaving the
// stale revision in the local DB wedges every later save on a conflict.
async function persistNoteWrite(
  notebookFlag: string,
  noteId: number,
  bodyMd: string,
  revision: number
) {
  await db.updateNotesNote({ notebookFlag, noteId, bodyMd, revision });
}

// Persist the host's copy of a note locally — used when the user resolves
// a revision conflict with "use theirs". Without this the editor's reactive
// row still holds the stale pre-conflict content and would immediately
// reload it over the adoption.
export async function adoptNotebookNoteRemote({
  notebookFlag,
  remote,
}: {
  notebookFlag: string;
  remote: api.NotesNote;
}) {
  // The conflict copy was captured when the banner appeared; the local row
  // can have advanced past it (another remote edit synced while the user
  // decided). Adopting would downgrade the row — keep it and let the
  // editor converge on the fresher copy instead.
  const current = await db.getNotesNote({
    notebookFlag,
    noteId: remote.noteId,
  });
  if (current && (remote.revision ?? 0) < current.revision) {
    return current;
  }
  await db.updateNotesNote({
    notebookFlag,
    noteId: remote.noteId,
    title: remote.title,
    bodyMd: remote.bodyMd ?? '',
    // The conflicting edit can ride along with a move; leave the folder
    // untouched when the read omits it.
    ...(remote.folderId != null ? { folderId: remote.folderId } : {}),
    revision: remote.revision ?? 0,
    updatedAt: remote.updatedAt ?? null,
    updatedBy: remote.updatedBy ?? null,
  });
  return db.getNotesNote({ notebookFlag, noteId: remote.noteId });
}

export async function publishNotebookNote({
  notebookFlag,
  noteId,
  title,
  body,
}: {
  notebookFlag: string;
  noteId: number;
  title: string;
  body: string;
}) {
  await api.notes.publishNote({
    flag: notebookFlag,
    noteId,
    html: renderPublishedNoteHtml({ title, body }),
  });
  await waitForPublishedNoteState(notebookFlag, noteId, true);
  return publishedNotePath(notebookFlag, noteId);
}

export async function unpublishNotebookNote({
  notebookFlag,
  noteId,
}: {
  notebookFlag: string;
  noteId: number;
}) {
  await api.notes.unpublishNote({
    flag: notebookFlag,
    noteId,
  });
  await waitForPublishedNoteState(notebookFlag, noteId, false);
}

export async function moveNotebookNote({
  notebookFlag,
  noteId,
  folderId,
}: {
  notebookFlag: string;
  noteId: number;
  folderId: number;
}) {
  await api.notes.moveNote({
    flag: notebookFlag,
    noteId,
    folder: folderId,
  });
  await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotNoteMatches(snapshot, noteId, (note) => note.folderId === folderId)
  );
}

export async function renameNotebookFolder({
  notebookFlag,
  folder,
  name,
}: {
  notebookFlag: string;
  folder: db.NotesFolder;
  name: string;
}) {
  const nextName = name.trim() || 'Untitled';
  if (nextName === folder.name) {
    return folder;
  }

  await api.notes.renameFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    name: nextName,
  });
  await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotFolderMatches(snapshot, folder.folderId, (f) => f.name === nextName)
  );
}

export async function moveNotebookFolder({
  notebookFlag,
  folder,
  parentFolderId,
}: {
  notebookFlag: string;
  folder: db.NotesFolder;
  parentFolderId: number;
}) {
  if (folder.parentFolderId === parentFolderId) {
    return folder;
  }

  await api.notes.moveFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    parent: parentFolderId,
  });
  await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotFolderMatches(
      snapshot,
      folder.folderId,
      (f) => f.parentFolderId === parentFolderId
    )
  );
}

function snapshotFolderMatches(
  snapshot: NotesNotebookSnapshot,
  folderId: number,
  matches: (folder: db.NotesFolder) => boolean
) {
  return snapshot.folders.some(
    (folder) => folder.folderId === folderId && matches(folder)
  );
}

function findSnapshotNote(snapshot: NotesNotebookSnapshot, noteId: number) {
  return snapshot.notes.find((note) => note.noteId === noteId);
}

function snapshotNoteMatches(
  snapshot: NotesNotebookSnapshot,
  noteId: number,
  matches: (note: db.NotesNote) => boolean
) {
  const note = findSnapshotNote(snapshot, noteId);
  return Boolean(note && matches(note));
}

export async function deleteNotebookNote({
  notebookFlag,
  noteId,
}: {
  notebookFlag: string;
  noteId: number;
}) {
  await api.notes.deleteNote({ flag: notebookFlag, noteId });
  await db.deleteNotesNote({ notebookFlag, noteId });
  await syncNotesNotebookUntil(
    notebookFlag,
    (snapshot) => !findSnapshotNote(snapshot, noteId)
  );
}

export async function deleteNotebookFolder({
  notebookFlag,
  folder,
}: {
  notebookFlag: string;
  folder: db.NotesFolder;
}) {
  const folders = await db.getNotesFolders({ notebookFlag });
  const folderIds = Array.from(
    collectDescendantFolderIds(folders, folder.folderId)
  );

  await api.notes.deleteFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    recursive: true,
  });
  await db.deleteNotesFolders({ notebookFlag, folderIds });
  await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    folderIds.every(
      (folderId) =>
        !snapshot.folders.some((nextFolder) => nextFolder.folderId === folderId)
    )
  );
}

export async function markNotesNotebookOpened(notebookFlag: string) {
  return db.setNotesNotebookLastOpened({
    notebookFlag,
    openedAt: Date.now(),
  });
}

async function notesNotebookIsJoined(flag: api.NotesFlag) {
  const notebooks = await api.notes.listNotebooks();
  return notebooks.some(
    (notebook) => notebook.host === flag.host && notebook.flagName === flag.name
  );
}

const notYetSynced = new Error('notes sync not yet applied');
const notesRetryOptions = {
  numOfAttempts: 8,
  startingDelay: 300,
  timeMultiple: 1,
  retry: (e: unknown) => e === notYetSynced,
};

async function syncNotesNotebookUntil<T>(
  notebookFlag: string,
  getReadyValue: (
    snapshot: NotesNotebookSnapshot
  ) => ReadyValue<T> | Promise<ReadyValue<T>>,
  options?: SyncNotesNotebookOptions
) {
  let readySnapshot: NotesNotebookSnapshot | null = null;
  let readyValue: T | null = null;
  try {
    await withRetry(async () => {
      const { snapshot } = await fetchNotesNotebookSnapshot(
        notebookFlag,
        options
      );
      const value = await getReadyValue(snapshot);
      if (!value) {
        throw notYetSynced;
      }
      readySnapshot = snapshot;
      readyValue = value;
    }, notesRetryOptions);
  } catch (e) {
    if (e !== notYetSynced) {
      throw e;
    }
  }

  if (readySnapshot) {
    await db.saveNotesNotebookSnapshot(readySnapshot);
  }
  return readyValue;
}

async function waitForPublishedNoteState(
  notebookFlag: string,
  noteId: number,
  expected: boolean
) {
  try {
    await withRetry(async () => {
      const published = await listPublishedNotesForNotebook(notebookFlag);
      if (noteIsPublished(published, noteId) !== expected) {
        throw notYetSynced;
      }
    }, notesRetryOptions);
  } catch (e) {
    if (e !== notYetSynced) {
      throw e;
    }
    // Unlike snapshot polls, this confirmation gates a user-facing success
    // signal (link copied, toast) — an unconfirmed publish must fail loudly
    // rather than report success for a state the backend never reached.
    throw new Error(
      `%notes write request is still pending; the ${
        expected ? 'publish' : 'unpublish'
      } is not yet confirmed and may still complete. Check the note's published state before retrying.`
    );
  }
}

async function hydrateNotesForSnapshot(
  flag: api.NotesFlag,
  notes: api.NotesNote[],
  options: SyncNotesNotebookOptions
) {
  const hydrateNoteIds = new Set(options.hydrateNoteIds ?? []);
  if (hydrateNoteIds.size === 0) {
    return notes;
  }

  return Promise.all(
    notes.map(async (note) => {
      if (!hydrateNoteIds.has(note.noteId)) {
        return note;
      }

      try {
        return await api.notes.getNote({ flag, noteId: note.noteId });
      } catch (e) {
        logger.error('Failed to fetch notes note detail', e);
        if (options.requireHydratedNotes) {
          throw notYetSynced;
        }
        return note;
      }
    })
  );
}

function notebookForSnapshot(
  notebook: api.NotesNotebookDetail,
  members: api.NotesMember[],
  preservedCurrentUserRole: db.NotesRole | null | undefined,
  syncedAt: number
): db.NotesNotebook {
  const currentUserId = api.getCurrentUserId();
  const currentMember = members.find(
    (member) => member.contactId === currentUserId && member.role != null
  );
  return {
    ...notebook,
    visibility: notebook.visibility ?? null,
    createdBy: notebook.createdBy ?? null,
    createdAt: notebook.createdAt ?? null,
    updatedBy: notebook.updatedBy ?? null,
    updatedAt: notebook.updatedAt ?? null,
    syncedAt,
    currentUserRole:
      preservedCurrentUserRole !== undefined
        ? preservedCurrentUserRole
        : currentMember?.role ??
          (notebook.host === currentUserId ? ('owner' as const) : null),
  };
}

function folderForSnapshot(
  folder: api.NotesFolder,
  notebookId: number,
  syncedAt: number
): db.NotesFolder {
  return {
    ...folder,
    notebookId: folder.notebookId ?? notebookId,
    parentFolderId: folder.parentFolderId ?? null,
    createdBy: folder.createdBy ?? null,
    createdAt: folder.createdAt ?? null,
    updatedBy: folder.updatedBy ?? null,
    updatedAt: folder.updatedAt ?? null,
    syncedAt,
  };
}

function noteForSnapshot(
  note: api.NotesNote,
  notebook: api.NotesNotebookDetail,
  existingNote: db.NotesNote | undefined,
  syncedAt: number
): db.NotesNote {
  return {
    ...note,
    notebookId:
      note.notebookId ?? existingNote?.notebookId ?? notebook.notebookId,
    folderId: note.folderId ?? existingNote?.folderId ?? notebook.rootFolderId,
    title: note.title,
    slug: note.slug === undefined ? existingNote?.slug ?? null : note.slug,
    bodyMd: note.bodyMd ?? existingNote?.bodyMd ?? '',
    createdBy: note.createdBy ?? existingNote?.createdBy ?? null,
    createdAt: note.createdAt ?? existingNote?.createdAt ?? null,
    updatedBy: note.updatedBy ?? existingNote?.updatedBy ?? null,
    updatedAt: note.updatedAt ?? existingNote?.updatedAt ?? null,
    revision: note.revision ?? existingNote?.revision ?? 0,
    syncedAt,
  };
}
