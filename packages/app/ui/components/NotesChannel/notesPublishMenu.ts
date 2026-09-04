type SavedNoteContent = {
  noteId: number;
  title: string;
  bodyMd: string;
};

type PublishContent = {
  title: string;
  body: string;
};

export type PublishedNoteBaseline = {
  publishedContentKey: string;
  pendingSavedContentKey?: string;
};

export function notePublishContentKey(content: PublishContent) {
  return JSON.stringify([content.title, content.body]);
}

export function publishedNoteBaseline(
  publishedContent: PublishContent,
  savedContent?: PublishContent
): PublishedNoteBaseline {
  const publishedContentKey = notePublishContentKey(publishedContent);
  const savedContentKey = savedContent
    ? notePublishContentKey(savedContent)
    : publishedContentKey;

  return {
    publishedContentKey,
    ...(savedContentKey !== publishedContentKey
      ? { pendingSavedContentKey: savedContentKey }
      : {}),
  };
}

export function reconcilePublishedNoteUpdates({
  baselines,
  notes,
  publishedNoteIds,
}: {
  baselines: Map<number, PublishedNoteBaseline>;
  notes: readonly SavedNoteContent[];
  publishedNoteIds: ReadonlySet<number>;
}) {
  const noteIdsNeedingUpdate = new Set<number>();

  for (const noteId of baselines.keys()) {
    if (!publishedNoteIds.has(noteId)) {
      baselines.delete(noteId);
    }
  }

  for (const note of notes) {
    if (!publishedNoteIds.has(note.noteId)) continue;

    const contentKey = notePublishContentKey({
      title: note.title,
      body: note.bodyMd,
    });
    const baseline = baselines.get(note.noteId);
    if (baseline === undefined) {
      baselines.set(note.noteId, { publishedContentKey: contentKey });
    } else if (baseline.publishedContentKey === contentKey) {
      if (baseline.pendingSavedContentKey !== undefined) {
        baselines.set(note.noteId, { publishedContentKey: contentKey });
      }
    } else if (baseline.pendingSavedContentKey !== contentKey) {
      if (baseline.pendingSavedContentKey !== undefined) {
        baselines.set(note.noteId, {
          publishedContentKey: baseline.publishedContentKey,
        });
      }
      noteIdsNeedingUpdate.add(note.noteId);
    }
  }

  return noteIdsNeedingUpdate;
}
