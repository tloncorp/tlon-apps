import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const logger = createDevLogger('notesActions', false);

const NOTES_SYNC_STALE_TIME = 15_000;

export function notesNotebookFlagFromChannelId(channelId: string) {
  const flag = api.parseNotesChannelId(channelId);
  return flag ? api.formatNotesFlag(flag) : null;
}

export async function syncNotesNotebook(flagInput: api.NotesFlag | string) {
  const flag = api.formatNotesFlag(flagInput);
  const parsed = api.parseNotesFlag(flag);
  if (!parsed) {
    throw new Error(`Invalid notes notebook flag: ${flag}`);
  }

  const [notebook, folders, notes, members] = await Promise.all([
    api.getNotesNotebook(parsed),
    api.listNotesFolders(parsed),
    api.listNotes(parsed),
    api.listNotesMembers(parsed).catch((e) => {
      logger.error('Failed to scry notes members', e);
      return [] as api.NotesMemberRecord[];
    }),
  ]);

  const summary =
    notebook ??
    (await api.listNotesNotebooks()).find(
      (candidate) =>
        candidate.host === parsed.host && candidate.flagName === parsed.name
    );

  if (!summary) {
    throw new Error(`Notes notebook not found: ${flag}`);
  }

  await db.saveNotesNotebookSnapshot({
    notebook: toDbNotebook(summary, members),
    folders: folders.map((folder) => toDbFolder(flag, folder)),
    notes: notes.map((note) => toDbNote(flag, note)),
    members: members.map((member) => toDbMember(flag, member)),
  });

  return db.getNotesNotebookWithRelations({ notebookFlag: flag });
}

