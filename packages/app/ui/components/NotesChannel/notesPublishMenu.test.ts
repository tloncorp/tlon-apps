import { describe, expect, test } from 'vitest';

import {
  publishedNoteBaseline,
  reconcilePublishedNoteUpdates,
} from './notesPublishMenu';

describe('reconcilePublishedNoteUpdates', () => {
  test('keeps the update action available when the published baseline is unknown', () => {
    const baselines = new Map();

    const updates = reconcilePublishedNoteUpdates({
      baselines,
      notes: [{ noteId: 1, title: 'First', bodyMd: 'Body' }],
      noteIdsWithPendingSaves: new Set(),
      publishedNoteIds: new Set([1]),
    });

    expect(updates).toEqual(new Set([1]));
    expect(baselines).toEqual(new Map());
  });

  test('requires an update only after saved content changes', () => {
    const baselines = new Map([
      [1, publishedNoteBaseline({ title: 'First', body: 'Body' })],
    ]);

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'Changed', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set(),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set([1]));

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'First', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set(),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set());
  });

  test('forgets the baseline after a note is unpublished', () => {
    const baselines = new Map([
      [1, publishedNoteBaseline({ title: 'First', body: 'Body' })],
    ]);

    reconcilePublishedNoteUpdates({
      baselines,
      notes: [{ noteId: 1, title: 'Changed', bodyMd: 'Body' }],
      noteIdsWithPendingSaves: new Set(),
      publishedNoteIds: new Set(),
    });

    expect(baselines).toEqual(new Map());
  });

  test('does not offer an update while a published draft is still saving', () => {
    const baselines = new Map([
      [
        1,
        publishedNoteBaseline(
          { title: 'Published draft', body: 'Body' },
          { title: 'Saved before publish', body: 'Body' }
        ),
      ],
    ]);

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'Saved before publish', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set([1]),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set());

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'Published draft', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set(),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set());

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'Later save', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set(),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set([1]));
  });

  test('offers an update again when a pending draft is abandoned', () => {
    const baselines = new Map([
      [
        1,
        publishedNoteBaseline(
          { title: 'Published draft', body: 'Body' },
          { title: 'Saved before publish', body: 'Body' }
        ),
      ],
    ]);

    expect(
      reconcilePublishedNoteUpdates({
        baselines,
        notes: [{ noteId: 1, title: 'Saved before publish', bodyMd: 'Body' }],
        noteIdsWithPendingSaves: new Set(),
        publishedNoteIds: new Set([1]),
      })
    ).toEqual(new Set([1]));
  });
});
