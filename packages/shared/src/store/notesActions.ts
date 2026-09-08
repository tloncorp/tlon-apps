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
const NOTES_ACTIVITY_REFRESH_DEBOUNCE = 2_000;
const NOTES_SNAPSHOT_MAX_AGE = 5 * 60 * 1000;

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

const notebookSnapshotChains = new Map<string, Promise<void>>();

// Serializes snapshot work per notebook. `saveNotesNotebookSnapshot`
// replaces the notebook's rows wholesale, so two fetch-and-save pairs in
// flight at once can land out of order and regress the local copy — the
// older response deletes rows it never saw, resurrecting a deleted note or
// dropping a new one. Every path that writes a snapshot goes through here
// (refreshes, the create/delete confirmation polls), so they queue behind
// each other instead of racing. The stored tail is void-valued and evicted
// once it settles, so a queue slot never pins a notebook's notes in memory.
function queueNotebookSnapshot<T>(flag: string, run: () => Promise<T>) {
  const result = (notebookSnapshotChains.get(flag) ?? Promise.resolve()).then(
    run
  );
  // the tail swallows failures — a caller whose write threw must not reject
  // the next one — and drops the result value
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  notebookSnapshotChains.set(flag, tail);
  void tail.then(() => {
    if (notebookSnapshotChains.get(flag) === tail) {
      notebookSnapshotChains.delete(flag);
    }
  });
  return result;
}

