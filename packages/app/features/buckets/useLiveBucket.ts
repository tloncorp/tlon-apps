import {
  BucketsEntry,
  BucketsFileEntry,
  BucketsFlag,
  BucketsResponse,
  BucketsSnapshot,
  bucketsFlagKey,
  formatBucketsChannelId,
  getBuckets,
  getCurrentUserId,
  sendBucketsAction,
  subscribeToBuckets,
} from '@tloncorp/api';
import {
  BucketsBrokerError,
  brokerRequiredHeaders,
  cancelBucketUpload,
  completeBucketUpload,
  createBucketCapability,
  deleteBucketObject,
  grantBucketRead,
  grantBucketUpload,
  isBucketObjectAlreadyDeleted,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BucketItem, BucketUploadCandidate } from '../../ui';
import {
  calculateBucketUploadProgress,
  completeBucketUploadInBatch,
  removeBucketUploadFromBatch,
} from '../../utils/bucketUploadProgress';
import type { BucketUploadBatchItem } from '../../utils/bucketUploadProgress';
import { deletePrivateBucketFiles } from './bucketDeletion';
import {
  bucketResponseHasRevisionGap,
  includePendingUploadForReconciliation,
  reconcileUploadsWithSnapshot,
  removeEntryFromBucketSnapshot,
} from './bucketUploadReconciliation';
import { createBucketUploadTask } from './bucketUploadTask';
import type { BucketUploadTask } from './bucketUploadTask.types';

type LocalUpload = {
  brokerObjectId?: string;
  brokerReservationId?: string;
  candidate: BucketUploadCandidate;
  capability?: string;
  error?: string;
  id: string;
  parentId: number | null;
  progress: number;
  priorSessionIds?: string[];
  serverEntryId?: number;
  sessionId?: string;
  state: 'queued' | 'uploading' | 'failed';
};

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

function reduceBucketResponse(
  current: BucketsSnapshot | null,
  response: BucketsResponse
): BucketsSnapshot | null {
  if (response.type === 'snapshot') {
    return { flag: response.flag, state: response.state };
  }
  if (!current || response.revision <= current.state.revision) {
    return current;
  }

  const update = response.update;
  if (update.type === 'bucket-deleted') return null;

  let entries = current.state.entries;
  let sessions = current.state.sessions;
  let bucket = current.state.bucket;
  let readers = current.state.readers;
  let writers = current.state.writers ?? current.state.readers;

  switch (update.type) {
    case 'bucket-created':
    case 'bucket-updated':
      bucket = update.bucket;
      break;
    case 'writers-updated':
      writers = update.writers;
      break;
    case 'readers-updated':
      readers = update.readers;
      break;
    case 'folder-created':
    case 'entry-updated':
      entries = upsertEntry(entries, update.entry);
      break;
    case 'upload-begun':
    case 'upload-ready':
    case 'upload-failed':
      entries = upsertEntry(entries, update.entry);
      sessions = [
        ...sessions.filter((session) => session.id !== update.session.id),
        update.session,
      ];
      break;
    case 'entries-deleted':
      entries = entries.filter((entry) => !update.ids.includes(entry.id));
      sessions = sessions.filter(
        (session) => !update.ids.includes(session.fileId)
      );
      break;
  }

  return {
    ...current,
    state: {
      ...current.state,
      bucket,
      entries,
      revision: response.revision,
      readers,
      sessions,
      writers,
    },
  };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForBrokerCapability<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await operation();
    } catch (cause) {
      lastError = cause;
      if (
        !(cause instanceof BucketsBrokerError) ||
        cause.status !== 403 ||
        cause.code !== 'capability_denied'
      ) {
        throw cause;
      }
      await delay(250);
    }
  }
  throw lastError;
}

