import {
  appendInteractiveActionToPostBlob,
  appendInteractiveSurfaceToPostBlob,
} from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
import { A2UI } from '@tloncorp/shared/logic';
import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  INTERACTIVE_ACTION_TIMEOUT_MS,
  useInteractiveSurface,
} from './useInteractiveSurface';

const mocks = vi.hoisted(() => ({
  sendReply: vi.fn(),
  actionIds: ['action-1', 'action-2', 'action-3'],
  nextId: 0,
}));

vi.mock('@tloncorp/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tloncorp/api')>();
  return {
    ...actual,
    sendReply: mocks.sendReply,
    getCurrentUserId: () => '~zod',
  };
});

vi.mock('@tloncorp/shared/logic', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tloncorp/shared/logic')>();
  return {
    ...actual,
    getRandomId: () => mocks.actionIds[mocks.nextId++] ?? 'overflow',
  };
});

vi.mock('@tloncorp/shared/debug', () => ({
  createDevLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    trackError: vi.fn(),
    trackEvent: vi.fn(),
  }),
}));

type Surface = ReturnType<typeof useInteractiveSurface>;

const SURFACE_ID = 'meal-plan-1';

function makePost(
  overrides: {
    revision?: number;
    processedActionIds?: string[];
    blob?: string | null;
  } = {}
): db.Post {
  const blob =
    overrides.blob !== undefined
      ? overrides.blob
      : appendInteractiveSurfaceToPostBlob(undefined, {
          surfaceId: SURFACE_ID,
          revision: overrides.revision ?? 0,
          state: { portions: 2 },
          processedActionIds: overrides.processedActionIds ?? [],
        });

  return {
    id: 'post-1',
    channelId: 'chat/~zod/house',
    authorId: '~bus',
    blob: blob ?? null,
  } as unknown as db.Post;
}

function surfaceActionButton(
  name = 'setPortions',
  params?: Record<string, unknown>
) {
  return {
    event: {
      name: A2UI.action.surfaceAction,
      context: { surfaceId: SURFACE_ID, name, params },
    },
  } as never;
}

/** Renders the hook and re-renders it with a new post on demand. */
function renderHook(initialPost: db.Post) {
  let current!: Surface;
  const Probe = ({ post }: { post: db.Post }) => {
    current = useInteractiveSurface(post);
    return null;
  };

  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(React.createElement(Probe, { post: initialPost }));
  });

  return {
    get hook() {
      return current;
    },
    update(post: db.Post) {
      act(() => {
        renderer.update(React.createElement(Probe, { post }));
      });
    },
  };
}