export async function syncNotesNotebook(
  flagInput: api.NotesFlag | string,
  options: SyncNotesNotebookOptions = {}
) {
  const { flag } = requireNotesNotebookFlag(flagInput);
  return queueNotebookSnapshot(flag, async () => {
    const { snapshot } = await fetchNotesNotebookSnapshot(flagInput, options);
    await db.saveNotesNotebookSnapshot(snapshot);
    return db.getNotesNotebookWithRelations({ notebookFlag: flag });
  });
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
      ? (existingNotebook.currentUserRole ?? null)
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

const warmingNotebooks = new Set<string>();
// flag -> how many times activity has marked it stale, so a refresh can
// tell whether a mark arrived while it was already in flight
const notebookStaleMarks = new Map<string, number>();
// One extra pass covers marks raised during the refresh; past that the
// leftover mark stays and the next display-driven warm picks it up rather
// than looping here indefinitely on a busy notebook.
const NOTES_WARM_MAX_PASSES = 2;
// floor for the next scheduled check, so a snapshot that's already past its
// window (a failed refresh, say) doesn't turn the interval into a spin
const NOTES_WARM_MIN_INTERVAL = 30_000;

// Revalidate a notebook's cached snapshot when something is displaying data
// derived from it (e.g. the channel list's note/folder counts). Refetches
// when activity marked the notebook stale, or when the cache has aged out —
// %notes only streams to an open notebook screen and only reports notes to
// %activity, so folder mutations, deletions, and changes we made from
// another device reach us through nothing at all, and aging out is the only
// way those land. Throws on failure so React Query retries rather than
// treating a failed warm as five fresh minutes.
//
// Returns the `syncedAt` of the snapshot this call left in place (null when
// another warm holds the slot), so the caller can time its next check by
// that snapshot's age rather than by when this check happened.
export async function warmNotesNotebookSnapshot(
  flagInput: api.NotesFlag | string
): Promise<number | null> {
  const { flag } = requireNotesNotebookFlag(flagInput);
  if (warmingNotebooks.has(flag)) {
    return null;
  }
  warmingNotebooks.add(flag);
  try {
    const cached = await db.getNotesNotebook({ notebookFlag: flag });
    if (
      !notebookStaleMarks.has(flag) &&
      cached?.syncedAt &&
      Date.now() - cached.syncedAt < NOTES_SNAPSHOT_MAX_AGE
    ) {
      return cached.syncedAt;
    }
    // A mark raised while a refresh is in flight isn't covered by that
    // refresh, and React Query folds its invalidation into the fetch already
    // running — so compare the mark count across the refresh and go again
    // when it moved, rather than clearing a mark we never fetched for.
    let syncedAt: number | null = null;
    for (let pass = 0; pass < NOTES_WARM_MAX_PASSES; pass++) {
      const marks = notebookStaleMarks.get(flag) ?? 0;
      syncedAt = (await syncNotesNotebook(flag))?.syncedAt ?? null;
      if ((notebookStaleMarks.get(flag) ?? 0) === marks) {
        // cleared only once a refresh has actually covered every mark; a
        // failed refresh throws out of here and leaves them in place
        notebookStaleMarks.delete(flag);
        break;
      }
    }
    return syncedAt;
  } finally {
    warmingNotebooks.delete(flag);
  }
}

// Keeps the snapshot behind displayed counts from aging out while the thing
// displaying them stays mounted — a nav row can sit there for a whole
// session, and folder changes reach us through no subscription. One query
// per notebook however many rows mount it, and the interval only runs while
// at least one of them is on screen.
export function useWarmNotesNotebookSnapshot({
  notebookFlag,
  enabled = true,
}: {
  notebookFlag: string | null | undefined;
  enabled?: boolean;
}) {
  useQuery({
    queryKey: ['notesSnapshotWarm', notebookFlag],
    queryFn: () => warmNotesNotebookSnapshot(notebookFlag!),
    enabled: enabled && Boolean(notebookFlag),
    // the global default is `Infinity`; this is what makes the revalidate
    // happen at all
    staleTime: NOTES_SNAPSHOT_MAX_AGE,
    // timed off the snapshot we ended up with, not off this check: a check
    // that found a four-minute-old snapshot and skipped the fetch has to
    // come back in a minute, or the counts could reach twice the window
    refetchInterval: ({ state }) =>
      state.data == null
        ? NOTES_SNAPSHOT_MAX_AGE
        : Math.max(
            NOTES_WARM_MIN_INTERVAL,
            state.data + NOTES_SNAPSHOT_MAX_AGE - Date.now()
          ),
  });
}

const notebookStaleNudges = new Map<string, () => void>();

// Activity told us a notebook's contents changed (see the call site for
// which signals qualify). A snapshot is four requests plus a wholesale
// local save, so don't fetch on the strength of the event alone: mark the
// notebook stale and invalidate its warm query with `refetchType: 'active'`.
// A notebook something is displaying refreshes right away; one nothing is
// showing waits, and the stale mark makes the next row that mounts refetch
// even though the cache still looks fresh.
// %notes collapses a create and the edits that follow it inside its activity
// window into a single %note-edit (see +note-activity-wake), so "edit"
// doesn't mean the counts held: an edit naming a note we've never stored is
// a creation as far as they're concerned. A note we do have was a body or
// title change, which can't move either count.
export async function markNotesNotebookStaleForNoteEvent({
  channelId,
  noteId,
  created,
}: {
  channelId: string;
  noteId: string | null | undefined;
  created: boolean;
}) {
  if (created) {
    markNotesNotebookStale(channelId);
    return;
  }
  const flag = notesNotebookFlagFromChannelId(channelId);
  const parsedNoteId = noteId == null ? NaN : Number(noteId);
  if (!flag || !Number.isFinite(parsedNoteId)) {
    return;
  }
  const stored = await db.getNotesNote({
    notebookFlag: flag,
    noteId: parsedNoteId,
  });
  if (!stored) {
    markNotesNotebookStale(channelId);
  }
}

export function markNotesNotebookStale(channelId: string) {
  const flag = notesNotebookFlagFromChannelId(channelId);
  if (!flag) {
    return;
  }
  // the mark itself lands immediately, so a refresh starting right now can
  // see it; only the query nudge is debounced, since one change can arrive
  // as a burst of events
  notebookStaleMarks.set(flag, (notebookStaleMarks.get(flag) ?? 0) + 1);
  let nudge = notebookStaleNudges.get(flag);
  if (!nudge) {
    nudge = debounce(
      () => {
        queryClient.invalidateQueries({
          queryKey: ['notesSnapshotWarm', flag],
          refetchType: 'active',
        });
      },
      NOTES_ACTIVITY_REFRESH_DEBOUNCE,
      { leading: false, trailing: true }
    );
    notebookStaleNudges.set(flag, nudge);
  }
  nudge();
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

// Not a per-notebook hook: the channel list reads counts for every notebook
// it renders, so a single shared query keeps it to one read per change.
export function useNotesCountsByNotebook(enabled = true) {
  const deps = useKeyFromQueryDeps(db.getNotesCountsByNotebook);
  return useQuery({
    queryKey: ['notesCountsByNotebook', deps],
    queryFn: () => db.getNotesCountsByNotebook(),
    enabled,
  });
}

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
  // queued like any other snapshot write, so a concurrent refresh can't
  // land its older copy on top of this baseline
  const baseline = await queueNotebookSnapshot(notebookFlag, async () => {
    const { snapshot } = await fetchNotesNotebookSnapshot(notebookFlag);
    await db.saveNotesNotebookSnapshot(snapshot);
    return snapshot;
  });

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
  // The baseline, the create, and the write-through of its response are one
  // queued unit. Every snapshot writer fetches and saves inside its own unit,
  // so a refresh slotting in between the create and the write-through would
  // fetch a pre-create list and then save it over the new row —
  // `saveNotesNotebookSnapshot` drops notes its response omits, and the
  // revision guard only protects rows that response also carries.
  const { baseline, note: appliedNote } = await queueNotebookSnapshot(
    notebookFlag,
    async () => {
      const { snapshot } = await fetchNotesNotebookSnapshot(notebookFlag);
      await db.saveNotesNotebookSnapshot(snapshot);

      const created = await api.notes.createNote({
        flag: notebookFlag,
        folder: folderId,
        title,
        body,
      });
      if (!created) {
        return { baseline: snapshot, note: null };
      }
      // The write response comes from the notebook host and is authoritative.
      // Do not immediately confirm it through getNote: for remote notebooks
      // that read hits the local replica, which can legitimately lag the
      // response.
      const note = {
        ...api.toClientNotesNote(notebookFlag, created),
        notebookId: created.notebookId ?? snapshot.notebook.notebookId,
        folderId: created.folderId ?? folderId,
        bodyMd: created.bodyMd ?? body,
        revision: created.revision ?? 0,
      };
      await db.upsertNotesNote(note);
      return { baseline: snapshot, note };
    }
  );
  if (appliedNote) {
    return appliedNote;
  }

  // Older hosts return no applied note. Only that compatibility path needs to
  // discover the new id by comparing a fresh list against the baseline.
  const beforeIds = new Set(baseline.notes.map((note) => note.noteId));
  const note = await syncNotesNotebookUntil<db.NotesNote>(
    notebookFlag,
    (snapshot) => {
      const newNotes = snapshot.notes.filter(
        (candidate) => !beforeIds.has(candidate.noteId)
      );
      return (
        newNotes.find((candidate) => candidate.title === title) ??
        newNotes[0] ??
        null
      );
    }
  );

  if (!note) {
    return null;
  }

  await syncNotesNotebookUntil(
    notebookFlag,
    (snapshot) =>
      snapshotNoteMatches(snapshot, note.noteId, (n) => n.bodyMd === body),
    { hydrateNoteIds: [note.noteId], requireHydratedNotes: true }
  );

  const createdNote = await db.getNotesNote({
    notebookFlag,
    noteId: note.noteId,
  });
  return createdNote;
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
  const folder = await createAndFindNewItem({
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
  return folder;
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
  await api.notes.moveNote({
    flag: notebookFlag,
    noteId,
    folder: folderId,
  });
  const confirmed = await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotNoteMatches(snapshot, noteId, (note) => note.folderId === folderId)
  );
  if (confirmed) {
    trackEvent(AnalyticsEvent.NoteMoved);
  }
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
  const confirmed = await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotFolderMatches(snapshot, folder.folderId, (f) => f.name === nextName)
  );
  if (confirmed) {
    trackEvent(AnalyticsEvent.NotesFolderRenamed);
  }
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
  const confirmed = await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    snapshotFolderMatches(
      snapshot,
      folder.folderId,
      (f) => f.parentFolderId === parentFolderId
    )
  );
  if (confirmed) {
    trackEvent(AnalyticsEvent.NotesFolderMoved);
  }
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
  // The remote delete and the local one form a queued unit. Every snapshot
  // writer fetches and saves inside its own unit, so without this a refresh
  // that fetched before the delete saves its pre-delete copy afterwards and
  // resurrects the note: `saveNotesNotebookSnapshot` replaces the notebook's
  // notes wholesale, and its revision guard only protects rows the incoming
  // snapshot also carries, never one that exists only locally.
  await queueNotebookSnapshot(notebookFlag, async () => {
    await api.notes.deleteNote({ flag: notebookFlag, noteId });
    await db.deleteNotesNote({ notebookFlag, noteId });
  });
  // takes its own slot — `queueNotebookSnapshot` is not re-entrant, so the
  // confirmation poll must not run inside the unit above
  const confirmed = await syncNotesNotebookUntil(
    notebookFlag,
    (snapshot) => !findSnapshotNote(snapshot, noteId)
  );
  if (confirmed) {
    trackEvent(AnalyticsEvent.NoteDeleted);
  }
}

