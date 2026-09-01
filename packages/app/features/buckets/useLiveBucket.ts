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
} from '@tloncorp/api';
import {
  BucketsBrokerError,
  deleteBucketObject,
  grantBucketRead,
  isBucketObjectAlreadyDeleted,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useBucket } from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BucketItem, BucketUploadCandidate } from '../../ui';
import {
  calculateBucketUploadProgress,
  completeBucketUploadInBatch,
  removeBucketUploadFromBatch,
} from '../../utils/bucketUploadProgress';
import type { BucketUploadBatchItem } from '../../utils/bucketUploadProgress';
import { deletePrivateBucketFiles } from './bucketDeletion';
import {} from './bucketUploadReconciliation';
import { createBucketUploadTask } from './bucketUploadTask';
import type { BucketUploadTask } from './bucketUploadTask.types';

type LocalUpload = {
  candidate: BucketUploadCandidate;
  error?: string;
  id: string;
  parentId: number | null;
  progress: number;
  serverEntryId?: number;
  sessionId?: string;
  // Kept across a failure so a user's Retry re-asks under the id the host may
  // already have answered, rather than opening a second session beside it.
  openRequestId?: string;
  state: 'queued' | 'uploading' | 'failed';
};

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
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const uploadsRef = useRef<LocalUpload[]>([]);
  const [uploadBatch, setUploadBatch] = useState<BucketUploadBatchItem[]>([]);
  const tasksRef = useRef(new Map<string, BucketUploadTask>());
  const cancelledRef = useRef(new Set<string>());

  const setCurrentUploads = useCallback(
    (update: (current: LocalUpload[]) => LocalUpload[]) => {
      const next = update(uploadsRef.current);
      uploadsRef.current = next;
      setUploads(next);
      return next;
    },
    []
  );

  // An upload lives in two structures: the row the file list renders, and the
  // batch item the aggregate progress bar sums. Retiring it from one without
  // the other is invisible until the bar sticks short of 100% for the rest of
  // the session, so both moves happen here and nowhere else.
  const retireUpload = useCallback(
    (id: string, outcome: 'completed' | 'removed') => {
      setCurrentUploads((current) =>
        current.filter((candidate) => candidate.id !== id)
      );
      setUploadBatch((current) =>
        outcome === 'completed'
          ? completeBucketUploadInBatch(current, id)
          : removeBucketUploadFromBatch(current, id)
      );
    },
    [setCurrentUploads]
  );

  // Retire any local row the manifest has caught up with.
  //
  // Keyed off the snapshot rather than off an entry-created fact, because a
  // fact is only one of the ways an entry becomes visible: a revision gap
  // refreshes instead, and a replacement snapshot arrives whole. Matching the
  // fact alone left the row standing in exactly those cases, and a row holding
  // a published serverEntryId hides the real file and makes Retry delete it.
  // An upload row stands until its entry is in the manifest. The manifest now
  // arrives through the query, so this runs when that changes rather than on
  // each subscription response.
  useEffect(() => {
    const published = new Set(entries.map((entry) => entry.id));
    uploadsRef.current
      .filter(
        (upload) =>
          upload.serverEntryId !== undefined &&
          published.has(upload.serverEntryId)
      )
      .forEach((upload) => retireUpload(upload.id, 'completed'));
  }, [entries, retireUpload]);

  const updateLocalUpload = useCallback(
    (id: string, patch: Partial<LocalUpload>) => {
      setCurrentUploads((current) =>
        current.map((upload) =>
          upload.id === id ? { ...upload, ...patch } : upload
        )
      );
      if (patch.progress !== undefined || patch.state !== undefined) {
        setUploadBatch((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  progress: patch.progress ?? item.progress,
                  state:
                    patch.state === undefined
                      ? item.state
                      : patch.state === 'failed'
                        ? 'failed'
                        : 'active',
                }
              : item
          )
        );
      }
    },
    [setCurrentUploads]
  );

  const runUpload = useCallback(
    async (upload: LocalUpload) => {
      const { candidate, id, parentId } = upload;
      let sessionId: string | undefined;
      let serverEntryId: number | undefined;
      let brokerCompleted = false;

      try {
        if (candidate.size < 0) {
          throw new Error('The file size could not be determined');
        }
        const mimeType = candidate.mimeType ?? 'application/octet-stream';

        updateLocalUpload(id, {
          error: undefined,
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
        updateLocalUpload(id, { progress: 5, serverEntryId, sessionId });

        if (cancelledRef.current.has(id)) {
          throw new Error('Upload cancelled');
        }

        const task = createBucketUploadTask(
          grant.url,
          candidate,
          Object.fromEntries(grant.headers),
          (progress) =>
            updateLocalUpload(id, {
              progress: Math.max(5, Math.round(5 + progress * 0.9)),
            })
        );
        tasksRef.current.set(id, task);
        await task.upload;
        tasksRef.current.delete(id);

        if (cancelledRef.current.has(id)) {
          throw new Error('Upload cancelled');
        }
        if (!sessionId) {
          throw new Error('The upload session was lost');
        }
        updateLocalUpload(id, { progress: 96 });
        // The host settles the reservation with storage and publishes the
        // entry in one step, so this is the last thing the uploader does.
        await sendBucketsAction({ type: 'finish-upload', flag, sessionId });
        brokerCompleted = true;
        updateLocalUpload(id, { progress: 100 });
        // Nothing further here on purpose. The host broadcasts the published
        // entry and reconcileUploads retires this row once it arrives, with
        // the revision-gap path covering a fact we miss.
        //
        // Refreshing was the one thing that could throw after the upload had
        // genuinely succeeded, and the catch then marked the row failed while
        // it still held serverEntryId -- which arms Retry to delete the real
        // manifest entry and orphan its object. Retiring the row here instead
        // would leave a moment showing neither the row nor the entry, and if
        // the fact never came, the file would simply be missing; leaving the
        // row until the manifest has it makes that case a visible stuck
        // upload rather than a vanished file.
      } catch (cause) {
        tasksRef.current.delete(id);
        const cancelled = cancelledRef.current.has(id);
        // Only an ambiguous failure is worth re-asking under the same id. A
        // typed refusal is an answer the host has stored, so reusing the id
        // would replay that refusal on every Retry until the record is swept,
        // even once whatever caused it has been put right.
        if (cause instanceof BucketsActionFailed) {
          updateLocalUpload(id, { openRequestId: undefined });
        }
        // One cancel, not two. The host releases the storage reservation as
        // part of this -- previously that was a second call from here, made
        // while the tab was closing and with its error swallowed, so an
        // abandoned upload held quota until the reservation lapsed.
        if (sessionId && !brokerCompleted) {
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
        if (!cancelled) {
          updateLocalUpload(id, {
            error: errorMessage(cause),
            progress: 0,
            serverEntryId,
            state: 'failed',
          });
        }
      }
    },
    [flag, updateLocalUpload]
  );

  const addUploads = useCallback(
    (candidates: BucketUploadCandidate[], parentId: number | null) => {
      const now = Date.now();
      const nextUploads = candidates.map(
        (candidate, index): LocalUpload => ({
          candidate,
          id: `local-upload-${now}-${index}`,
          parentId,
          progress: 0,
          state: 'queued',
        })
      );
      setCurrentUploads((current) => [...current, ...nextUploads]);
      setUploadBatch((current) => [
        ...current,
        ...nextUploads.map((upload) => ({
          id: upload.id,
          progress: 0,
          size: upload.candidate.size,
          state: 'active' as const,
        })),
      ]);
      nextUploads.forEach((upload) => void runUpload(upload));
    },
    [runUpload, setCurrentUploads]
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

      if (upload) {
        cancelledRef.current.add(id);
      }
      await tasksRef.current
        .get(id)
        ?.cancel()
        .catch(() => undefined);
      tasksRef.current.delete(id);

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
      if (serverEntryId !== undefined) {
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

  const retryUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((candidate) => candidate.id === id);
      if (!upload) return;
      cancelledRef.current.delete(id);
      if (upload.serverEntryId !== undefined) {
        await sendBucketsAction({
          type: 'delete-entry',
          flag,
          id: upload.serverEntryId,
          recursive: false,
        }).catch(() => undefined);
      }
      const next = {
        ...upload,
        error: undefined,
        progress: 0,
        serverEntryId: undefined,
        sessionId: undefined,
        state: 'queued' as const,
      };
      setCurrentUploads((current) =>
        current.map((candidate) => (candidate.id === id ? next : candidate))
      );
      setUploadBatch((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, progress: 0, state: 'active' as const }
            : item
        )
      );
      void runUpload(next);
    },
    [flag, runUpload, setCurrentUploads, uploads]
  );

  const localItems = useMemo<BucketItem[]>(
    () =>
      uploads.map((upload) => ({
        // Whoever is uploading, which is us. bucket.updatedBy is the last
        // person to change the Bucket, so a collaborator's edit would put
        // their name on our own in-flight rows.
        author: getCurrentUserId(),
        id: upload.id,
        kind: 'file',
        mimeType: upload.candidate.mimeType,
        modifiedLabel: upload.state === 'failed' ? 'Failed' : 'Uploading',
        name: upload.candidate.name,
        sizeLabel: formatFileSize(upload.candidate.size),
        uploadSize: upload.candidate.size,
        uploadError: upload.error,
        uploadProgress: upload.progress,
        uploadState: upload.state,
      })),
    [uploads]
  );
  const uploadAggregateProgress = useMemo(
    () =>
      uploadBatch.length > 0
        ? calculateBucketUploadProgress(uploadBatch)
        : undefined,
    [uploadBatch]
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
          (upload.serverEntryId !== undefined && ids.has(upload.serverEntryId))
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
    readUrl: async (id: number) => {
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
        return (await openWith(held.token)).readUrl;
      } catch (cause) {
        if (
          !(cause instanceof BucketsBrokerError) ||
          !BUCKETS_AUTH_FAILURE_STATUSES.includes(cause.status)
        ) {
          throw cause;
        }
        const minted = await requestBucketReadToken(flag);
        return (await openWith(minted.token)).readUrl;
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
