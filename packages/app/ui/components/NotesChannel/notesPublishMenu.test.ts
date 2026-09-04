import { describe, expect, test } from 'vitest';

import {
  type PublishedNoteBaselines,
  notePublishContentKey,
  reconcilePublishedNoteUpdates,
} from './notesPublishMenu';

function baselinesFor(
  ...entries: [noteId: number, title: string, body: string][]
): PublishedNoteBaselines {
  return new Map(
    entries.map(([noteId, title, body]) => [
      noteId,
      notePublishContentKey({ title, body }),
    ])
  );
}

function updatesFor(
  baselines: PublishedNoteBaselines,
  publishContent: { title: string; body: string },
  publishedNoteIds: ReadonlySet<number> = new Set([1])
) {
  return reconcilePublishedNoteUpdates({
    baselines,
    notes: [{ noteId: 1, publishContent }],
    publishedNoteIds,
  });
}

describe('reconcilePublishedNoteUpdates', () => {
  test('ignores title whitespace normalized by publish and save', () => {
    const baselines = baselinesFor([1, ' Note ', 'Body']);

    expect(updatesFor(baselines, { title: 'Note', body: 'Body' })).toEqual(
      new Set()
    );
  });

  test('keeps the update action available when the published baseline is unknown', () => {
    const baselines: PublishedNoteBaselines = new Map();

    expect(updatesFor(baselines, { title: 'First', body: 'Body' })).toEqual(
      new Set([1])
    );
    expect(baselines).toEqual(new Map());
  });

  test('requires an update only after the publishable content changes', () => {
    const baselines = baselinesFor([1, 'First', 'Body']);

    expect(updatesFor(baselines, { title: 'Changed', body: 'Body' })).toEqual(
      new Set([1])
    );
    expect(updatesFor(baselines, { title: 'First', body: 'Body' })).toEqual(
      new Set()
    );
  });

  test('forgets the baseline after a note is unpublished', () => {
    const baselines = baselinesFor([1, 'First', 'Body']);

    reconcilePublishedNoteUpdates({
      baselines,
      notes: [
        { noteId: 1, publishContent: { title: 'Changed', body: 'Body' } },
      ],
      publishedNoteIds: new Set(),
    });

    expect(baselines).toEqual(new Map());
  });

  test('does not offer an update while the published draft is still retained', () => {
    // Published from a draft whose content had not yet reached the saved row.
    const baselines = baselinesFor([1, 'Published draft', 'Body']);

    // The draft is what a publish would send, so there is nothing to update —
    // regardless of how far behind the saved row still is, and regardless of
    // an intermediate autosave landing a third revision in between.
    expect(
      updatesFor(baselines, { title: 'Published draft', body: 'Body' })
    ).toEqual(new Set());
  });

  test('offers an update again when the published draft is abandoned', () => {
    const baselines = baselinesFor([1, 'Published draft', 'Body']);

    // The draft is gone, so a publish would now send the saved row.
    expect(
      updatesFor(baselines, { title: 'Saved before publish', body: 'Body' })
    ).toEqual(new Set([1]));
  });

  test('tracks each published note independently', () => {
    const baselines = baselinesFor([1, 'One', 'Body'], [2, 'Two', 'Body']);

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [
          { noteId: 1, publishContent: { title: 'One', body: 'Body' } },
          { noteId: 2, publishContent: { title: 'Two changed', body: 'Body' } },
        ],
        publishedNoteIds: new Set([1, 2]),
      })
    ).toEqual(new Set([2]));
  });

  test('ignores notes that are not published', () => {
    const baselines = baselinesFor([1, 'First', 'Body']);

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [
          { noteId: 1, publishContent: { title: 'Changed', body: 'Body' } },
        ],
        publishedNoteIds: new Set([2]),
      })
    ).toEqual(new Set());
  });
});
