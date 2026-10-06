import {
  BUCKETS_AUTH_FAILURE_STATUSES,
  BucketsEntry,
  BucketsFileEntry,
  BucketsFlag,
  BucketsResponse,
  BucketsSnapshot,
  bucketsFlagKey,
  formatBucketsChannelId,
  getBucketReadToken,
  getCurrentUserId,
  requestBucketReadToken,
  BucketsActionFailed,
  mintRequestId,
  requestBucketsGrant,
  requestBucketsUpload,
  sendBucketsAction,
  BucketsBrokerError,
  deleteBucketObject,
  grantBucketRead,
  isBucketObjectAlreadyDeleted,
} from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { useBucket, useBucketUploads } from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BucketItem, BucketUploadCandidate } from '../../ui';
import { calculateBucketUploadProgress } from '../../utils/bucketUploadProgress';
import { deletePrivateBucketFiles } from './bucketDeletion';
import {
  clearUploadCancelled,
  clearUploadRunning,
  forgetUpload,
  isUploadCancelled,
  markUploadCancelled,
  markUploadRunning,
  rememberUploadSource,
  trackUploadTask,
  uploadSource,
  uploadTask,
} from './bucketUploadSources';
import { cancelAbandonedUploadsOnce } from './abandonedUploads';
import {
  FINISH_UNCONFIRMED,
  finishUpload,
  isFinishRefusal,
} from './bucketUploadFinish';
import {
  dequeueUpload,
  enqueueUpload,
  noteUploadOpened,
  requeueRefusedUpload,
} from './bucketUploadQueue';
import { createBucketUploadTask } from './bucketUploadTask';

/**
 * An upload as stored.
 *
 * The source is deliberately absent: a File handle belongs to the process
 * that picked it, so it lives in the module registry keyed by the same id.
 */
type StoredUpload = Awaited<ReturnType<typeof db.getBucketUploads>>[number];
type LocalUpload = StoredUpload;

type StoredBucketEntry = NonNullable<
  Awaited<ReturnType<typeof db.getBucket>>
>['entries'][number];

/**
 * A stored row as the entry shape everything downstream already speaks.
 *
 * The file columns are null on a folder, which is what distinguishes the two
 * once they share a table.
 */
