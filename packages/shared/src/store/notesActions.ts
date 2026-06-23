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

export async function syncNotesNotebook(flagInput: api.NotesFlag | string) {
  const { flag, parsed } = requireNotesNotebookFlag(flagInput);

  const [notebook, folders, notes, membersResult] = await Promise.all([
    api.notesV1.getNotebook(parsed),
    api.notesV1.listFolders(parsed),
    api.notesV1.listNotes(parsed),
    api.notesV1.listMembers(parsed).then(
      (members) => ({ ok: true as const, members }),
      (error) => ({ ok: false as const, error })
    ),
  ]);
  let members: api.NotesV1MemberRecord[] = [];
  let dbMembers: db.NotesMember[] = [];
  let currentUserRole: db.NotesRole | null | undefined;
  if (membersResult.ok) {
    members = membersResult.members;
    dbMembers = members.flatMap((member) => toDbMembers(flag, member));
  } else {
    logger.error('Failed to scry notes members', membersResult.error);
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
    notebook: toDbNotebook(notebook, members, currentUserRole),
    folders: folders.map((folder) =>
      toDbFolder(flag, folder, notebook.notebook.id)
    ),
    notes: notes.map((note) => toDbNote(flag, note, notebook.notebook.id)),
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
  const published = await api.listPublishedNotes();
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
  return createAndFindNewItem({
    notebookFlag,
    list: () => db.getNotesNotes({ notebookFlag }),
    getId: (note) => note.noteId,
    create: () =>
      api.notesV1.createNote({
        flag: notebookFlag,
        folder: folderId,
        title,
        body,
      }),
    findFallback: (notes) => notes.find((note) => note.title === title),
  });
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
      api.notesV1.createFolder({
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
    await api.notesV1.updateNoteBody({
      flag: notebookFlag,
      noteId: note.noteId,
      body,
      expectedRevision: note.revision,
    });
  }

  if (shouldRename) {
    await api.notesV1.renameNote({
      flag: notebookFlag,
      noteId: note.noteId,
      title: nextTitle,
    });
  }

  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const updated = await db.getNotesNote({
      notebookFlag,
      noteId: note.noteId,
    });
    return Boolean(
      updated &&
        (!shouldRename || updated.title === nextTitle) &&
        (!shouldUpdateBody || updated.bodyMd === body)
    );
  });
  return db.getNotesNote({ notebookFlag, noteId: note.noteId });
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
  await api.publishNotesNote({
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
  await api.unpublishNotesNote({
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
  await api.notesV1.moveNote({
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

  await api.notesV1.renameFolder({
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

  await api.notesV1.moveFolder({
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
  await api.notesV1.deleteNote({ flag: notebookFlag, noteId });
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

  await api.notesV1.deleteFolder({
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
  const notebooks = await api.notesV1.listNotebooks();
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
  isReady?: () => Promise<boolean>
) {
  await waitForNotesCondition(async () => {
    await syncNotesNotebook(notebookFlag);
    return isReady ? isReady() : true;
  });
}

async function waitForPublishedNoteState(
  notebookFlag: string,
  noteId: number,
  expected: boolean
) {
  await waitForNotesCondition(async () => {
    const published = await listPublishedNotesForNotebook(notebookFlag);
    return noteIsPublished(published, noteId) === expected;
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

function toDbNotebook(
  summary: api.NotesV1NotebookDetailSummary,
  members: api.NotesV1MemberRecord[],
  preservedCurrentUserRole?: db.NotesRole | null
): db.NotesNotebook {
  const flag = api.formatNotesFlag({
    host: summary.host,
    name: summary.flagName,
  });
  const currentUserId = api.getCurrentUserId();
  const currentMember = members.find((member) => member.ship === currentUserId);
  return {
    id: flag,
    host: summary.host,
    flagName: summary.flagName,
    notebookId: summary.notebook.id,
    title: summary.notebook.title,
    visibility: summary.visibility ?? null,
    rootFolderId: summary.notebook.rootFolderId,
    createdBy: summary.notebook.createdBy ?? null,
    createdAt: summary.notebook.createdAt ?? null,
    updatedBy: summary.notebook.updatedBy ?? null,
    updatedAt: summary.notebook.updatedAt ?? null,
    syncedAt: Date.now(),
    currentUserRole:
      preservedCurrentUserRole !== undefined
        ? preservedCurrentUserRole
        : currentMember?.roles[0] ??
          (summary.host === currentUserId ? ('owner' as const) : null),
  };
}

function toDbFolder(
  flag: string,
  folder: api.NotesV1Folder,
  notebookId: number
): db.NotesFolder {
  return {
    id: notesFolderDbId(flag, folder.id),
    notebookFlag: flag,
    folderId: folder.id,
    notebookId: folder.notebookId ?? notebookId,
    name: folder.name,
    parentFolderId: folder.parentFolderId,
    createdBy: folder.createdBy ?? null,
    createdAt: folder.createdAt ?? null,
    updatedBy: folder.updatedBy ?? null,
    updatedAt: folder.updatedAt ?? null,
    syncedAt: Date.now(),
  };
}

function toDbNote(
  flag: string,
  note: api.NotesV1Note,
  notebookId: number
): db.NotesNote {
  return {
    id: notesNoteDbId(flag, note.id),
    notebookFlag: flag,
    noteId: note.id,
    notebookId: note.notebookId ?? notebookId,
    folderId: note.folderId ?? 0,
    title: note.title,
    slug: note.slug ?? null,
    bodyMd: note.bodyMd ?? '',
    createdBy: note.createdBy ?? null,
    createdAt: note.createdAt ?? null,
    updatedBy: note.updatedBy ?? null,
    updatedAt: note.updatedAt ?? null,
    revision: note.revision ?? 0,
    syncedAt: Date.now(),
  };
}

function toDbMembers(
  flag: string,
  member: api.NotesV1MemberRecord
): db.NotesMember[] {
  const roles = member.roles.length > 0 ? member.roles : [null];
  return roles.map((role) => ({
    notebookFlag: flag,
    contactId: member.ship,
    role,
    syncedAt: Date.now(),
  }));
}

function notesFolderDbId(flag: string, folderId: number) {
  return `${flag}/folder/${folderId}`;
}

function notesNoteDbId(flag: string, noteId: number) {
  return `${flag}/note/${noteId}`;
}
