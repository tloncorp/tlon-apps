import { describe, expect, it } from 'vitest';

import type { SurfaceState } from '../monitor/surface-actions.js';
import {
  makeA2UIBlob,
  readInteractiveAction,
  readSurfaceState,
  rebuildBlobWithSurface,
  serializeBlobField,
} from './blob.js';

const SURFACE_ID = 'meal-plan-0v4.a1b2c';

const A2UI_ENTRY = makeA2UIBlob(SURFACE_ID, 'root', [
  { id: 'root', component: 'Text', text: 'Thursday' },
]);

const SURFACE_ENTRY = {
  type: 'interactive-surface',
  version: 1,
  surfaceId: SURFACE_ID,
  revision: 3,
  state: { days: { mon: { done: false } } },
  processedActionIds: ['act-1'],
};

const ACTION_ENTRY = {
  type: 'interactive-action',
  version: 1,
  targetPostId: '~zod/170.141.184.507',
  targetChannelId: 'chat/~zod/kitchen',
  surfaceId: SURFACE_ID,
  actionId: 'act-2',
  expectedRevision: 3,
  name: 'toggle',
  params: { path: 'days.mon.done' },
};

function next(overrides: Partial<SurfaceState> = {}): SurfaceState {
  return {
    surfaceId: SURFACE_ID,
    revision: 4,
    state: { days: { mon: { done: true } } },
    processedActionIds: ['act-1', 'act-2'],
    ...overrides,
  };
}

describe('readInteractiveAction', () => {
  it('reads a reply that is exactly one recorded tap', () => {
    const action = readInteractiveAction(JSON.stringify([ACTION_ENTRY]));
    expect(action).toMatchObject({
      surfaceId: SURFACE_ID,
      actionId: 'act-2',
      name: 'toggle',
    });
  });

  // A reply carrying user content alongside the action is a real message from a
  // real person, and treating it as machinery would hide it.
  it('is null when the blob carries anything else too', () => {
    expect(
      readInteractiveAction(JSON.stringify([ACTION_ENTRY, SURFACE_ENTRY]))
    ).toBeNull();
  });

  it('is null for an absent, empty, or unparseable blob', () => {
    for (const blob of [null, undefined, '', 'not json', '[]']) {
      expect(readInteractiveAction(blob)).toBeNull();
    }
  });

  it('is null for a blob that is not an action', () => {
    expect(readInteractiveAction(serializeBlobField(A2UI_ENTRY))).toBeNull();
  });
});

describe('readSurfaceState', () => {
  it('reads the surface for a given id', () => {
    const blob = JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY]);
    expect(readSurfaceState(blob, SURFACE_ID)).toEqual({
      surfaceId: SURFACE_ID,
      revision: 3,
      state: { days: { mon: { done: false } } },
      processedActionIds: ['act-1'],
    });
  });

  // A card that has never been acted on carries no surface entry. Null means
  // "revision 0, empty state", not "broken".
  it('is null when the card carries no surface', () => {
    expect(
      readSurfaceState(serializeBlobField(A2UI_ENTRY), SURFACE_ID)
    ).toBeNull();
    expect(readSurfaceState(null, SURFACE_ID)).toBeNull();
  });

  it('is null for a different surface id', () => {
    const blob = JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY]);
    expect(readSurfaceState(blob, 'other')).toBeNull();
  });
});

describe('rebuildBlobWithSurface', () => {
  // The sharpest edge in the protocol: %edit stores the essay wholesale, so an
  // edit that dropped the a2ui entry would delete the card from every member's
  // copy. This is the regression test for that.
  it('keeps the a2ui entry', () => {
    const blob = JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY]);
    const rebuilt = JSON.parse(rebuildBlobWithSurface(blob, next()));

    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0]).toEqual(A2UI_ENTRY);
    expect(rebuilt[1]).toMatchObject({
      type: 'interactive-surface',
      revision: 4,
      state: { days: { mon: { done: true } } },
      processedActionIds: ['act-1', 'act-2'],
    });
  });

  it('replaces the surface in place rather than appending a second one', () => {
    const blob = JSON.stringify([SURFACE_ENTRY, A2UI_ENTRY]);
    const rebuilt = JSON.parse(rebuildBlobWithSurface(blob, next()));

    expect(
      rebuilt.filter(
        (entry: { type: string }) => entry.type === 'interactive-surface'
      )
    ).toHaveLength(1);
    // Order is preserved, so the surface stays where it was.
    expect(rebuilt[0].type).toBe('interactive-surface');
    expect(rebuilt[1]).toEqual(A2UI_ENTRY);
  });

  it('appends the surface when the card had none', () => {
    const rebuilt = JSON.parse(
      rebuildBlobWithSurface(serializeBlobField(A2UI_ENTRY), next())
    );
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0]).toEqual(A2UI_ENTRY);
    expect(rebuilt[1].type).toBe('interactive-surface');
  });

  it('leaves another surface on the same post alone', () => {
    const other = { ...SURFACE_ENTRY, surfaceId: 'other-card', revision: 9 };
    const blob = JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY, other]);
    const rebuilt = JSON.parse(rebuildBlobWithSurface(blob, next()));

    expect(rebuilt).toHaveLength(3);
    expect(rebuilt[2]).toEqual(other);
  });

  // The parser collapses anything it cannot validate to `{type:'unknown'}`,
  // which loses the bytes. Rebuilding from parsed entries would therefore erase
  // an entry written by a newer client — the same destructive mistake this
  // function exists to prevent. So it walks the raw array instead.
  it('preserves an entry this build cannot parse', () => {
    const fromTheFuture = {
      type: 'something-new',
      version: 7,
      payload: 'keep',
    };
    const blob = JSON.stringify([A2UI_ENTRY, fromTheFuture, SURFACE_ENTRY]);
    const rebuilt = JSON.parse(rebuildBlobWithSurface(blob, next()));

    expect(rebuilt).toHaveLength(3);
    expect(rebuilt[1]).toEqual(fromTheFuture);
  });

  it('preserves unrelated entries like file attachments', () => {
    const file = {
      type: 'file',
      version: 1,
      fileUri: 'https://x/y.pdf',
      size: 12,
    };
    const blob = JSON.stringify([file, A2UI_ENTRY, SURFACE_ENTRY]);
    const rebuilt = JSON.parse(rebuildBlobWithSurface(blob, next()));

    expect(rebuilt[0]).toEqual(file);
    expect(rebuilt).toHaveLength(3);
  });

  // An unrelated unreadable blob should not stop a card updating; the surface
  // entry is written from the decision, not read from the blob.
  it('writes the surface even when the existing blob is unreadable', () => {
    const rebuilt = JSON.parse(rebuildBlobWithSurface('not json', next()));
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].type).toBe('interactive-surface');
  });

  it('caps the processed action ids it writes', () => {
    const many = Array.from({ length: 80 }, (_, i) => `act-${i}`);
    const rebuilt = JSON.parse(
      rebuildBlobWithSurface(
        JSON.stringify([A2UI_ENTRY]),
        next({ processedActionIds: many })
      )
    );
    expect(rebuilt[1].processedActionIds).toHaveLength(50);
    expect(rebuilt[1].processedActionIds.at(-1)).toBe('act-79');
  });

  it('round-trips through readSurfaceState', () => {
    const rebuilt = rebuildBlobWithSurface(
      JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY]),
      next()
    );
    expect(readSurfaceState(rebuilt, SURFACE_ID)).toEqual(next());
  });
});