function toBucketsEntry(row: StoredBucketEntry): BucketsEntry {
  const base = {
    id: row.entryId,
    parentId: row.parentId,
    name: row.name,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
  if (row.kind === 'folder') {
    return { ...base, kind: 'folder' };
  }
  return {
    ...base,
    kind: 'file',
    file: {
      mime: row.mime ?? 'application/octet-stream',
      size: row.size ?? 0,
      checksum: row.checksum ?? null,
      objectKey: row.objectKey ?? '',
      status: row.status ?? 'pending',
    },
  };
}

function matchesFlag(left: BucketsFlag, right: BucketsFlag) {
  return bucketsFlagKey(left) === bucketsFlagKey(right);
}

function upsertEntry(entries: BucketsEntry[], entry: BucketsEntry) {
  const currentIndex = entries.findIndex(
    (candidate) => candidate.id === entry.id
  );
  if (currentIndex === -1) return [...entries, entry];
  return entries.map((candidate) =>
    candidate.id === entry.id ? entry : candidate
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

/** The most often a running upload writes its progress to the database. */
const PROGRESS_WRITE_INTERVAL_MS = 250;

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function useLiveBucket(requestedFlag: BucketsFlag) {
  const flag = useMemo(
    () => ({ host: requestedFlag.host, name: requestedFlag.name }),
    [requestedFlag.host, requestedFlag.name]
  );
  const channelId = useMemo(() => formatBucketsChannelId(flag), [flag]);
  // Read, not held. The app-wide %buckets subscription reduces every response
  // into the database, so a pane reads what has been reduced -- rather than
  // opening its own subscription and reducing into private state, which meant
  // two subscriptions to one firehose and no shared view between two panes on
  // the same Bucket.
  const { data: bucket, isLoading: loading } = useBucket({ channelId });
  const entries = useMemo<BucketsEntry[]>(
    () => (bucket?.entries ?? []).map(toBucketsEntry),
    [bucket?.entries]
  );
  const entriesRef = useRef<BucketsEntry[]>([]);
  entriesRef.current = entries;
  const [error, setError] = useState<string | null>(null);
  // Uploads are rows too. They outlive the pane, so leaving a Bucket no longer
  // ends a transfer, and a second pane on the same Bucket sees them. What
  // cannot be written down -- the File handle and the live XHR -- stays in a
  // module-level registry beside them.
  const { data: uploadRows } = useBucketUploads({ channelId });
  const uploads = useMemo(() => uploadRows ?? [], [uploadRows]);
  const uploadsRef = useRef<StoredUpload[]>([]);
  uploadsRef.current = uploads;

  const retireUpload = useCallback(
    async (id: string, outcome: 'completed' | 'removed') => {
      forgetUpload(id);
      if (outcome === 'removed') {
        await db.deleteBucketUpload(id);
        return;
      }
      // Kept, not deleted: the aggregate bar sums every row, and dropping one
      // the instant it finished would shrink the total and make the bar jump
      // backwards. Swept once the batch has nothing active left.
      await db.updateBucketUpload({ id, progress: 100, state: 'completed' });
    },
    []
  );

  // Retire any local row the manifest has caught up with.
  //
  // Keyed off the manifest as read, rather than off an entry-created fact,
  // because a fact is only one of the ways an entry becomes visible: a
  // replacement snapshot arrives whole, and reconnecting resubscribes and
  // takes one. Matching the fact alone left the row standing in those cases,
  // and a row holding a published serverEntryId hides the real file and arms
  // Retry to delete it.
  // Once a batch has nothing left to do, its finished rows have served their
  // purpose -- they were kept only so the aggregate bar's denominator did not
  // shrink under it. Without this they accumulate for good, and every past
  // upload goes on counting toward the next batch's progress.
  useEffect(() => {
    const settled = uploads.filter((upload) => upload.state === 'completed');
    if (settled.length === 0) return;
    const active = uploads.some(
      (upload) => upload.state === 'queued' || upload.state === 'uploading'
    );
    if (active) return;
    void Promise.all(settled.map((upload) => db.deleteBucketUpload(upload.id)));
  }, [uploads]);

  // Uploads a previous run left behind cannot be resumed -- their bytes went
  // with the process that had the file -- so the first Bucket opened gives up
  // on them, which releases the host session and its reservation.
  useEffect(() => {
    void cancelAbandonedUploadsOnce();
  }, []);

  // An upload row stands until its entry is in the manifest. The manifest now
  // arrives through the query, so this runs when that changes rather than on
  // each subscription response.
  useEffect(() => {
    const published = new Set(entries.map((entry) => entry.id));
    uploadsRef.current
      .filter(
        (upload) =>
          upload.serverEntryId !== null && published.has(upload.serverEntryId)
      )
      .forEach((upload) => void retireUpload(upload.id, 'completed'));
  }, [entries, retireUpload]);

  const updateLocalUpload = useCallback(
    (id: string, patch: Partial<Omit<LocalUpload, 'id'>>) => {
      void db.updateBucketUpload({ id, ...patch });
    },
    []
  );

  // Retire a row whose entry the manifest already has.
  //
  // A finish that landed usually reaches the manifest before its failed
  // request does: the entry arrives, the effect below retires the row, and
  // only then does the lost answer surface. Marking the row failed at that
  // point would resurrect it over the real file -- a failed row hides the
  // entry it stands for -- and the effect would never run again to clear
  // it, because the manifest has nothing new to say. So every path that
  // settles a row after finish was sent asks the manifest first.
  const retireIfPublished = useCallback(
    async (id: string, serverEntryId: number) => {
      const bucket = await db.getBucket({ channelId });
      if (!bucket?.entries.some((entry) => entry.entryId === serverEntryId)) {
        return false;
      }
      await retireUpload(id, 'completed');
      return true;
    },
    [channelId, retireUpload]
  );

  // Re-ask finish-upload for a row whose bytes are already up.
  //
  // The host replays the answer it gave under the same id, so this cannot
  // publish twice. Once that answer has been swept, the host refuses a repeat
  // because the session is no longer pending -- which is true of a published
  // upload and of a dead one alike, so the manifest decides between them.
  const confirmUpload = useCallback(
    async (
      id: string,
      sessionId: string,
      serverEntryId: number,
      requestId: string
    ) => {
      markUploadRunning(id);
      try {
        await finishUpload(flag, sessionId, requestId);
        if (!(await retireIfPublished(id, serverEntryId))) {
          updateLocalUpload(id, { progress: 100 });
        }
      } catch (cause) {
        if (isUploadCancelled(id)) return;
        if (await retireIfPublished(id, serverEntryId)) return;
        if (!isFinishRefusal(cause)) {
          updateLocalUpload(id, { error: FINISH_UNCONFIRMED, state: 'failed' });
          return;
        }
        // Refused and not published, so the bytes never landed as a file.
        // The next try starts over with a new session. The entry id stays: if
        // the manifest was only behind, its entry still retires this row.
        updateLocalUpload(id, {
          error: errorMessage(cause),
          openRequestId: null,
          progress: 0,
          sessionId: null,
          state: 'failed',
        });
      } finally {
        clearUploadRunning(id);
      }
    },
    [flag, retireIfPublished, updateLocalUpload]
  );

  const runUpload = useCallback(
    async (id: string) => {
      // Read fresh rather than passed in: the row may have been written by a
      // different pane, or by this one before a navigation.
      const upload = (await db.getBucketUploads({ channelId })).find(
        (row) => row.id === id
      );
      if (!upload) return;
      // A row holds at most one request id: begin-upload's before it has a
      // session, finish-upload's after. One held alongside a session is a
      // finish whose answer never arrived -- the host may well have
      // published the file, so ask again rather than upload a second copy.
      if (
        upload.openRequestId !== null &&
        upload.sessionId !== null &&
        upload.serverEntryId !== null
      ) {
        return confirmUpload(
          id,
          upload.sessionId,
          upload.serverEntryId,
          upload.openRequestId
        );
      }
      const candidate = uploadSource(id);
      if (!candidate) return;
      // Declared before the first await: from here until this returns, a
      // cancellation has to survive the row it was made against.
      markUploadRunning(id);
      const parentId = upload.parentId;
      let sessionId: string | undefined;
      let serverEntryId: number | undefined;
      let finishRequestId: string | undefined;
      let brokerCompleted = false;

      try {
        if (candidate.size < 0) {
          throw new Error('The file size could not be determined');
        }
        const mimeType = candidate.mimeType ?? 'application/octet-stream';

        // null, not undefined: an update set drops undefined keys, so
        // clearing a column with one leaves the old value in place. A retry
        // would keep showing the error that failed it.
        updateLocalUpload(id, {
          error: null,
          progress: 1,
          state: 'uploading',
        });
        // One round trip: the host reserves the entry, calls storage as
        // itself, and answers with the signed URL. Nothing has to be matched
        // against the replica afterwards, and nothing is broadcast until the
        // object lands.
        // The request id is minted here rather than inside, and kept, so an
        // ambiguous transport failure is recoverable. The host holds a
        // request open across its own call to storage, so a lost response is
        // a real possibility -- and without the id there is no way to ask
        // what happened: retrying would mint a new one and open a second
        // session, leaving the first holding a reservation and its quota.
        // The host answers a repeated id with the answer it already gave.
        const openRequestId = upload.openRequestId ?? mintRequestId();
        updateLocalUpload(id, { openRequestId });
        const openUpload = () =>
          requestBucketsUpload(
            {
              type: 'begin-upload',
              checksum: null,
              flag,
              mime: mimeType,
              name: candidate.name,
              parentId,
              size: candidate.size,
            },
            openRequestId
          );
        const grant = await openUpload().catch((cause) => {
          // A typed refusal is the host's answer and stands. Anything else
          // never reached it, or its answer never reached us.
          if (cause instanceof BucketsActionFailed) throw cause;
          return openUpload();
        });
        sessionId = grant.session;
        serverEntryId = grant.entryId;
        noteUploadOpened(id);
        // The request id has done its work: the answer it was minted to
        // recover is in hand. Keeping it would arm Retry to re-ask under an
        // id the host has already answered, replaying this grant for a
        // session the catch below is about to cancel -- so the bytes would go
        // to a stale URL and finish-upload would refuse the dead session.
        // Everything after this point is recovered by beginning again.
        updateLocalUpload(id, {
          openRequestId: null,
          progress: 5,
          serverEntryId,
          sessionId,
        });

        if (isUploadCancelled(id)) {
          throw new Error('Upload cancelled');
        }

        // Every progress event used to write the row, and every write
        // refetches each query that reads the table -- with several transfers
        // running, a storm of writes for a number that had barely moved.
        let writtenProgress = 5;
        let writtenAt = 0;
        const task = createBucketUploadTask(
          grant.url,
          candidate,
          Object.fromEntries(grant.headers),
          (progress) => {
            const next = Math.max(5, Math.round(5 + progress * 0.9));
            const now = Date.now();
            if (next === writtenProgress) return;
            if (now - writtenAt < PROGRESS_WRITE_INTERVAL_MS) return;
            writtenProgress = next;
            writtenAt = now;
            updateLocalUpload(id, { progress: next });
          }
        );
        trackUploadTask(id, task);
        await task.upload;

        if (isUploadCancelled(id)) {
          throw new Error('Upload cancelled');
        }
        if (!sessionId) {
          throw new Error('The upload session was lost');
        }
        // The host settles the reservation with storage and publishes the
        // entry in one step, so this is the last thing the uploader does. The
        // id is kept on the row from here: if the answer is lost, the file may
        // already be published, and Retry re-asks under it.
        finishRequestId = mintRequestId();
        updateLocalUpload(id, { openRequestId: finishRequestId, progress: 96 });
        await finishUpload(flag, sessionId, finishRequestId);
        brokerCompleted = true;
        updateLocalUpload(id, { progress: 100 });
        // Nothing further here on purpose. The host broadcasts the published
        // entry, sync writes it, and the effect above retires this row when it
        // reads it -- from the fact, or from the snapshot a reconnect takes.
        //
        // Retiring the row here instead would leave a moment showing neither
        // the row nor the entry, and if the fact never came, the file would
        // simply be missing; leaving the row until the manifest has it makes
        // that case a visible stuck upload rather than a vanished file.
      } catch (cause) {
        const cancelled = isUploadCancelled(id);
        // The host would not open the upload. Nothing was reserved, so it can
        // wait its turn again -- and the whole queue with it, since the
        // refusal is almost always the broker's rate limit, which the next
        // upload would hit too. The request id goes: under it the host would
        // only replay the refusal.
        if (
          !cancelled &&
          sessionId === undefined &&
          cause instanceof BucketsActionFailed &&
          cause.type === 'unknown' &&
          requeueRefusedUpload(id)
        ) {
          updateLocalUpload(id, {
            error: null,
            openRequestId: null,
            progress: 0,
            state: 'queued',
          });
          return;
        }
        // One cancel, not two. The host releases the storage reservation as
        // part of this -- previously that was a second call from here, made
        // while the tab was closing and with its error swallowed, so an
        // abandoned upload held quota until the reservation lapsed.
        //
        // Not once finish-upload has been sent: whether it landed is exactly
        // what the lost answer leaves unknown, and the host expires a session
        // nobody finishes.
        if (sessionId && !brokerCompleted && !finishRequestId) {
          await sendBucketsAction({
            type: 'cancel-upload',
            flag,
            reason: errorMessage(cause),
            sessionId,
          }).catch(() => undefined);
        }
        if (cancelled && serverEntryId !== undefined) {
          await sendBucketsAction({
            type: 'delete-entry',
            flag,
            id: serverEntryId,
            recursive: false,
          }).catch(() => undefined);
        }
        // A refusal of finish-upload is the host saying the file was not
        // published, so the next try starts over. Any other failure after it
        // was sent leaves the outcome unknown, and the row keeps the id for
        // Retry to re-ask under -- unless the manifest already has the entry.
        const unconfirmed =
          finishRequestId !== undefined && !isFinishRefusal(cause);
        // Otherwise only an ambiguous failure is worth re-asking under the
        // same id. A typed refusal is an answer the host has stored, so
        // reusing the id would replay that refusal on every Retry until the
        // record is swept, even once whatever caused it has been put right.
        const requestId = unconfirmed
          ? { openRequestId: finishRequestId }
          : cause instanceof BucketsActionFailed
            ? { openRequestId: null }
            : {};
        const published =
          !cancelled &&
          unconfirmed &&
          serverEntryId !== undefined &&
          (await retireIfPublished(id, serverEntryId));
        if (!cancelled && !published) {
          updateLocalUpload(id, {
            error: unconfirmed ? FINISH_UNCONFIRMED : errorMessage(cause),
            ...requestId,
            progress: unconfirmed ? 96 : 0,
            serverEntryId,
            state: 'failed',
          });
        }
      } finally {
        clearUploadRunning(id);
      }
    },
    [channelId, confirmUpload, flag, retireIfPublished, updateLocalUpload]
  );

  const addUploads = useCallback(
    (candidates: BucketUploadCandidate[], parentId: number | null) => {
      const now = Date.now();
      void Promise.all(
        candidates.map(async (candidate, index) => {
          // Random as well as ordered: two selections made in the same
          // millisecond would otherwise collide.
          const id = `local-upload-${now}-${index}-${mintRequestId()}`;
          // The source is held beside the row rather than in it: a File
          // handle belongs to this process and cannot be written down.
          rememberUploadSource(id, candidate);
          await db.upsertBucketUpload({
            id,
            channelId,
            parentId,
            name: candidate.name,
            size: candidate.size,
            mime: candidate.mimeType ?? null,
            progress: 0,
            state: 'queued',
            startedAt: now,
          });
          enqueueUpload(id, () => runUpload(id));
        })
      );
    },
    [channelId, runUpload]
  );

  const cancelUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((candidate) => candidate.id === id);
      const parsedEntryId = Number(id);
      const serverEntryId =
        upload?.serverEntryId ??
        (Number.isSafeInteger(parsedEntryId) && parsedEntryId >= 0
          ? parsedEntryId
          : undefined);
      // Sessions are host-private, so the local row is the only place the
      // token lives. A cancel with no row has nothing to fail on the host.
      const sessionId = upload?.sessionId;

      dequeueUpload(id);
      if (upload) {
        markUploadCancelled(id);
      }
      await uploadTask(id)
        ?.cancel()
        .catch(() => undefined);

      retireUpload(id, 'removed');
      // No optimistic removal: the host publishes entries-deleted, the
      // reducer applies it, and the query refreshes. That is the same path
      // every other channel type takes, and it cannot disagree with the
      // server the way a local edit can.

      if (sessionId) {
        await sendBucketsAction({
          type: 'cancel-upload',
          flag,
          reason: 'Cancelled',
          sessionId,
        }).catch(() => undefined);
      }
      // Removing a failed upload dismisses the attempt; it is not a request to
      // delete a file. One whose finish answer was lost may have published
      // anyway, and that file stays.
      if (serverEntryId !== undefined && upload?.state !== 'failed') {
        await sendBucketsAction({
          type: 'delete-entry',
          flag,
          id: serverEntryId,
          recursive: false,
        }).catch(() => undefined);
      }
    },
    [flag, retireUpload, uploads]
  );

  // Nothing is deleted here. An entry reaches the manifest only when its
  // upload finishes, so the entry of an upload that never finished has
  // nothing to delete -- and one that did is a real file, published while its
  // answer was lost, which Retry used to delete.
  const retryUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((candidate) => candidate.id === id);
      if (!upload) return;
      clearUploadCancelled(id);
      if (upload.openRequestId !== null && upload.sessionId !== null) {
        // The bytes are up. Re-ask about the finish rather than start over.
        await db.updateBucketUpload({ id, error: null, state: 'uploading' });
      } else {
        await db.updateBucketUpload({
          id,
          error: null,
          progress: 0,
          serverEntryId: null,
          sessionId: null,
          state: 'queued',
        });
      }
      // Through the queue like any other upload, so Retry all on a thousand
      // failures does not restart them in one burst.
      enqueueUpload(id, () => runUpload(id));
    },
    [runUpload, uploads]
  );

  // Completed rows linger for the aggregate bar; the list shows what is
  // still going.
  const localItems = useMemo<BucketItem[]>(
    () =>
      uploads
        .filter((upload) => upload.state !== 'completed')
        .map((upload) => ({
          // Whoever is uploading, which is us. bucket.updatedBy is the last
          // person to change the Bucket, so a collaborator's edit would put
          // their name on our own in-flight rows.
          author: getCurrentUserId(),
          id: upload.id,
          kind: 'file',
          mimeType: upload.mime ?? undefined,
          modifiedLabel:
            upload.state === 'failed'
              ? 'Failed'
              : upload.state === 'queued'
                ? 'Waiting to upload'
                : 'Uploading',
          name: upload.name,
          sizeLabel: formatFileSize(upload.size),
          uploadSize: upload.size,
          uploadError: upload.error ?? undefined,
          uploadProgress: upload.progress,
          uploadState:
            upload.state === 'failed'
              ? 'failed'
              : upload.state === 'queued'
                ? 'queued'
                : 'uploading',
        })),
    [uploads]
  );
  const uploadAggregateProgress = useMemo(
    () =>
      uploads.length > 0
        ? calculateBucketUploadProgress(
            uploads.map((upload) => ({
              progress: upload.progress,
              size: upload.size,
            }))
          )
        : undefined,
    [uploads]
  );

  return {
    addUploads,
    cancelUpload,
    createFolder: (parentId: number | null, name: string) =>
      sendBucketsAction({ type: 'create-folder', flag, name, parentId }),
    // Both verbs existed in the protocol and in the row's action menu, but
    // nothing outside the fixture supplied the callbacks, so neither was
    // reachable from a real Bucket.
    renameEntry: (id: number, name: string) =>
      sendBucketsAction({ type: 'rename-entry', flag, id, name }),
    moveEntry: (id: number, parentId: number | null) =>
      sendBucketsAction({ type: 'move-entry', flag, id, parentId }),
    deleteEntry: async (id: number, recursive: boolean) => {
      const current = entriesRef.current;
      const root = current.find((entry) => entry.id === id);
      const ids = new Set<number>([id]);
      if (root?.kind === 'folder' && recursive) {
        let changed = true;
        while (changed) {
          changed = false;
          current.forEach((entry) => {
            if (entry.parentId !== null && ids.has(entry.parentId)) {
              if (!ids.has(entry.id)) changed = true;
              ids.add(entry.id);
            }
          });
        }
      }
      // Local rows are not in the snapshot, so the traversal above cannot see
      // them. The host drops their sessions with the folder, so left alone
      // each keeps transferring, fails, and settles as a row under a folder
      // that no longer exists -- unreachable from the pane, and stuck in the
      // batch's aggregate progress for as long as the Bucket is open.
      const doomedUploads = uploads.filter(
        (upload) =>
          (upload.parentId !== null && ids.has(upload.parentId)) ||
          (upload.serverEntryId !== null && ids.has(upload.serverEntryId))
      );
      await Promise.all(doomedUploads.map((upload) => cancelUpload(upload.id)));

      const privateFiles = current.filter(
        (entry): entry is BucketsFileEntry =>
          ids.has(entry.id) &&
          entry.kind === 'file' &&
          entry.file.status === 'ready'
      );
      await deletePrivateBucketFiles(privateFiles ?? [], flag, {
        deleteManifestEntry: (deletedId) =>
          sendBucketsAction({
            type: 'delete-entry',
            flag,
            id: deletedId,
            recursive: false,
          }),
        deleteObject: deleteBucketObject,
        isAlreadyDeleted: isBucketObjectAlreadyDeleted,
        isMissingEntry: (cause) =>
          cause instanceof BucketsActionFailed && cause.type === 'not-found',
        issueDelete: async (entryId) => {
          const issued = await requestBucketsGrant({
            type: 'issue-delete',
            flag,
            id: entryId,
          });
          return issued.token;
        },
      });
      if (
        root?.kind === 'file' &&
        privateFiles?.some((entry) => entry.id === id)
      ) {
        return;
      }
      return sendBucketsAction({ type: 'delete-entry', flag, id, recursive });
    },
    error,
    loading,
    localItems,
    readGrant: async (id: number) => {
      const entry = entriesRef.current.find((candidate) => candidate.id === id);
      if (!entry || entry.kind !== 'file' || entry.file.status !== 'ready') {
        throw new Error('This file is not ready to open');
      }
      // One token covers the whole bucket, and our own ship keeps it fresh —
      // so this is a local read, and only a cold start has to ask for one.
      // requestBucketReadToken shares one in-flight mint per bucket across
      // callers, so opening several files at once asks for it once.
      const held =
        (await getBucketReadToken(flag)) ??
        (await requestBucketReadToken(flag));
      // The entry name is the only place the file's name exists by this point:
      // the token is bucket-wide and the broker never stored one.
      //
      // Retried once on a refused token, because the one we just read can stop
      // being the one the broker holds between reading it and using it: the
      // host rotates on its own timer, and the local scry will hand back a
      // token whose replacement has already been pushed. That is a stale read,
      // not a permission problem, and the reader should not see it as one.
      const openWith = (token: string) =>
        grantBucketRead(token, flag.host, entry.file.objectKey, entry.name);
      try {
        return await openWith(held.token);
      } catch (cause) {
        if (
          !(cause instanceof BucketsBrokerError) ||
          !BUCKETS_AUTH_FAILURE_STATUSES.includes(cause.status)
        ) {
          throw cause;
        }
        const minted = await requestBucketReadToken(flag);
        return await openWith(minted.token);
      }
    },
    retryUpload,
    // The manifest as read, plus the revision it is at. No `snapshot`: there
    // is no private copy of one any more.
    entries,
    revision: bucket?.revision ?? 0,
    uploadAggregateProgress,
    uploads,
  };
}

export function formatFileSize(size: number) {
  if (size < 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatBucketTimestamp(timestamp: number) {
  const milliseconds =
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const elapsed = Math.max(0, Date.now() - milliseconds);
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  if (elapsed < 172_800_000) return 'Yesterday';
  return new Date(milliseconds).toLocaleDateString();
}