describe('useInteractiveSurface', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.sendReply.mockReset();
    mocks.sendReply.mockResolvedValue(undefined);
    mocks.nextId = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC #1 — the card's state is a pure function of the post, so a remount
  // (virtualization) or a relaunch (fresh read) derives the same thing, and a
  // new post derives the new thing.
  it('reads the surface from the post, not from its own state', () => {
    const probe = renderHook(makePost({ revision: 3 }));
    expect(probe.hook.surfaceFor(SURFACE_ID)?.revision).toBe(3);

    probe.update(makePost({ revision: 4 }));
    expect(probe.hook.surfaceFor(SURFACE_ID)?.revision).toBe(4);
  });

  // A stateless card — an a2ui entry with no sibling surface — is the majority
  // of existing content and must not read as broken.
  it('returns no surface for a card that has none', () => {
    const probe = renderHook(makePost({ blob: null }));
    expect(probe.hook.surfaceFor(SURFACE_ID)).toBeNull();
  });

  // AC #2 — the emitted action carries everything the agent needs to place it.
  it('emits an action naming the post, surface, id, and revision', async () => {
    const probe = renderHook(makePost({ revision: 7 }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
        params: { portions: 4 },
      });
    });

    expect(mocks.sendReply).toHaveBeenCalledTimes(1);
    const call = mocks.sendReply.mock.calls[0][0];
    expect(call).toMatchObject({
      channelId: 'chat/~zod/house',
      parentId: 'post-1',
      parentAuthor: '~bus',
      authorId: '~zod',
      content: [],
    });
    expect(JSON.parse(call.blob)).toEqual([
      {
        type: 'interactive-action',
        version: 1,
        targetPostId: 'post-1',
        targetChannelId: 'chat/~zod/house',
        surfaceId: SURFACE_ID,
        actionId: 'action-1',
        expectedRevision: 7,
        name: 'setPortions',
        params: { portions: 4 },
      },
    ]);
  });

  // No surface entry means no revision to reference. Omitting expectedRevision
  // is the protocol's own opt-in to last-write-wins, which keeps such a card
  // usable rather than dead.
  it('omits the expected revision when the card has no surface yet', async () => {
    const probe = renderHook(makePost({ blob: null }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    const entry = JSON.parse(mocks.sendReply.mock.calls[0][0].blob)[0];
    expect(entry.expectedRevision).toBeUndefined();
  });

  // AC #3 — optimistic feedback appears on the tapped control only, and every
  // control on that surface goes unavailable while it is in flight.
  it('marks the tapped control pending and blocks the surface', async () => {
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton('setPortions', { portions: 4 });
    const other = surfaceActionButton('setPortions', { portions: 2 });

    expect(probe.hook.getA2UIActionState(tapped)).toBe('idle');

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
        params: { portions: 4 },
      });
    });

    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');
    expect(probe.hook.getA2UIActionState(other)).toBe('idle');
    expect(
      probe.hook.isSurfaceActionAvailable({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
        params: { portions: 2 },
      })
    ).toBe(false);
  });

  it('leaves a different surface on the same post alone', async () => {
    const probe = renderHook(makePost({ revision: 0 }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    expect(
      probe.hook.isSurfaceActionAvailable({
        surfaceId: 'some-other-surface',
        name: 'x',
      })
    ).toBe(true);
  });

  // AC #3 — reconcile when the agent's edit lands and the revision advances.
  it('clears pending when the revision advances', async () => {
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });
    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');

    probe.update(makePost({ revision: 1 }));
    expect(probe.hook.getA2UIActionState(tapped)).toBe('idle');
  });

  // The path that a revision-only check would hang on forever: an action the
  // agent applied to identical state does not bump the revision, and is only
  // observable through processedActionIds.
  it('clears pending on a no-change, where the revision does not move', async () => {
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });
    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');

    probe.update(makePost({ revision: 0, processedActionIds: ['action-1'] }));
    expect(probe.hook.getA2UIActionState(tapped)).toBe('idle');
  });

  it('does not clear pending on an unrelated revision that stayed put', async () => {
    const probe = renderHook(makePost({ revision: 2 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    probe.update(
      makePost({ revision: 2, processedActionIds: ['someone-else'] })
    );
    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');
  });

  // AC #3, the revert half. Required by the protocol: a de-duplicated action
  // produces no edit at all, so nothing would ever arrive to reconcile against.
  it('reverts to post state when no edit arrives', async () => {
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });
    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');

    await act(async () => {
      vi.advanceTimersByTime(INTERACTIVE_ACTION_TIMEOUT_MS);
    });
    expect(probe.hook.getA2UIActionState(tapped)).toBe('idle');
  });

  it('holds pending right up to the timeout', async () => {
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(INTERACTIVE_ACTION_TIMEOUT_MS - 1);
    });
    expect(probe.hook.getA2UIActionState(tapped)).toBe('pending');
  });

  // AC #4 — a second tap while the first is in flight is suppressed, so two
  // presses become one action and therefore one state change.
  it('suppresses a second tap while one is in flight', async () => {
    const probe = renderHook(makePost({ revision: 0 }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });
    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    expect(mocks.sendReply).toHaveBeenCalledTimes(1);
  });

  it('accepts a fresh tap once the first has reconciled', async () => {
    const probe = renderHook(makePost({ revision: 0 }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });
    probe.update(makePost({ revision: 1 }));

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    expect(mocks.sendReply).toHaveBeenCalledTimes(2);
    // A distinct tap is a distinct action, and carries the revision it saw.
    const ids = mocks.sendReply.mock.calls.map(
      (call) => JSON.parse(call[0].blob)[0].actionId
    );
    expect(ids).toEqual(['action-1', 'action-2']);
    expect(JSON.parse(mocks.sendReply.mock.calls[1][0].blob)[0]).toMatchObject({
      expectedRevision: 1,
    });
  });

  // A failed send has nothing to roll back — the card renders from the post,
  // which never changed — so it just puts the button back.
  it('clears pending when the send fails', async () => {
    mocks.sendReply.mockRejectedValue(new Error('offline'));
    const probe = renderHook(makePost({ revision: 0 }));
    const tapped = surfaceActionButton();

    await act(async () => {
      await probe.hook.emitSurfaceAction({
        surfaceId: SURFACE_ID,
        name: 'setPortions',
      });
    });

    expect(probe.hook.getA2UIActionState(tapped)).toBe('idle');
  });

  it('reports non-surface actions as idle', () => {
    const probe = renderHook(makePost());
    const send = {
      event: {
        name: A2UI.action.sendMessage,
        context: { text: 'hi' },
      },
    } as never;
    expect(probe.hook.getA2UIActionState(send)).toBe('idle');
  });
});

describe('action replies', () => {
  it('are recognizable as machinery rather than messages', () => {
    const blob = appendInteractiveActionToPostBlob(undefined, {
      targetPostId: 'post-1',
      targetChannelId: 'chat/~zod/house',
      surfaceId: SURFACE_ID,
      actionId: 'action-1',
      name: 'setPortions',
    });
    expect(JSON.parse(blob)).toHaveLength(1);
    expect(JSON.parse(blob)[0].type).toBe('interactive-action');
  });
});
