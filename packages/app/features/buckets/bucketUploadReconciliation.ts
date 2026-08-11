import type { BucketsSnapshot } from '@tloncorp/api';

type ReconcileableUpload = {
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

export function reconcileUploadsWithSnapshot<T extends ReconcileableUpload>(
  uploads: T[],
  snapshot: BucketsSnapshot,
  requestedBy: string
): T[] {
  const usedEntryIds = new Set(
    uploads
      .map((upload) => upload.serverEntryId)
      .filter((id): id is number => id !== undefined)
  );
  let changed = false;

  const reconciled = uploads.map((upload) => {
    if (upload.serverEntryId !== undefined || !upload.priorSessionIds) {
      return upload;
    }

    const priorSessionIds = new Set(upload.priorSessionIds);
    const entry = snapshot.state.entries.find(
      (candidate) =>
        candidate.kind === 'file' &&
        !usedEntryIds.has(candidate.id) &&
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
