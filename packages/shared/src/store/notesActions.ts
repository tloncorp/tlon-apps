import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import type { WrappedQuery } from '../db/query';
import { createDevLogger } from '../debug';
import { withRetry } from '../logic';
import { collectDescendantFolderIds } from '../logic/notesTree';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const logger = createDevLogger('notesActions', false);

const NOTES_SYNC_STALE_TIME = 15_000;

type SyncNotesNotebookOptions = {
  hydrateNoteIds?: readonly number[];
  requireHydratedNotes?: boolean;
};

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

  await db.saveNotesNotebookSnapshot({
    notebook: notebookForSnapshot(notebook, members, currentUserRole, syncedAt),
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
  });

  return db.getNotesNotebookWithRelations({ notebookFlag: flag });
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
export const useNotesFolders = createNotebookQueryHook(
  'notesFolders',
  db.getNotesFolders
);
export const useNotesNotes = createNotebookQueryHook(
  'notesNotes',
  db.getNotesNotes
);

/**
 * Syncs before snapshotting existing item ids, runs the create action, then
 * syncs until an item with an unseen id appears locally. Returns that item, or
 * null if it never showed up.
 */
async function createAndFindNewItem<T>({
  notebookFlag,
  list,
  getId,
  create,
  findFallback,
}: {
  notebookFlag: string;
  list: () => Promise<T[]>;
  getId: (item: T) => number;
  create: () => Promise<unknown>;
  findFallback?: (items: T[]) => T | null | undefined;
}): Promise<T | null> {
  await syncNotesNotebook(notebookFlag);
  const beforeIds = new Set((await list()).map(getId));
  const isNew = (item: T) => !beforeIds.has(getId(item));

  await create();
  await syncNotesNotebookWithRetry(notebookFlag, async () =>
    (await list()).some(isNew)
  );

  const newItems = (await list()).filter(isNew);
  return findFallback?.(newItems) ?? newItems[0] ?? null;
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
    list: () => db.getNotesNotes({ notebookFlag }),
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

  await syncNotesNotebookWithRetry(
    notebookFlag,
    async () => {
      const hydrated = await db.getNotesNote({
        notebookFlag,
        noteId: note.noteId,
      });
      return Boolean(hydrated && hydrated.bodyMd === body);
    },
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
    list: () => db.getNotesFolders({ notebookFlag }),
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
    await api.notes.updateNoteBody({
      flag: notebookFlag,
      noteId: note.noteId,
      body,
      expectedRevision: note.revision,
    });
  }

  if (shouldRename) {
    await api.notes.renameNote({
      flag: notebookFlag,
      noteId: note.noteId,
      title: nextTitle,
    });
  }

  await syncNotesNotebookWithRetry(
    notebookFlag,
    async () => {
      const updated = await db.getNotesNote({
        notebookFlag,
        noteId: note.noteId,
      });
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
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const updated = await db.getNotesNote({ notebookFlag, noteId });
    return updated?.folderId === folderId;
  });
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
  await syncNotesNotebookWithRetry(notebookFlag, () =>
    folderMatches(notebookFlag, folder.folderId, (f) => f.name === nextName)
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
  await syncNotesNotebookWithRetry(notebookFlag, () =>
    folderMatches(
      notebookFlag,
      folder.folderId,
      (f) => f.parentFolderId === parentFolderId
    )
  );
}

async function folderMatches(
  notebookFlag: string,
  folderId: number,
  matches: (folder: db.NotesFolder) => boolean
) {
  return (await db.getNotesFolders({ notebookFlag })).some(
    (f) => f.folderId === folderId && matches(f)
  );
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
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const deleted = await db.getNotesNote({ notebookFlag, noteId });
    return deleted == null;
  });
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
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const nextFolders = await db.getNotesFolders({ notebookFlag });
    return folderIds.every(
      (folderId) =>
        !nextFolders.some((nextFolder) => nextFolder.folderId === folderId)
    );
  });
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

/**
 * Syncs the notebook, repeating until `isReady` reports the expected change
 * has landed locally. Gives up quietly if the change never appears (the API
 * call already succeeded); sync failures themselves still propagate.
 */
async function syncNotesNotebookWithRetry(
  notebookFlag: string,
  isReady?: () => Promise<boolean>,
  options?: SyncNotesNotebookOptions
) {
  await waitForNotesCondition(async () => {
    await syncNotesNotebook(notebookFlag, options);
    return isReady ? isReady() : true;
  });
}

async function waitForNotesCondition(isReady: () => Promise<boolean>) {
  try {
    await withRetry(async () => {
      if (!(await isReady())) {
        throw notYetSynced;
      }
    }, notesRetryOptions);
  } catch (e) {
    if (e !== notYetSynced) {
      throw e;
    }
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