export async function deleteNotebookFolder({
  notebookFlag,
  folder,
}: {
  notebookFlag: string;
  folder: db.NotesFolder;
}) {
  // Queued like deleteNotebookNote. The descendant lookup joins the unit so
  // the ids can't come from a copy a concurrent refresh is about to replace.
  const folderIds = await queueNotebookSnapshot(notebookFlag, async () => {
    const folders = await db.getNotesFolders({ notebookFlag });
    const ids = Array.from(
      collectDescendantFolderIds(folders, folder.folderId)
    );

    await api.notes.deleteFolder({
      flag: notebookFlag,
      folderId: folder.folderId,
      recursive: true,
    });
    await db.deleteNotesFolders({ notebookFlag, folderIds: ids });
    return ids;
  });
  const confirmed = await syncNotesNotebookUntil(notebookFlag, (snapshot) =>
    folderIds.every(
      (folderId) =>
        !snapshot.folders.some((nextFolder) => nextFolder.folderId === folderId)
    )
  );
  if (confirmed) {
    trackEvent(AnalyticsEvent.NotesFolderDeleted);
  }
}

export async function markNotesNotebookOpened(notebookFlag: string) {
  return db.setNotesNotebookLastOpened({
    notebookFlag,
    openedAt: Date.now(),
  });
}

