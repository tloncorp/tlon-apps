import type { BucketsResponse, BucketsSnapshot } from '@tloncorp/api';

export function bucketResponseHasRevisionGap(
  snapshot: BucketsSnapshot | null,
  response: BucketsResponse
) {
  return (
    response.type === 'update' &&
    snapshot !== null &&
    response.revision > snapshot.state.revision + 1
  );
}

type ReconcileableUpload = {
  allowMetadataFallback?: boolean;
  brokerObjectId?: string;
  candidate: {
    mimeType?: string;
    name: string;
    size: number;
  };
  parentId: number | null;
  priorSessionIds?: readonly string[];
  serverEntryId?: number;
  sessionId?: string;
};

export function includePendingUploadForReconciliation<
  T extends { id: string; priorSessionIds?: readonly string[] },
>(uploads: T[], pending: T, priorSessionIds: readonly string[]): T[] {
  const withPriorSessions = { ...pending, priorSessionIds };
  const index = uploads.findIndex((upload) => upload.id === pending.id);
  if (index === -1) return [...uploads, withPriorSessions];
  return uploads.map((upload, candidateIndex) =>
    candidateIndex === index ? { ...upload, priorSessionIds } : upload
  );
}

export function reconcileUploadsWithSnapshot<T extends ReconcileableUpload>(
  uploads: T[],
  snapshot: BucketsSnapshot,
  requestedBy: string,
  alreadyClaimedEntryIds: ReadonlySet<number> = new Set()
): T[] {
  const usedEntryIds = new Set(alreadyClaimedEntryIds);
  uploads
    .map((upload) => upload.serverEntryId)
    .filter((id): id is number => id !== undefined)
    .forEach((id) => usedEntryIds.add(id));
  let changed = false;

  const reconciled = uploads.map((upload) => {
    if (
      upload.serverEntryId !== undefined ||
      !upload.priorSessionIds ||
      (!upload.brokerObjectId && !upload.allowMetadataFallback)
    ) {
      return upload;
    }

    const priorSessionIds = new Set(upload.priorSessionIds);
    const entries = snapshot.state.entries.filter(
      (candidate) =>
        candidate.kind === 'file' &&
        !usedEntryIds.has(candidate.id) &&
        (!upload.brokerObjectId ||
          candidate.file.objectKey === upload.brokerObjectId) &&
        candidate.parentId === upload.parentId &&
        candidate.name === upload.candidate.name &&
        candidate.file.mime ===
          (upload.candidate.mimeType ?? 'application/octet-stream') &&
        candidate.file.size === upload.candidate.size &&
        snapshot.state.sessions.some(
          (session) =>
            session.fileId === candidate.id &&
            session.requestedBy === requestedBy &&
            !priorSessionIds.has(session.id)
        )
    );
    // The broker object ID is the Gall object's opaque key and is the only
    // safe discriminator for normal uploads. The metadata-only path is
    // opt-in for cleanup after a failed grant and only succeeds when it
    // identifies exactly one entry.
    const entry =
      entries.length === 1 || upload.brokerObjectId ? entries[0] : undefined;
    if (!entry) return upload;

    const session = snapshot.state.sessions.find(
      (candidate) =>
        candidate.fileId === entry.id &&
        candidate.requestedBy === requestedBy &&
        !priorSessionIds.has(candidate.id)
    );
    if (!session) return upload;

    changed = true;
    usedEntryIds.add(entry.id);
    return {
      ...upload,
      serverEntryId: entry.id,
      sessionId: session.id,
    };
  });

  return changed ? reconciled : uploads;
}