export function useLiveBucket(requestedFlag: BucketsFlag) {
  const flag = useMemo(
    () => ({ host: requestedFlag.host, name: requestedFlag.name }),
    [requestedFlag.host, requestedFlag.name]
  );
  const flagKey = bucketsFlagKey(flag);
  const [snapshot, setSnapshot] = useState<BucketsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const uploadsRef = useRef<LocalUpload[]>([]);
  const [uploadBatch, setUploadBatch] = useState<BucketUploadBatchItem[]>([]);
  const snapshotRef = useRef<BucketsSnapshot | null>(null);
  const tasksRef = useRef(new Map<string, BucketUploadTask>());
  const cancelledRef = useRef(new Set<string>());
  const claimedEntryIdsRef = useRef(new Set<number>());
  const lastSessionRefreshAtRef = useRef(0);
  const sessionRefreshRef = useRef<Promise<BucketsSnapshot | null> | null>(
    null
  );

  const setCurrentUploads = useCallback(
    (update: (current: LocalUpload[]) => LocalUpload[]) => {
      const next = update(uploadsRef.current);
      uploadsRef.current = next;
      setUploads(next);
      return next;
    },
    []
  );

  const commitSnapshot = useCallback(
    (next: BucketsSnapshot | null) => {
      snapshotRef.current = next;
      if (next) {
        setCurrentUploads((current) =>
          reconcileUploadsWithSnapshot(
            current,
            next,
            getCurrentUserId(),
            claimedEntryIdsRef.current
          )
        );
      }
      setSnapshot(next);
      if (next) {
        const channelId = formatBucketsChannelId(next.flag);
        void db.updateChannel({
          id: channelId,
          readerRoles: next.state.readers.map((roleId) => ({
            channelId,
            roleId,
          })),
          writerRoles: (next.state.writers ?? next.state.readers).map(
            (roleId) => ({
              channelId,
              roleId,
            })
          ),
        });
      }
    },
    [setCurrentUploads]
  );

  const selectSnapshot = useCallback(
    (snapshots: BucketsSnapshot[]) =>
      snapshots.find((candidate) => matchesFlag(candidate.flag, flag)) ?? null,
    [flag]
  );

  const refresh = useCallback(async () => {
    const next = selectSnapshot(await getBuckets());
    const current = snapshotRef.current;
    // Revisions are monotonic only within one Bucket incarnation. Deleting
    // and recreating the same flag allocates a new bucket id at revision 0.
    if (
      next &&
      current &&
      matchesFlag(next.flag, current.flag) &&
      next.state.bucket.id === current.state.bucket.id &&
      next.state.revision <= current.state.revision
    ) {
      return current;
    }
    if (!next && !current) return null;
    commitSnapshot(next);
    return next;
  }, [commitSnapshot, selectSnapshot]);

  const refreshUploadSessions = useCallback(() => {
    if (sessionRefreshRef.current) return sessionRefreshRef.current;
    const now = Date.now();
    if (snapshotRef.current && now - lastSessionRefreshAtRef.current < 2_000) {
      return Promise.resolve(snapshotRef.current);
    }
    lastSessionRefreshAtRef.current = now;
    const request = refresh().finally(() => {
      if (sessionRefreshRef.current === request) {
        sessionRefreshRef.current = null;
      }
    });
    sessionRefreshRef.current = request;
    return request;
  }, [refresh]);

  useEffect(() => {
    let active = true;
    let stopSubscription: (() => Promise<void>) | undefined;
    const start = async () => {
      try {
        stopSubscription = await subscribeToBuckets((response) => {
          if (!active || !matchesFlag(response.flag, flag)) return;
          if (bucketResponseHasRevisionGap(snapshotRef.current, response)) {
            void refresh().catch((cause) => {
              if (active) setError(errorMessage(cause));
            });
            return;
          }
          const next = reduceBucketResponse(snapshotRef.current, response);
          commitSnapshot(next);
          setLoading(false);
        });
        if (!active) {
          await stopSubscription();
          return;
        }
        const next = await refresh();
        if (active) {
          setLoading(false);
          setError(next ? null : `Bucket ${flagKey} was not found`);
        }
      } catch (cause) {
        if (active) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      }
    };

    void start();
    return () => {
      active = false;
      if (stopSubscription) void stopSubscription();
    };
  }, [commitSnapshot, flag, flagKey, refresh]);

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

  const waitForSession = useCallback(
    async (
      pendingUpload: LocalUpload,
      candidate: BucketUploadCandidate,
      localUploadId: string,
      parentId: number | null,
      priorSessionIds: Set<string>,
      brokerObjectId?: string,
      allowMetadataFallback = false
    ) => {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        let next = snapshotRef.current;
        // Subscription facts normally satisfy this immediately. A shared
        // fallback scry every two seconds keeps uploads progressing while
        // the channel screen is unmounted or a fact was missed, without one
        // 250ms network loop per file.
        if (!next || attempt % 8 === 7) {
          next = await refreshUploadSessions();
        }
        if (next) {
          const activeUploads = includePendingUploadForReconciliation(
            uploadsRef.current,
            pendingUpload,
            [...priorSessionIds]
          ).map((upload) =>
            upload.id === localUploadId
              ? { ...upload, allowMetadataFallback, brokerObjectId }
              : upload
          );
          const reconciled = reconcileUploadsWithSnapshot(
            activeUploads,
            next,
            getCurrentUserId(),
            claimedEntryIdsRef.current
          );
          const matched = reconciled.find(
            (upload) => upload.id === localUploadId
          );
          if (
            matched &&
            matched.serverEntryId !== undefined &&
            matched.sessionId
          ) {
            const entry = next.state.entries.find(
              (candidateEntry): candidateEntry is BucketsFileEntry =>
                candidateEntry.kind === 'file' &&
                candidateEntry.id === matched.serverEntryId
            );
            const session = next.state.sessions.find(
              (candidateSession) =>
                candidateSession.id === matched.sessionId &&
                candidateSession.fileId === matched.serverEntryId
            );
            if (entry && session) {
              claimedEntryIdsRef.current.add(entry.id);
              if (!cancelledRef.current.has(localUploadId)) {
                setCurrentUploads(() => reconciled);
              }
              return { entry, session };
            }
          }
        }
        await delay(250);
      }
      throw new Error('The ship did not start the upload in time');
    },
    [refreshUploadSessions, setCurrentUploads]
  );

  const runUpload = useCallback(
    async (upload: LocalUpload) => {
      const { candidate, id, parentId } = upload;
      let sessionId: string | undefined;
      let serverEntryId: number | undefined;
      let brokerObjectId: string | undefined;
      let brokerReservationId: string | undefined;
      let brokerCompleted = false;

      try {
        if (candidate.size < 0) {
          throw new Error('The file size could not be determined');
        }
        const mimeType = candidate.mimeType ?? 'application/octet-stream';
        const current = snapshotRef.current ?? (await refresh());
        if (!current) throw new Error(`Bucket ${flagKey} was not found`);
        const priorSessionIds = new Set(
          current.state.sessions.map((session) => session.id)
        );
        const capability = createBucketCapability();

        updateLocalUpload(id, {
          capability,
          error: undefined,
          progress: 1,
          priorSessionIds: [...priorSessionIds],
          state: 'uploading',
        });
        await sendBucketsAction({
          type: 'begin-upload',
          checksum: null,
          capability,
          flag,
          mime: mimeType,
          name: candidate.name,
          parentId,
          size: candidate.size,
        });
        let privateGrant: Awaited<ReturnType<typeof grantBucketUpload>>;
        try {
          privateGrant = await waitForBrokerCapability(() =>
            grantBucketUpload(capability, flag.host)
          );
        } catch (grantCause) {
          // A failed grant can still leave a pending Gall entry. Metadata is
          // only used here when it identifies one unambiguous entry, so this
          // cleanup cannot fail another identical upload from the same ship.
          const begun = await waitForSession(
            upload,
            candidate,
            id,
            parentId,
            priorSessionIds,
            undefined,
            true
          ).catch(() => undefined);
          sessionId = begun?.session.id;
          serverEntryId = begun?.entry.id;
          throw grantCause;
        }
        brokerObjectId = privateGrant.objectId;
        brokerReservationId = privateGrant.reservationId;
        updateLocalUpload(id, {
          brokerObjectId,
          brokerReservationId,
          progress: 3,
        });
        const begun = await waitForSession(
          { ...upload, brokerObjectId, brokerReservationId },
          candidate,
          id,
          parentId,
          priorSessionIds,
          brokerObjectId
        );
        sessionId = begun.session.id;
        serverEntryId = begun.entry.id;
        updateLocalUpload(id, { progress: 5, serverEntryId, sessionId });

        if (cancelledRef.current.has(id)) {
          throw new Error('Upload cancelled');
        }

        const task = createBucketUploadTask(
          privateGrant.uploadUrl,
          candidate,
          brokerRequiredHeaders(privateGrant),
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
        await completeBucketUpload(brokerReservationId);
        brokerCompleted = true;
        updateLocalUpload(id, { progress: 100 });
        await refresh();
        setUploadBatch((current) => completeBucketUploadInBatch(current, id));
        setCurrentUploads((currentUploads) =>
          currentUploads.filter((candidateUpload) => candidateUpload.id !== id)
        );
      } catch (cause) {
        tasksRef.current.delete(id);
        const cancelled = cancelledRef.current.has(id);
        if (sessionId && !brokerCompleted) {
          await sendBucketsAction({
            type: 'fail-upload',
            flag,
            reason: errorMessage(cause),
            sessionId,
          }).catch(() => undefined);
        }
        if (brokerReservationId && !brokerCompleted) {
          await cancelBucketUpload(brokerReservationId).catch(() => undefined);
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
            brokerReservationId: undefined,
            error: errorMessage(cause),
            progress: 0,
            serverEntryId,
            state: 'failed',
          });
        }
      }
    },
    [
      flag,
      flagKey,
      refresh,
      setCurrentUploads,
      updateLocalUpload,
      waitForSession,
    ]
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
      const sessionId =
        upload?.sessionId ??
        snapshotRef.current?.state.sessions.find(
          (session) =>
            session.fileId === serverEntryId && session.status === 'pending'
        )?.id;

      if (upload) {
        cancelledRef.current.add(id);
      }
      await tasksRef.current
        .get(id)
        ?.cancel()
        .catch(() => undefined);
      tasksRef.current.delete(id);

      setCurrentUploads((current) =>
        current.filter((candidate) => candidate.id !== id)
      );
      setUploadBatch((current) => removeBucketUploadFromBatch(current, id));
      if (serverEntryId !== undefined && snapshotRef.current) {
        commitSnapshot(
          removeEntryFromBucketSnapshot(snapshotRef.current, serverEntryId)
        );
      }

      if (sessionId) {
        await sendBucketsAction({
          type: 'fail-upload',
          flag,
          reason: 'Cancelled',
          sessionId,
        }).catch(() => undefined);
      }
      if (upload?.brokerReservationId) {
        await cancelBucketUpload(upload.brokerReservationId).catch(
          () => undefined
        );
      }
      if (serverEntryId !== undefined) {
        await sendBucketsAction({
          type: 'delete-entry',
          flag,
          id: serverEntryId,
          recursive: false,
        }).catch(() => undefined);
      }
      void refresh();
    },
    [commitSnapshot, flag, refresh, setCurrentUploads, uploads]
  );

  const retryUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((candidate) => candidate.id === id);
      if (!upload) return;
      cancelledRef.current.delete(id);
      if (upload.serverEntryId !== undefined) {
        if (snapshotRef.current) {
          commitSnapshot(
            removeEntryFromBucketSnapshot(
              snapshotRef.current,
              upload.serverEntryId
            )
          );
        }
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
        capability: undefined,
        brokerReservationId: undefined,
        brokerObjectId: undefined,
        progress: 0,
        priorSessionIds: undefined,
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
    [commitSnapshot, flag, runUpload, setCurrentUploads, uploads]
  );

  const localItems = useMemo<BucketItem[]>(
    () =>
      uploads.map((upload) => ({
        author: snapshot?.state.bucket.updatedBy ?? '',
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
    [snapshot?.state.bucket.updatedBy, uploads]
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
    deleteEntry: async (id: number, recursive: boolean) => {
      const current = snapshotRef.current;
      const root = current?.state.entries.find((entry) => entry.id === id);
      const ids = new Set<number>([id]);
      if (root?.kind === 'folder' && recursive && current) {
        let changed = true;
        while (changed) {
          changed = false;
          current.state.entries.forEach((entry) => {
            if (entry.parentId !== null && ids.has(entry.parentId)) {
              if (!ids.has(entry.id)) changed = true;
              ids.add(entry.id);
            }
          });
        }
      }
      const privateFiles = current?.state.entries.filter(
        (entry): entry is BucketsFileEntry =>
          ids.has(entry.id) &&
          entry.kind === 'file' &&
          entry.file.status === 'ready' &&
          !entry.file.objectUrl
      );
      await deletePrivateBucketFiles(privateFiles ?? [], flag, {
        createCapability: createBucketCapability,
        deleteManifestEntry: (deletedId) =>
          sendBucketsAction({
            type: 'delete-entry',
            flag,
            id: deletedId,
            recursive: false,
          }),
        deleteObject: (capability, host, objectId) =>
          waitForBrokerCapability(() =>
            deleteBucketObject(capability, host, objectId)
          ),
        isAlreadyDeleted: isBucketObjectAlreadyDeleted,
        issueDelete: (capability, entryId) =>
          sendBucketsAction({
            type: 'issue-delete',
            capability,
            flag,
            id: entryId,
          }),
        onManifestDelete: (deletedId) => {
          const latest = snapshotRef.current;
          if (!latest) return;
          commitSnapshot({
            ...latest,
            state: {
              ...latest.state,
              entries: latest.state.entries.filter(
                (entry) => entry.id !== deletedId
              ),
              sessions: latest.state.sessions.filter(
                (session) => session.fileId !== deletedId
              ),
            },
          });
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
      const entry = snapshotRef.current?.state.entries.find(
        (candidate) => candidate.id === id
      );
      if (!entry || entry.kind !== 'file' || entry.file.status !== 'ready') {
        throw new Error('This file is not ready to open');
      }
      if (entry.file.objectUrl) return entry.file.objectUrl;
      const capability = createBucketCapability();
      await sendBucketsAction({
        type: 'issue-read',
        capability,
        flag,
        id,
      });
      const grant = await waitForBrokerCapability(() =>
        grantBucketRead(capability, flag.host, entry.file.objectKey)
      );
      return grant.readUrl;
    },
    refresh,
    retryUpload,
    snapshot,
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