// Marks a single note read in %activity. Per-note unreads ride the
// thread-unread table keyed by (notes/<flag>, <note id>); mirror
// markThreadRead's optimistic flow: clear locally, decrement the channel and
// group rollup counts, poke, roll back on failure.
export async function markNoteRead({
  notebookFlag,
  noteId,
}: {
  notebookFlag: string;
  noteId: number;
}) {
  // before the capability resolves (or on a backend without notes
  // activity) the read poke can't be sent — skip the optimistic clear
  // too, or local state diverges from the ship with nothing to retry.
  // the note detail effect re-runs when the capability epoch changes.
  if (!api.getActivitySupportsNotes()) {
    return;
  }
  const channelId = `notes/${notebookFlag}`;
  const threadId = String(noteId);
  const channel = await db.getChannel({ id: channelId });
  const existingUnread = await db.getThreadActivity({
    channelId,
    postId: threadId,
  });

  // optimistic local clear only applies when we have a local row, but the
  // backend read must happen regardless — the note may be viewed before
  // the thread-unread sync has landed the row, and the effect won't rerun
  // when it arrives. the backend no-ops on sources with no unread state.
  const existingCount = existingUnread?.count ?? 0;
  const priorChannelUnread =
    existingCount > 0 ? await db.getChannelUnread({ channelId }) : null;
  const priorGroupUnread =
    existingCount > 0 && channel?.groupId
      ? await db.getGroupUnread({ groupId: channel.groupId })
      : null;

  if (existingUnread) {
    await db.clearThreadUnread({ channelId, threadId });
    if (existingCount > 0) {
      await db.updateChannelUnreadCount({
        channelId,
        decrement: existingCount,
      });
      if (channel?.groupId) {
        await db.updateGroupUnreadCount({
          groupId: channel.groupId,
          decrement: existingCount,
        });
      }
    }
  }

  try {
    await api.readNote({
      channelId,
      noteId: threadId,
      groupId: channel?.groupId,
    });
  } catch (e) {
    logger.error('failed to mark note read', channelId, noteId, e);
    // roll back the whole optimistic update, rollup decrements included
    if (existingUnread) {
      await db.insertThreadUnreads([existingUnread]);
      if (priorChannelUnread) {
        await db.insertChannelUnreads([priorChannelUnread]);
      }
      if (priorGroupUnread) {
        await db.insertGroupUnreads([priorGroupUnread]);
      }
    }
  }
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
): Promise<T | null> {
  let readyValue: T | null = null;
  try {
    await withRetry(async () => {
      // fetch, check and save as one queued unit: a refresh that started
      // before this poll must not save its older copy after the snapshot
      // that confirms the mutation
      const value = await queueNotebookSnapshot(notebookFlag, async () => {
        const { snapshot } = await fetchNotesNotebookSnapshot(
          notebookFlag,
          options
        );
        const ready = await getReadyValue(snapshot);
        if (!ready) {
          return null;
        }
        await db.saveNotesNotebookSnapshot(snapshot);
        return ready;
      });
      if (!value) {
        throw notYetSynced;
      }
      readyValue = value;
    }, notesRetryOptions);
  } catch (e) {
    if (e !== notYetSynced) {
      throw e;
    }
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
        : (currentMember?.role ??
          (notebook.host === currentUserId ? ('owner' as const) : null)),
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
    slug: note.slug === undefined ? (existingNote?.slug ?? null) : note.slug,
    bodyMd: note.bodyMd ?? existingNote?.bodyMd ?? '',
    createdBy: note.createdBy ?? existingNote?.createdBy ?? null,
    createdAt: note.createdAt ?? existingNote?.createdAt ?? null,
    updatedBy: note.updatedBy ?? existingNote?.updatedBy ?? null,
    updatedAt: note.updatedAt ?? existingNote?.updatedAt ?? null,
    revision: note.revision ?? existingNote?.revision ?? 0,
    syncedAt,
  };
}
