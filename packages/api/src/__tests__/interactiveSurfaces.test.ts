import { describe, expect, test } from 'vitest';

import { A2UI, validateBlobEntry } from '../client/a2ui';
import {
  INTERACTIVE_SURFACE_LIMITS,
  appendInteractiveActionToPostBlob,
  appendInteractiveSurfaceToPostBlob,
  parsePostBlob,
} from '../client/content-helpers';
import { convertContent } from '../client/postContent';

const UPGRADE_NOTICE = {
  type: 'blockquote',
  content: [{ type: 'text', text: 'Upgrade your app to see this post' }],
};

const surface = {
  surfaceId: 'meal-plan-0v4.a1b2c',
  revision: 3,
  state: { days: { mon: 'tacos' }, done: ['mon'] },
  stateHash: 'sha256:abc123',
  processedActionIds: ['act-1', 'act-2'],
};

const action = {
  targetPostId: '~zod/170.141.184.507',
  targetChannelId: 'chat/~zod/kitchen',
  surfaceId: 'meal-plan-0v4.a1b2c',
  actionId: 'act-3',
  expectedRevision: 3,
  name: 'toggleDay',
  params: { day: 'tue' },
};

describe('interactive-surface entry', () => {
  test('round-trips through append and parse', () => {
    const blob = appendInteractiveSurfaceToPostBlob(undefined, surface);
    expect(parsePostBlob(blob)).toEqual([
      { type: 'interactive-surface', version: 1, ...surface },
    ]);
  });

  test('defaults processedActionIds and tolerates an absent stateHash', () => {
    const blob = appendInteractiveSurfaceToPostBlob(undefined, {
      surfaceId: 's',
      revision: 0,
      state: {},
    });
    expect(parsePostBlob(blob)?.[0]).toMatchObject({
      revision: 0,
      processedActionIds: [],
    });
  });

  // The list is replicated to every member on every render, so the writer
  // trims to the newest ids rather than letting it grow.
  test('keeps only the most recent action ids, oldest dropped', () => {
    const overCap = Array.from(
      { length: INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds + 5 },
      (_, i) => `act-${i}`
    );
    const blob = appendInteractiveSurfaceToPostBlob(undefined, {
      surfaceId: 's',
      revision: 1,
      state: {},
      processedActionIds: overCap,
    });
    const parsed = parsePostBlob(blob)?.[0] as { processedActionIds: string[] };
    expect(parsed.processedActionIds).toHaveLength(
      INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds
    );
    expect(parsed.processedActionIds.at(-1)).toBe(overCap.at(-1));
    expect(parsed.processedActionIds).not.toContain('act-0');
  });

  test.each([
    ['a missing surfaceId', { ...surface, surfaceId: '' }],
    ['a negative revision', { ...surface, revision: -1 }],
    ['a fractional revision', { ...surface, revision: 1.5 }],
    [
      'an over-cap processedActionIds list',
      {
        ...surface,
        processedActionIds: Array.from(
          { length: INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds + 1 },
          (_, i) => `a-${i}`
        ),
      },
    ],
    [
      'an oversized state',
      {
        ...surface,
        state: { blob: 'x'.repeat(INTERACTIVE_SURFACE_LIMITS.maxStateBytes) },
      },
    ],
  ])('degrades %s to unknown', (_label, bad) => {
    const raw = JSON.stringify([
      { type: 'interactive-surface', version: 1, ...bad },
    ]);
    expect(parsePostBlob(raw)).toEqual([{ type: 'unknown' }]);
    expect(convertContent(null, raw)).toEqual([UPGRADE_NOTICE]);
  });
});

