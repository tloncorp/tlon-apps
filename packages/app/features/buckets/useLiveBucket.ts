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
  canFallBackFromBucketsBroker,
  cancelBucketUpload,
  completeBucketUpload,
  createBucketCapability,
  deleteBucketObject,
  getMemexUpload,
  grantBucketRead,
  grantBucketUpload,
  retryBucketUpload,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BucketItem, BucketUploadCandidate } from '../../ui';
import { createBucketUploadTask } from './bucketUploadTask';
import type { BucketUploadTask } from './bucketUploadTask.types';

type LocalUpload = {
  brokerBytesUploaded?: boolean;
  brokerReservationId?: string;
  candidate: BucketUploadCandidate;
  capability?: string;
  error?: string;
  id: string;
  parentId: number | null;
  progress: number;
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
  let writers = current.state.writers ?? current.state.readers;

  switch (update.type) {
    case 'bucket-created':
    case 'bucket-updated':
      bucket = update.bucket;
      break;
    case 'writers-updated':
      writers = update.writers;
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
  const snapshotRef = useRef<BucketsSnapshot | null>(null);
  const tasksRef = useRef(new Map<string, BucketUploadTask>());
  const cancelledRef = useRef(new Set<string>());

  const commitSnapshot = useCallback((next: BucketsSnapshot | null) => {
    snapshotRef.current = next;
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
  }, []);

  const selectSnapshot = useCallback(
    (snapshots: BucketsSnapshot[]) =>
      snapshots.find((candidate) => matchesFlag(candidate.flag, flag)) ?? null,
    [flag]
  );

  const refresh = useCallback(async () => {
    const next = selectSnapshot(await getBuckets());
    commitSnapshot(next);
    return next;
  }, [commitSnapshot, selectSnapshot]);

  useEffect(() => {
    let active = true;
    let stopSubscription: (() => Promise<void>) | undefined;
    const uploadTasks = tasksRef.current;

    const start = async () => {
      try {
        stopSubscription = await subscribeToBuckets((response) => {
          if (!active || !matchesFlag(response.flag, flag)) return;
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
      uploadTasks.forEach((task) => void task.cancel());
      uploadTasks.clear();
    };
  }, [commitSnapshot, flag, flagKey, refresh]);

  const updateLocalUpload = useCallback(
    (id: string, patch: Partial<LocalUpload>) => {
      setUploads((current) =>
        current.map((upload) =>
          upload.id === id ? { ...upload, ...patch } : upload
        )
      );
    },
    []
  );

  const waitForSession = useCallback(
    async (
      candidate: BucketUploadCandidate,
      parentId: number | null,
      priorSessionIds: Set<string>
    ) => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const next = selectSnapshot(await getBuckets());
        if (next) commitSnapshot(next);
        const entry = next?.state.entries.find(
          (candidateEntry): candidateEntry is BucketsFileEntry =>
            candidateEntry.kind === 'file' &&
            candidateEntry.name === candidate.name &&
            candidateEntry.parentId === parentId &&
            next.state.sessions.some(
              (session) =>
                session.fileId === candidateEntry.id &&
                !priorSessionIds.has(session.id)
            )
        );
        const session = next?.state.sessions.find(
          (candidateSession) =>
            candidateSession.fileId === entry?.id &&
            !priorSessionIds.has(candidateSession.id)
        );
        if (entry && session) return { entry, session };
        await delay(250);
      }
      throw new Error('The ship did not start the upload in time');
    },
    [commitSnapshot, selectSnapshot]
  );

  const runUpload = useCallback(
    async (upload: LocalUpload) => {
      const { candidate, id, parentId } = upload;
      let sessionId = upload.sessionId;
      let serverEntryId = upload.serverEntryId;
      let brokerReservationId = upload.brokerReservationId;
      let brokerBytesUploaded = upload.brokerBytesUploaded ?? false;
      let brokerCompleted = false;

      try {
        if (candidate.size < 0) {
          throw new Error('The file size could not be determined');
        }
        const mimeType = candidate.mimeType ?? 'application/octet-stream';
        let privateGrant:
          | Awaited<ReturnType<typeof grantBucketUpload>>
          | undefined;
        let legacyGrant: Awaited<ReturnType<typeof getMemexUpload>> | undefined;

        if (brokerReservationId && sessionId && serverEntryId) {
          updateLocalUpload(id, {
            error: undefined,
            progress: brokerBytesUploaded ? 96 : 5,
            state: 'uploading',
          });
          if (!brokerBytesUploaded) {
            privateGrant = await retryBucketUpload(brokerReservationId);
          }
        } else {
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
          const begun = await waitForSession(
            candidate,
            parentId,
            priorSessionIds
          );
          sessionId = begun.session.id;
          serverEntryId = begun.entry.id;
          updateLocalUpload(id, { progress: 3, serverEntryId, sessionId });

          if (cancelledRef.current.has(id)) {
            throw new Error('Upload cancelled');
          }

          try {
            privateGrant = await waitForBrokerCapability(() =>
              grantBucketUpload(capability, flag.host)
            );
          } catch (cause) {
            if (!canFallBackFromBucketsBroker(cause)) throw cause;
          }

          legacyGrant = privateGrant
            ? undefined
            : await getMemexUpload({
                contentLength: candidate.size,
                contentType: mimeType,
                fileName: `${getCurrentUserId().replace(/^~/, '')}/buckets/${flag.name}/${Date.now()}-${candidate.name.replace(/[/\\]/g, '-')}`,
              });
          brokerReservationId = privateGrant?.reservationId;
          updateLocalUpload(id, { brokerReservationId, progress: 5 });
        }

        if (!brokerBytesUploaded) {
          const task = createBucketUploadTask(
            privateGrant?.uploadUrl ?? legacyGrant!.uploadUrl,
            candidate,
            privateGrant
              ? brokerRequiredHeaders(privateGrant)
              : {
                  'Cache-Control': 'public, max-age=3600',
                  'Content-Type': mimeType,
                },
            (progress) =>
              updateLocalUpload(id, {
                progress: Math.max(5, Math.round(5 + progress * 0.9)),
              })
          );
          tasksRef.current.set(id, task);
          await task.upload;
          tasksRef.current.delete(id);
          brokerBytesUploaded = Boolean(brokerReservationId);
          updateLocalUpload(id, { brokerBytesUploaded });
        }

        if (cancelledRef.current.has(id)) {
          throw new Error('Upload cancelled');
        }
        if (!sessionId) {
          throw new Error('The upload session was lost');
        }
        updateLocalUpload(id, { progress: 96 });
        if (brokerReservationId) {
          await completeBucketUpload(brokerReservationId);
          brokerCompleted = true;
        } else {
          await sendBucketsAction({
            type: 'finish-upload',
            flag,
            objectUrl: legacyGrant!.hostedUrl,
            sessionId,
          });
        }
        updateLocalUpload(id, { progress: 100 });
        await refresh();
        setUploads((currentUploads) =>
          currentUploads.filter((candidateUpload) => candidateUpload.id !== id)
        );
      } catch (cause) {
        tasksRef.current.delete(id);
        if (sessionId && !brokerReservationId && !brokerCompleted) {
          await sendBucketsAction({
            type: 'fail-upload',
            flag,
            reason: errorMessage(cause),
            sessionId,
          }).catch(() => undefined);
        }
        if (!cancelledRef.current.has(id)) {
          updateLocalUpload(id, {
            error: errorMessage(cause),
            brokerBytesUploaded,
            brokerReservationId,
            progress: 0,
            serverEntryId,
            sessionId,
            state: 'failed',
          });
        }
      }
    },
    [flag, flagKey, refresh, updateLocalUpload, waitForSession]
  );

  const addUploads = useCallback(
    (candidates: BucketUploadCandidate[], parentId: number | null) => {
      const now = Date.now();
      candidates.forEach((candidate, index) => {
        const upload: LocalUpload = {
          candidate,
          id: `local-upload-${now}-${index}`,
          parentId,
          progress: 0,
          state: 'queued',
        };
        setUploads((current) => [...current, upload]);
        void runUpload(upload);
      });
    },
    [runUpload]
  );

  const cancelUpload = useCallback(
    async (id: string) => {
      cancelledRef.current.add(id);
      await tasksRef.current
        .get(id)
        ?.cancel()
        .catch(() => undefined);
      tasksRef.current.delete(id);
      const upload = uploads.find((candidate) => candidate.id === id);
      if (upload?.sessionId) {
        await sendBucketsAction({
          type: 'fail-upload',
          flag,
          reason: 'Cancelled',
          sessionId: upload.sessionId,
        }).catch(() => undefined);
      }
      if (upload?.brokerReservationId) {
        await cancelBucketUpload(upload.brokerReservationId).catch(
          () => undefined
        );
      }
      if (upload?.serverEntryId) {
        await sendBucketsAction({
          type: 'delete-entry',
          flag,
          id: upload.serverEntryId,
          recursive: false,
        }).catch(() => undefined);
      }
      setUploads((current) =>
        current.filter((candidate) => candidate.id !== id)
      );
      void refresh();
    },
    [flag, refresh, uploads]
  );

  const retryUpload = useCallback(
    async (id: string) => {
      const upload = uploads.find((candidate) => candidate.id === id);
      if (!upload) return;
      cancelledRef.current.delete(id);
      const isPrivateRetry = Boolean(
        upload.brokerReservationId && upload.sessionId && upload.serverEntryId
      );
      if (!isPrivateRetry && upload.serverEntryId) {
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
        brokerBytesUploaded: isPrivateRetry
          ? upload.brokerBytesUploaded
          : undefined,
        brokerReservationId: isPrivateRetry
          ? upload.brokerReservationId
          : undefined,
        capability: isPrivateRetry ? upload.capability : undefined,
        progress: 0,
        serverEntryId: isPrivateRetry ? upload.serverEntryId : undefined,
        sessionId: isPrivateRetry ? upload.sessionId : undefined,
        state: 'queued' as const,
      };
      setUploads((current) =>
        current.map((candidate) => (candidate.id === id ? next : candidate))
      );
      void runUpload(next);
    },
    [flag, runUpload, uploads]
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
        uploadError: upload.error,
        uploadProgress: upload.progress,
        uploadState: upload.state,
      })),
    [snapshot?.state.bucket.updatedBy, uploads]
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
      for (const entry of privateFiles ?? []) {
        const capability = createBucketCapability();
        await sendBucketsAction({
          type: 'issue-delete',
          capability,
          flag,
          id: entry.id,
        });
        await waitForBrokerCapability(() =>
          deleteBucketObject(capability, flag.host, entry.file.objectKey)
        );
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