export async function ensureNotesNotebookJoined(
  flagInput: api.NotesFlag | string
) {
  const flag = api.formatNotesFlag(flagInput);
  const parsed = api.parseNotesFlag(flag);
  if (!parsed) {
    throw new Error(`Invalid notes notebook flag: ${flag}`);
  }

  const currentUserId = api.getCurrentUserId();
  const isHost = parsed.host === currentUserId;
  if (isHost || (await notesNotebookIsJoined(parsed))) {
    await syncNotesNotebook(parsed).catch((e) => {
      logger.error('Failed to sync joined notes notebook', e);
    });
    return true;
  }

  await api.joinNotesNotebook(parsed);

  for (let i = 0; i < 10; i++) {
    if (await notesNotebookIsJoined(parsed)) {
      await syncNotesNotebook(parsed);
      return true;
    }
    await wait(350);
  }

  return false;
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

export function useNotesNotebook(
  notebookFlag: string | null | undefined,
  enabled = true
) {
  const deps = useKeyFromQueryDeps(db.getNotesNotebook, {
    notebookFlag: notebookFlag ?? '',
  });
  return useQuery({
    queryKey: ['notesNotebook', deps, notebookFlag],
    queryFn: () => db.getNotesNotebook({ notebookFlag: notebookFlag! }),
    enabled: enabled && Boolean(notebookFlag),
  });
}

export function useNotesFolders(
  notebookFlag: string | null | undefined,
  enabled = true
) {
  const deps = useKeyFromQueryDeps(db.getNotesFolders, {
    notebookFlag: notebookFlag ?? '',
  });
  return useQuery({
    queryKey: ['notesFolders', deps, notebookFlag],
    queryFn: () => db.getNotesFolders({ notebookFlag: notebookFlag! }),
    enabled: enabled && Boolean(notebookFlag),
  });
}

export function useNotesNotes(
  notebookFlag: string | null | undefined,
  enabled = true
) {
  const deps = useKeyFromQueryDeps(db.getNotesNotes, {
    notebookFlag: notebookFlag ?? '',
  });
  return useQuery({
    queryKey: ['notesNotes', deps, notebookFlag],
    queryFn: () => db.getNotesNotes({ notebookFlag: notebookFlag! }),
    enabled: enabled && Boolean(notebookFlag),
  });
}

export function useNotesMembers(
  notebookFlag: string | null | undefined,
  enabled = true
) {
  const deps = useKeyFromQueryDeps(db.getNotesMembers, {
    notebookFlag: notebookFlag ?? '',
  });
  return useQuery({
    queryKey: ['notesMembers', deps, notebookFlag],
    queryFn: () => db.getNotesMembers({ notebookFlag: notebookFlag! }),
    enabled: enabled && Boolean(notebookFlag),
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
  const before = await db.getNotesNotes({ notebookFlag });
  const beforeIds = new Set(before.map((note) => note.noteId));

  await api.createNotesNote({
    flag: notebookFlag,
    folder: folderId,
    title,
    body,
  });

  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const after = await db.getNotesNotes({ notebookFlag });
    return after.some((note) => !beforeIds.has(note.noteId));
  });

  const after = await db.getNotesNotes({ notebookFlag });
  return (
    after.find((note) => !beforeIds.has(note.noteId)) ??
    after.find((note) => note.title === title) ??
    null
  );
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
  const before = await db.getNotesFolders({ notebookFlag });
  const beforeIds = new Set(before.map((folder) => folder.folderId));

  await api.createNotesFolder({
    flag: notebookFlag,
    parent: parentFolderId,
    name,
  });
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const after = await db.getNotesFolders({ notebookFlag });
    return after.some((folder) => !beforeIds.has(folder.folderId));
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
  const nextTitle = title.trim() || 'Untitled';
  const shouldRename = nextTitle !== note.title;
  const shouldUpdateBody = body !== note.bodyMd;

  if (!shouldRename && !shouldUpdateBody) {
    return note;
  }

  if (shouldRename) {
    await api.renameNotesNote({
      flag: notebookFlag,
      noteId: note.noteId,
      title: nextTitle,
    });
  }

  if (shouldUpdateBody) {
    await api.updateNotesNoteBody({
      flag: notebookFlag,
      noteId: note.noteId,
      body,
      expectedRevision: note.revision,
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

export async function moveNotebookNote({
  notebookFlag,
  noteId,
  folderId,
}: {
  notebookFlag: string;
  noteId: number;
  folderId: number;
}) {
  await api.moveNotesNote({
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

  await api.renameNotesFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    name: nextName,
  });
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const folders = await db.getNotesFolders({ notebookFlag });
    return folders.some(
      (candidate) =>
        candidate.folderId === folder.folderId && candidate.name === nextName
    );
  });
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

  await api.moveNotesFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    newParent: parentFolderId,
  });
  await syncNotesNotebookWithRetry(notebookFlag, async () => {
    const folders = await db.getNotesFolders({ notebookFlag });
    return folders.some(
      (candidate) =>
        candidate.folderId === folder.folderId &&
        candidate.parentFolderId === parentFolderId
    );
  });
}

export async function deleteNotebookNote({
  notebookFlag,
  noteId,
}: {
  notebookFlag: string;
  noteId: number;
}) {
  await api.deleteNotesNote({ flag: notebookFlag, noteId });
  await db.deleteNotesNote({ notebookFlag, noteId });
  syncNotesNotebookWithRetry(notebookFlag).catch((e) => {
    logger.error('Failed to refresh after deleting notes note', e);
  });
}

export async function deleteNotebookFolder({
  notebookFlag,
  folderId,
  recursive = false,
}: {
  notebookFlag: string;
  folderId: number;
  recursive?: boolean;
}) {
  await api.deleteNotesFolder({ flag: notebookFlag, folderId, recursive });
  await syncNotesNotebookWithRetry(notebookFlag);
}

export async function markNotesNotebookOpened(notebookFlag: string) {
  return db.setNotesNotebookLastOpened({
    notebookFlag,
    openedAt: Date.now(),
  });
}

async function notesNotebookIsJoined(flag: api.NotesFlag) {
  const notebooks = await api.listNotesNotebooks();
  return notebooks.some(
    (notebook) => notebook.host === flag.host && notebook.flagName === flag.name
  );
}

async function syncNotesNotebookWithRetry(
  notebookFlag: string,
  isReady?: () => Promise<boolean>
) {
  for (let i = 0; i < 8; i++) {
    await syncNotesNotebook(notebookFlag);
    if (!isReady || (await isReady())) {
      return;
    }
    await wait(300);
  }
}

function toDbNotebook(
  summary: api.NotesNotebookSummary,
  members: api.NotesMemberRecord[]
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
    rootFolderId: summary.notebook.id + 1,
    createdBy: summary.notebook.createdBy,
    createdAt: summary.notebook.createdAt,
    updatedBy: summary.notebook.updatedBy,
    updatedAt: summary.notebook.updatedAt,
    syncedAt: Date.now(),
    currentUserRole:
      currentMember?.role ??
      (summary.host === currentUserId ? ('owner' as const) : null),
  };
}

function toDbFolder(flag: string, folder: api.NotesFolder): db.NotesFolder {
  return {
    id: notesFolderDbId(flag, folder.id),
    notebookFlag: flag,
    folderId: folder.id,
    notebookId: folder.notebookId,
    name: folder.name,
    parentFolderId: folder.parentFolderId,
    createdBy: folder.createdBy,
    createdAt: folder.createdAt,
    updatedBy: folder.updatedBy,
    updatedAt: folder.updatedAt,
    syncedAt: Date.now(),
  };
}

function toDbNote(flag: string, note: api.NotesNote): db.NotesNote {
  return {
    id: notesNoteDbId(flag, note.id),
    notebookFlag: flag,
    noteId: note.id,
    notebookId: note.notebookId,
    folderId: note.folderId,
    title: note.title,
    slug: note.slug,
    bodyMd: note.bodyMd,
    createdBy: note.createdBy,
    createdAt: note.createdAt,
    updatedBy: note.updatedBy,
    updatedAt: note.updatedAt,
    revision: note.revision,
    syncedAt: Date.now(),
  };
}

function toDbMember(
  flag: string,
  member: api.NotesMemberRecord
): db.NotesMember {
  return {
    notebookFlag: flag,
    contactId: member.ship,
    role: member.role,
    syncedAt: Date.now(),
  };
}

function notesFolderDbId(flag: string, folderId: number) {
  return `${flag}/folder/${folderId}`;
}

function notesNoteDbId(flag: string, noteId: number) {
  return `${flag}/note/${noteId}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