describe('interactive-action entry', () => {
  test('round-trips through append and parse', () => {
    const blob = appendInteractiveActionToPostBlob(undefined, action);
    expect(parsePostBlob(blob)).toEqual([
      { type: 'interactive-action', version: 1, ...action },
    ]);
  });

  // Omitting expectedRevision is the documented opt-in to last-write-wins,
  // mirroring %notes, so it must parse rather than fail.
  test('accepts an omitted expectedRevision', () => {
    const { expectedRevision: _omitted, ...withoutRevision } = action;
    const blob = appendInteractiveActionToPostBlob(undefined, withoutRevision);
    const parsed = parsePostBlob(blob)?.[0] as Record<string, unknown>;
    expect(parsed.type).toBe('interactive-action');
    expect(parsed.expectedRevision).toBeUndefined();
  });

  test.each([
    ['a missing actionId', { ...action, actionId: '' }],
    ['a missing targetPostId', { ...action, targetPostId: '' }],
    ['a negative expectedRevision', { ...action, expectedRevision: -1 }],
    [
      'oversized params',
      {
        ...action,
        params: { x: 'y'.repeat(INTERACTIVE_SURFACE_LIMITS.maxParamsBytes) },
      },
    ],
  ])('degrades %s to unknown', (_label, bad) => {
    const raw = JSON.stringify([
      { type: 'interactive-action', version: 1, ...bad },
    ]);
    expect(parsePostBlob(raw)).toEqual([{ type: 'unknown' }]);
  });
});

describe('rendering', () => {
  // Both entries are data, not display: the card comes from the sibling a2ui
  // entry, and an action is a record of a tap.
  test('neither entry produces a block of its own', () => {
    const blob = appendInteractiveActionToPostBlob(
      appendInteractiveSurfaceToPostBlob(undefined, surface),
      action
    );
    expect(convertContent(null, blob)).toEqual([]);
  });

  // The case AC #5 actually cares about: a post from a future client carries
  // something we know beside something we do not. The known part still shows.
  test('a known entry beside an unknown one renders both the content and the notice', () => {
    const raw = JSON.stringify([
      { type: 'interactive-surface', version: 1, ...surface },
      { type: 'interactive-surface', version: 99, surfaceId: 'later' },
    ]);
    const content = convertContent([{ inline: ['This week'] }], raw);
    expect(content).toContainEqual(UPGRADE_NOTICE);
    expect(content.some((block) => block.type === 'paragraph')).toBe(true);
  });
});

describe('tlon.surfaceAction button action', () => {
  const surfaceButtonEntry = (context: unknown) => ({
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's', catalogId: 'tlon.a2ui.basic.v1' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's',
          root: 'btn',
          components: [
            {
              id: 'btn',
              component: 'Button',
              child: 'label',
              action: { event: { name: A2UI.action.surfaceAction, context } },
            },
            { id: 'label', component: 'Text', text: 'Done' },
          ],
        },
      },
    ],
  });

  test('validates a well-formed surface action', () => {
    expect(
      validateBlobEntry(
        surfaceButtonEntry({ surfaceId: 's', name: 'toggleDay' })
      )
    ).toBe(true);
  });

  test.each([
    ['a missing surfaceId', { name: 'toggleDay' }],
    ['a missing name', { surfaceId: 's' }],
    ['non-object params', { surfaceId: 's', name: 'n', params: 'nope' }],
  ])('rejects %s', (_label, context) => {
    expect(validateBlobEntry(surfaceButtonEntry(context))).toBe(false);
  });

  // An old client's validator knows only sendMessage and navigate, so the
  // whole entry fails and the card degrades to the upgrade notice instead of
  // rendering a stale, tappable surface.
  test('an unknown event name fails the whole entry', () => {
    expect(
      validateBlobEntry(surfaceButtonEntry({ surfaceId: 's', name: 'n' }))
    ).toBe(true);
    // Built as raw wire JSON rather than through appendToPostBlob, which
    // validates on write — this is a blob arriving from a newer client, not
    // one we could ever author.
    const raw = JSON.stringify([
      surfaceButtonEntry({ surfaceId: 's', name: 'n' }),
    ]).replace(A2UI.action.surfaceAction, 'tlon.somethingLater');
    expect(validateBlobEntry(JSON.parse(raw)[0])).toBe(false);
    expect(convertContent(null, raw)).toEqual([UPGRADE_NOTICE]);
  });
});
