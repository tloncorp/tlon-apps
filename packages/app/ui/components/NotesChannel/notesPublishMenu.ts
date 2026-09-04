type PublishContent = {
  title: string;
  body: string;
};

type ReconcilableNote = {
  noteId: number;
  // What publishing this note right now would send: its retained draft when
  // one exists, otherwise the saved row. Comparing against this — rather than
  // against the saved row plus a guess about in-flight saves — is what keeps
  // the action from offering an update that would republish identical content.
  publishContent: PublishContent;
};

// Keyed by note id, holding the content key of the note's public copy.
export type PublishedNoteBaselines = Map<number, string>;

export function notePublishContentKey(content: PublishContent) {
  // Both the publish renderer and the note-save path trim the title, so a
  // draft's surrounding whitespace never reaches the published output.
  return JSON.stringify([content.title.trim(), content.body]);
}

export function reconcilePublishedNoteUpdates({
  baselines,
  notes,
  publishedNoteIds,
}: {
  baselines: PublishedNoteBaselines;
  notes: readonly ReconcilableNote[];
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

    const publishedContentKey = baselines.get(note.noteId);
    if (publishedContentKey === undefined) {
      // The published API exposes neither content nor a revision, so on a
      // fresh mount we cannot prove the note matches its public copy. Keep
      // the explicit update action available rather than hide a stale one.
      noteIdsNeedingUpdate.add(note.noteId);
    } else if (
      publishedContentKey !== notePublishContentKey(note.publishContent)
    ) {
      noteIdsNeedingUpdate.add(note.noteId);
    }
  }

  return noteIdsNeedingUpdate;
}
