import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';

import { trackEvent } from '../analytics';
import * as db from '../db';
import type { WrappedQuery } from '../db/query';
import { queryClient } from '../db/reactQuery';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
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

export async function syncNotesNotebook(flagInput: api.NotesFlag | string) {
  const { flag, snapshot } = await fetchNotesNotebookSnapshot(flagInput);
  await db.saveNotesNotebookSnapshot(snapshot);
  return db.getNotesNotebookWithRelations({ notebookFlag: flag });
}

async function fetchNotesNotebookSnapshot(flagInput: api.NotesFlag | string) {
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
      notes: notes.map((note) =>
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

// ===========================================================================
// Applying u-notebook updates
//
// Both the write path and the stream carry the same typed update payloads,
// each holding the complete post-change entity. Applying them directly is
// what lets a mutation cost one request: the write's own response advances
// local state, and the stream's copy of that update is idempotent (the
// revision guard makes re-applying a no-op), so the echo of our own write
// costs nothing either.
//
// `applyNotesUpdate` returns false when it could not apply the update, which
// is the caller's signal to fall back to a full snapshot sync.
// ===========================================================================

// Updates must land in arrival order — folder rows carry no revision to
// break ties with, so two overlapping applies could otherwise commit out of
// order. One chain per notebook; independent notebooks stay concurrent.
const notesUpdateChains = new Map<string, Promise<unknown>>();

function serializeNotesUpdate<T>(
  notebookFlag: string,
  run: () => Promise<T>
): Promise<T> {
  const previous = notesUpdateChains.get(notebookFlag) ?? Promise.resolve();
  const next = previous.then(run, run);
  notesUpdateChains.set(
    notebookFlag,
    next.catch(() => {})
  );
  return next.finally(() => {
    if (notesUpdateChains.get(notebookFlag) === next) {
      notesUpdateChains.delete(notebookFlag);
    }
  });
}

export function applyNotesUpdate(
  notebookFlag: string,
  update: api.NotesUpdate
): Promise<boolean> {
  return serializeNotesUpdate(notebookFlag, () =>
    applyNotesUpdateNow(notebookFlag, update)
  );
}

async function applyNotesUpdateNow(
  notebookFlag: string,
  update: api.NotesUpdate
): Promise<boolean> {
  const syncedAt = Date.now();
  switch (update.type) {
    case 'note-created':
    case 'note-updated': {
      const notebook = await db.getNotesNotebook({ notebookFlag });
      if (!notebook) {
        // No local notebook row means nothing to attach the note to (the
        // foreign key would reject it) — the notebook itself has to sync first.
        return false;
      }
      const existing = await db.getNotesNote({
        notebookFlag,
        noteId: update.noteId,
      });
      const note = noteFromUpdate(
        notebookFlag,
        update.note,
        notebook,
        existing,
        syncedAt
      );
      if (!note) {
        return false;
      }
      await db.upsertNotesNote(note);
      return true;
    }
    case 'note-deleted':
      await db.deleteNotesNote({ notebookFlag, noteId: update.noteId });
      return true;
    case 'folder-created':
    case 'folder-updated': {
      const notebook = await db.getNotesNotebook({ notebookFlag });
      if (!notebook) {
        return false;
      }
      await db.upsertNotesFolder(
        folderForSnapshot(
          api.toClientNotesFolder(notebookFlag, update.folder),
          notebook.notebookId,
          syncedAt
        )
      );
      return true;
    }
    case 'folder-deleted': {
      // The host deletes a folder's subtree with it, and so must we — the
      // update names only the root of what went away.
      const folders = await db.getNotesFolders({ notebookFlag });
      const folderIds = Array.from(
        collectDescendantFolderIds(folders, update.folderId)
      );
      await db.deleteNotesFolders({
        notebookFlag,
        folderIds: folderIds.length > 0 ? folderIds : [update.folderId],
      });
      return true;
    }
    case 'member-joined': {
      await db.replaceNotesMemberRoles({
        notebookFlag,
        contactId: update.who,
        members: [
          {
            notebookFlag,
            contactId: update.who,
            role: update.role,
            syncedAt,
          },
        ],
      });
      if (update.who === api.getCurrentUserId()) {
        await db.updateNotesNotebook({
          notebookFlag,
          currentUserRole: update.role,
        });
      }
      return true;
    }
    case 'member-left': {
      await db.replaceNotesMemberRoles({
        notebookFlag,
        contactId: update.who,
        members: [],
      });
      if (update.who === api.getCurrentUserId()) {
        await db.updateNotesNotebook({ notebookFlag, currentUserRole: null });
      }
      return true;
    }
    case 'notebook-created':
    case 'notebook-updated':
      await db.updateNotesNotebook({
        notebookFlag,
        title: update.notebook.title,
        ...(update.notebook.rootFolderId != null
          ? { rootFolderId: update.notebook.rootFolderId }
          : {}),
        ...(update.notebook.updatedAt != null
          ? { updatedAt: update.notebook.updatedAt }
          : {}),
        ...(update.notebook.updatedBy != null
          ? { updatedBy: update.notebook.updatedBy }
          : {}),
      });
      return true;
    case 'notebook-visibility-changed':
      await db.updateNotesNotebook({
        notebookFlag,
        visibility: update.visibility,
      });
      return true;
    case 'notebook-deleted':
      await db.deleteNotesNotebook(notebookFlag);
      return true;
    case 'note-published':
    case 'note-unpublished':
      // Published state lives in the %notes /v0/published scry rather than
      // the notes tables, so there's no row to write — just drop the cached
      // list so the next read reflects the change.
      queryClient.invalidateQueries({
        queryKey: ['notesPublished', notebookFlag],
      });
      return true;
  }
}

// Apply a write's own response. The write has already succeeded by this point
// — `assertWriteOk` threw otherwise — so a false return is only ever "local
// state didn't advance, go read it", never "the change didn't happen".
async function applyWriteUpdate(
  notebookFlag: string,
  update: api.NotesUpdate | null,
  expectedType: api.NotesUpdate['type']
) {
  if (update?.type === expectedType) {
    return applyNotesUpdate(notebookFlag, update);
  }
  logger.error(
    'Unexpected %notes write update',
    update?.type ?? 'none',
    `expected ${expectedType}`
  );
  return false;
}

async function applyWriteUpdateOrSync(
  notebookFlag: string,
  update: api.NotesUpdate | null,
  expectedType: api.NotesUpdate['type']
) {
  if (!(await applyWriteUpdate(notebookFlag, update, expectedType))) {
    await syncNotesNotebook(notebookFlag);
  }
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
      .subscribeToNotesNotebook(notebookFlag, (event) => {
        // A `snapshot` event is the agent's subscribe-time (or post-reconnect)
        // marker, not a change — resync to pick up whatever we missed while
        // disconnected. Everything else carries the change itself.
        if (event.type !== 'update' || !event.update) {
          syncActiveNotebook(notebookFlag);
          return;
        }
        applyNotesUpdate(notebookFlag, event.update)
          .then((applied) => {
            if (!applied) {
              syncActiveNotebook(notebookFlag);
            }
          })
          .catch((e) => {
            logger.error('Failed to apply notes stream update', e);
            syncActiveNotebook(notebookFlag);
          });
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

// Fallback for a create whose response carried no usable update: poll a sync
// until a row appears that wasn't there before and matches what we asked for.
// The baseline is the local table — free to read, unlike the pre-write
// snapshot fetch this replaces — so the create can't hand back a note that
// merely shares its title. Only reached when the host answers a successful
// create without an update; the write itself has already landed, so a lagging
// replica is the only thing being waited out.
async function findCreatedItemAfterSync<T>({
  notebookFlag,
  knownIds,
  getItems,
  getId,
  matches,
}: {
  notebookFlag: string;
  knownIds: ReadonlySet<number>;
  getItems: (snapshot: NotesNotebookSnapshot) => readonly T[];
  getId: (item: T) => number;
  matches: (item: T) => boolean;
}): Promise<T | null> {
  return syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    getItems(snapshot)
      .filter((item) => !knownIds.has(getId(item)) && matches(item))
      // Ids ascend, so when several new rows match, ours is the newest.
      .reduce<T | null>(
        (newest, item) =>
          !newest || getId(item) > getId(newest) ? item : newest,
        null
      )
  );
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
  const knownNoteIds = new Set(
    (await db.getNotesNotes({ notebookFlag })).map((note) => note.noteId)
  );
  const update = await api.notes.createNote({
    flag: notebookFlag,
    folder: folderId,
    title,
    body,
  });

  // The payload is the created note in full — id, host-assigned revision and
  // stamps included — so there is nothing left to read back.
  if (
    update?.type === 'note-created' &&
    (await applyNotesUpdate(notebookFlag, update))
  ) {
    return db.getNotesNote({ notebookFlag, noteId: update.noteId });
  }

  logger.error(
    'Note create returned no usable update; falling back to sync',
    update?.type ?? 'none'
  );
  const note = await findCreatedItemAfterSync({
    notebookFlag,
    knownIds: knownNoteIds,
    getItems: (snapshot) => snapshot.notes,
    getId: (note) => note.noteId,
    matches: (note) => note.title === title && note.folderId === folderId,
  });
  return note ? db.getNotesNote({ notebookFlag, noteId: note.noteId }) : null;
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
  const knownFolderIds = new Set(
    (await db.getNotesFolders({ notebookFlag })).map(
      (folder) => folder.folderId
    )
  );
  const update = await api.notes.createFolder({
    flag: notebookFlag,
    parent: parentFolderId ?? undefined,
    name,
  });

  if (
    update?.type === 'folder-created' &&
    (await applyNotesUpdate(notebookFlag, update))
  ) {
    const folders = await db.getNotesFolders({ notebookFlag });
    return (
      folders.find((folder) => folder.folderId === update.folderId) ?? null
    );
  }

  logger.error(
    'Folder create returned no usable update; falling back to sync',
    update?.type ?? 'none'
  );
  return findCreatedItemAfterSync({
    notebookFlag,
    knownIds: knownFolderIds,
    getItems: (snapshot) => snapshot.folders,
    getId: (folder) => folder.folderId,
    matches: (folder) =>
      folder.name === name && (folder.parentFolderId ?? null) === parentId,
  });
}

/**
 * Import a folder/note tree into a notebook in a single poke.
 *
 * The host walks the tree creating every folder and note, so the client
 * neither loops nor waits: each created entity arrives as its own stream
 * update and is applied by `applyNotesUpdate`. One sync afterwards closes
 * the gap for anything that landed while unsubscribed, and gives the caller
 * the created rows to report on.
 */
export async function importNotebookTree({
  notebookFlag,
  parentFolderId,
  tree,
}: {
  notebookFlag: string;
  parentFolderId: number;
  tree: api.NotesImportNode[];
}) {
  if (tree.length === 0) {
    return { noteCount: 0 };
  }

  await api.batchImportNotesTreeV1({
    flag: notebookFlag,
    parent: parentFolderId,
    tree,
    requestId: api.generateNotesRequestId(),
  });

  // The %ok envelope only carries the last of the many updates this poke
  // emits, so converge on the stream's copies with one sync rather than
  // trying to reconstruct the batch from the response.
  await syncNotesNotebook(notebookFlag);

  return { noteCount: countImportedNotes(tree) };
}

function countImportedNotes(tree: api.NotesImportNode[]): number {
  return tree.reduce(
    (total, node) =>
      total + ('children' in node ? countImportedNotes(node.children) : 1),
    0
  );
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
    const applied = await api.notes.renameNote({
      flag: notebookFlag,
      noteId: note.noteId,
      title: nextTitle,
    });
    // A successful rename means the host's title is exactly the string we
    // sent (renames don't bump the revision). Persist it with the response
    // payload's host-stamped updatedAt/updatedBy, so a stale snapshot
    // already in flight can't win the equal-revision tiebreak and reload
    // the old title over this write.
    await persistNoteWrite(notebookFlag, note.noteId, {
      title: applied?.title ?? nextTitle,
      applied,
    });
  }

  // Everything the writes determined is persisted from their responses.
  // No read-back wait: the old poll-until-visible loop here is what
  // silently returned stale revisions when the replica lagged.
  const savedNote = await db.getNotesNote({
    notebookFlag,
    noteId: note.noteId,
  });
  if (savedNote) {
    trackEvent(AnalyticsEvent.NoteSaved);
  }
  return savedNote;
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
// by our *own* already-applied write — e.g. an earlier save applied on the
// host but its local persist never landed (the process died in between) —
// which is safe to rebase over. Both fields must
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
      await persistNoteWrite(notebookFlag, note.noteId, {
        bodyMd: body,
        revision: remoteRevision,
        applied: remote,
      });
      return;
    }
    const lastSaved = lastSavedNoteState.get(noteKey);
    if (
      lastSaved &&
      remote.bodyMd === lastSaved.body &&
      remoteRevision === lastSaved.revision
    ) {
      // The "conflicting" revision is exactly the state our own previous
      // save produced, so only its local persist never landed. The
      // draft evolved from that content; rebasing onto the host's revision
      // loses nothing. The retry itself can race another writer — surface
      // that as a fresh conflict rather than a generic failure.
      let retryResult: api.NotesV1NoteWriteResult;
      try {
        retryResult = await api.notes.updateNoteBody({
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
      const retryRevision = retryResult.note?.revision ?? remoteRevision + 1;
      lastSavedNoteState.set(noteKey, { body, revision: retryRevision });
      await persistNoteWrite(notebookFlag, note.noteId, {
        bodyMd: body,
        revision: retryRevision,
        applied: retryResult.note,
      });
      return;
    }
    throw new NotesNoteConflictError(remote);
  }
  // %no-change means the host body already matched and the revision was NOT
  // bumped — persisting expected + 1 would put the local DB one revision
  // ahead of the host and re-wedge the next save. When the ok envelope
  // carries the applied note, its revision is authoritative.
  const nextRevision =
    result.note?.revision ??
    (result.status === 'no-change' ? expectedRevision : expectedRevision + 1);
  lastSavedNoteState.set(noteKey, { body, revision: nextRevision });
  await persistNoteWrite(notebookFlag, note.noteId, {
    bodyMd: body,
    revision: nextRevision,
    applied: result.note,
  });
}

// Persist a write's outcome to the local row. The revision comes from the
// response payload when present, else the response contract (a successful
// body update lands on exactly expectedRevision + 1) — no read-back either
// way. The payload is the host's authoritative post-write note, so every
// field it carries is persisted (explicit write fields win): a body PUT
// applied on top of another client's same-revision rename/move returns
// their title/folder, and persisting only our own fields would fabricate a
// row that the snapshot merge then defends against the very snapshot
// carrying the remote metadata. The host stamps also let the merge's
// equal-revision tiebreak defend this write against stale snapshots
// already in flight.
async function persistNoteWrite(
  notebookFlag: string,
  noteId: number,
  write: {
    bodyMd?: string;
    title?: string;
    revision?: number;
    applied?: {
      title?: string | null;
      bodyMd?: string | null;
      folderId?: number | null;
      revision?: number | null;
      updatedAt?: number | null;
      updatedBy?: string | null;
    } | null;
  }
) {
  const { applied, ...fields } = write;
  // db.updateNotesNote is revision-monotonic: carrying the revision (from
  // the explicit write or the payload) arms its atomic guard, so a newer
  // row synced between our response and this persist is never downgraded.
  // The payload's fields are persisted as a unit — body INCLUDED: a
  // rename-only save racing a remote body edit returns the host's newer
  // body and revision together, and persisting the revision without the
  // body would fabricate a row that lets the next body edit pass the
  // optimistic-concurrency check and silently overwrite the remote edit.
  await db.updateNotesNote({
    notebookFlag,
    noteId,
    ...(applied?.title != null ? { title: applied.title } : {}),
    ...(applied?.bodyMd != null ? { bodyMd: applied.bodyMd } : {}),
    ...(applied?.folderId != null ? { folderId: applied.folderId } : {}),
    ...(applied?.revision != null ? { revision: applied.revision } : {}),
    ...(applied?.updatedAt != null ? { updatedAt: applied.updatedAt } : {}),
    ...(applied?.updatedBy != null ? { updatedBy: applied.updatedBy } : {}),
    ...fields,
  });
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
  // decided), and adopting would downgrade it. db.updateNotesNote's atomic
  // revision guard (equal revisions tie-broken on updatedAt) skips the
  // write in that case, and the read below returns whichever copy won —
  // the editor converges on it either way.
  await db.updateNotesNote({
    notebookFlag,
    noteId: remote.noteId,
    title: remote.title,
    bodyMd: remote.bodyMd ?? '',
    // The conflicting edit can ride along with a move; leave the folder
    // untouched when the read omits it.
    ...(remote.folderId != null ? { folderId: remote.folderId } : {}),
    revision: remote.revision ?? 0,
    ...(remote.updatedAt != null ? { updatedAt: remote.updatedAt } : {}),
    ...(remote.updatedBy != null ? { updatedBy: remote.updatedBy } : {}),
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
  trackEvent(AnalyticsEvent.NotePublished);
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
  trackEvent(AnalyticsEvent.NoteUnpublished);
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
  const update = await api.notes.moveNote({
    flag: notebookFlag,
    noteId,
    folder: folderId,
  });
  await applyWriteUpdateOrSync(notebookFlag, update, 'note-updated');
  trackEvent(AnalyticsEvent.NoteMoved);
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

  const update = await api.notes.renameFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    name: nextName,
  });
  await applyWriteUpdateOrSync(notebookFlag, update, 'folder-updated');
  trackEvent(AnalyticsEvent.NotesFolderRenamed);
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

  const update = await api.notes.moveFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    parent: parentFolderId,
  });
  await applyWriteUpdateOrSync(notebookFlag, update, 'folder-updated');
  trackEvent(AnalyticsEvent.NotesFolderMoved);
}

export async function deleteNotebookNote({
  notebookFlag,
  noteId,
}: {
  notebookFlag: string;
  noteId: number;
}) {
  const update = await api.notes.deleteNote({ flag: notebookFlag, noteId });
  if (!(await applyWriteUpdate(notebookFlag, update, 'note-deleted'))) {
    await db.deleteNotesNote({ notebookFlag, noteId });
    // A plain resync here would let a lagging replica resurrect the row, so
    // adopt only a snapshot that already agrees the note is gone.
    await syncNotesNotebookUntil(
      notebookFlag,
      (snapshot) => !snapshot.notes.some((note) => note.noteId === noteId)
    );
  }
  trackEvent(AnalyticsEvent.NoteDeleted);
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

  const update = await api.notes.deleteFolder({
    flag: notebookFlag,
    folderId: folder.folderId,
    recursive: true,
  });
  if (!(await applyWriteUpdate(notebookFlag, update, 'folder-deleted'))) {
    await db.deleteNotesFolders({ notebookFlag, folderIds });
    await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
      folderIds.every(
        (folderId) =>
          !snapshot.folders.some(
            (nextFolder) => nextFolder.folderId === folderId
          )
      )
    );
  }
  trackEvent(AnalyticsEvent.NotesFolderDeleted);
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
  ) => ReadyValue<T> | Promise<ReadyValue<T>>
) {
  let readySnapshot: NotesNotebookSnapshot | null = null;
  let readyValue: T | null = null;
  try {
    await withRetry(async () => {
      const { snapshot } = await fetchNotesNotebookSnapshot(notebookFlag);
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

// Build a note row from an update payload. The wire schema requires every
// field, so the fallbacks only cover a host that under-fills one; when even
// they can't supply a NOT NULL column, return null so the caller resyncs
// instead of writing a row with invented values.
function noteFromUpdate(
  notebookFlag: string,
  raw: api.NotesV1Note,
  notebook: db.NotesNotebook,
  existingNote: db.NotesNote | null,
  syncedAt: number
): db.NotesNote | null {
  const note = api.toClientNotesNote(notebookFlag, raw);
  const folderId =
    note.folderId ?? existingNote?.folderId ?? notebook.rootFolderId;
  if (folderId == null) {
    logger.error('Dropping %notes note update with no resolvable folder', {
      notebookFlag,
      noteId: note.noteId,
    });
    return null;
  }
  return {
    ...note,
    notebookId:
      note.notebookId ?? existingNote?.notebookId ?? notebook.notebookId,
    folderId,
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
