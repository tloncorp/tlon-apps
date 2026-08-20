import { describe, expect, it, vi } from 'vitest';

import { makeA2UIBlob, readSurfaceState } from '../urbit/blob.js';
import type { InteractiveActionEntry } from '../urbit/blob.js';
import {
  type SurfaceApplyDeps,
  type TargetPost,
  applyInteractiveAction,
} from './surface-apply.js';

const NEST = 'chat/~zod/kitchen';
const BOT = '~ridlur-figbud';
const ACTOR = '~bus';
const POST_ID = '170.141.184.507';
const SURFACE_ID = 'meal-plan-0v4.a1b2c';

const A2UI_ENTRY = makeA2UIBlob(SURFACE_ID, 'root', [
  { id: 'root', component: 'Text', text: 'Thursday' },
]);

function surfaceEntry(
  overrides: {
    revision?: number;
    state?: Record<string, unknown>;
    processedActionIds?: string[];
  } = {}
) {
  return {
    type: 'interactive-surface',
    version: 1,
    surfaceId: SURFACE_ID,
    revision: overrides.revision ?? 3,
    state: overrides.state ?? { days: { mon: { done: false } } },
    processedActionIds: overrides.processedActionIds ?? ['act-1'],
  };
}

function action(
  overrides: Partial<InteractiveActionEntry> = {}
): InteractiveActionEntry {
  return {
    type: 'interactive-action',
    version: 1,
    targetPostId: POST_ID,
    targetChannelId: NEST,
    surfaceId: SURFACE_ID,
    actionId: 'act-2',
    expectedRevision: 3,
    name: 'toggle',
    params: { path: 'days.mon.done' },
    ...overrides,
  } as InteractiveActionEntry;
}

function targetPost(overrides: Partial<TargetPost> = {}): TargetPost {
  return {
    id: POST_ID,
    author: BOT,
    sentAt: 1_700_000_000_000,
    content: [{ inline: ['Here is Thursday.'] }],
    blob: JSON.stringify([A2UI_ENTRY, surfaceEntry()]),
    isBot: true,
    ...overrides,
  };
}

function makeDeps(
  overrides: {
    post?: TargetPost | null;
    editPost?: SurfaceApplyDeps['editPost'];
  } = {}
) {
  const edits: Parameters<SurfaceApplyDeps['editPost']>[0][] = [];
  const deps: SurfaceApplyDeps = {
    fetchTargetPost: vi.fn(async () =>
      overrides.post === undefined ? targetPost() : overrides.post
    ),
    editPost:
      overrides.editPost ??
      (async (params) => {
        edits.push(params);
      }),
    botShip: BOT,
  };
  return { deps, edits };
}

function run(
  overrides: {
    action?: Partial<InteractiveActionEntry>;
    post?: TargetPost | null;
    channelNest?: string;
    editPost?: SurfaceApplyDeps['editPost'];
  } = {}
) {
  const { deps, edits } = makeDeps({
    post: overrides.post,
    editPost: overrides.editPost,
  });
  return {
    edits,
    deps,
    outcome: applyInteractiveAction({
      action: action(overrides.action),
      actorShip: ACTOR,
      channelNest: overrides.channelNest ?? NEST,
      deps,
    }),
  };
}

describe('applyInteractiveAction', () => {
  // AC #1
  it('edits the card with new state and an incremented revision', async () => {
    const { outcome, edits } = run();

    await expect(outcome).resolves.toBe('applied');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      nest: NEST,
      postId: POST_ID,
      // The original text and send time are carried back: %edit replaces the
      // whole essay.
      story: [{ inline: ['Here is Thursday.'] }],
      sentAt: 1_700_000_000_000,
      isBot: true,
    });

    const surface = readSurfaceState(edits[0].blob, SURFACE_ID);
    expect(surface).toMatchObject({ revision: 4 });
    expect(surface?.state).toEqual({ days: { mon: { done: true } } });
    expect(surface?.processedActionIds).toEqual(['act-1', 'act-2']);
  });

  // The sharpest edge in the protocol, asserted on the produced bytes.
  it('keeps the a2ui entry so the card survives the edit', async () => {
    const { outcome, edits } = run();
    await outcome;

    expect(JSON.parse(edits[0].blob)).toContainEqual(A2UI_ENTRY);
  });

  // AC #3. No edit at all is the load-bearing part: the tapping client hears
  // nothing and falls back to its timeout.
  it('emits no edit for an action already applied', async () => {
    const { outcome, edits } = run({ action: { actionId: 'act-1' } });

    await expect(outcome).resolves.toBe('noop');
    expect(edits).toEqual([]);
  });

  // AC #4
  it('emits no edit for a stale expected revision', async () => {
    const { outcome, edits } = run({ action: { expectedRevision: 2 } });

    await expect(outcome).resolves.toBe('rejected');
    expect(edits).toEqual([]);
  });

  it('applies against the current revision when none is expected', async () => {
    const { outcome, edits } = run({ action: { expectedRevision: undefined } });

    await expect(outcome).resolves.toBe('applied');
    expect(readSurfaceState(edits[0].blob, SURFACE_ID)?.revision).toBe(4);
  });

  // AC #2, the part this layer owns: an action pointed at someone else's post
  // is not ours to apply, whatever the actor's permissions.
  it('refuses to edit a post the bot did not write', async () => {
    const { outcome, edits } = run({
      post: targetPost({ author: '~sampel-palnet', isBot: false }),
    });

    await expect(outcome).resolves.toBe('unavailable');
    expect(edits).toEqual([]);
  });

  it('tolerates a bot ship written without its sig', async () => {
    const { deps, edits } = makeDeps({
      post: targetPost({ author: BOT.slice(1) }),
    });
    await expect(
      applyInteractiveAction({
        action: action(),
        actorShip: ACTOR,
        channelNest: NEST,
        deps,
      })
    ).resolves.toBe('applied');
    expect(edits).toHaveLength(1);
  });

  // An action naming a channel other than the one it was posted in: the reply's
  // own channel is the only one whose write permission we know it passed.
  it('ignores an action targeting a different channel', async () => {
    const { outcome, edits } = run({
      action: { targetChannelId: 'chat/~zod/elsewhere' },
    });

    await expect(outcome).resolves.toBe('unavailable');
    expect(edits).toEqual([]);
  });

  it('gives up when the target post cannot be read', async () => {
    const { outcome, edits } = run({ post: null });

    await expect(outcome).resolves.toBe('unavailable');
    expect(edits).toEqual([]);
  });

  // A card that has never been tapped carries no surface entry; the first tap
  // creates it, which is why the client omits expectedRevision then.
  it('creates the surface on a first tap', async () => {
    const { outcome, edits } = run({
      post: targetPost({ blob: JSON.stringify([A2UI_ENTRY]) }),
      action: { expectedRevision: undefined },
    });

    await expect(outcome).resolves.toBe('applied');
    const surface = readSurfaceState(edits[0].blob, SURFACE_ID);
    expect(surface).toMatchObject({ revision: 1 });
    expect(surface?.state).toEqual({ days: { mon: { done: true } } });
  });

  // A no-change still edits, to record the id, but must not move the revision:
  // the client reconciles on the revision advancing *or* the id appearing.
  it('records a no-change without bumping the revision', async () => {
    const { outcome, edits } = run({
      post: targetPost({
        blob: JSON.stringify([
          A2UI_ENTRY,
          surfaceEntry({ state: { portions: 4 } }),
        ]),
      }),
      action: { name: 'set', params: { path: 'portions', value: 4 } },
    });

    await expect(outcome).resolves.toBe('applied');
    const surface = readSurfaceState(edits[0].blob, SURFACE_ID);
    expect(surface?.revision).toBe(3);
    expect(surface?.processedActionIds).toContain('act-2');
  });

  it('rejects an action the state vocabulary does not know', async () => {
    const { outcome, edits } = run({ action: { name: 'frobnicate' } });

    await expect(outcome).resolves.toBe('rejected');
    expect(edits).toEqual([]);
  });

  // AC #5, through the real path: two participants tap against revision 3.
  // Whoever the host ordered first wins; the second is stale and changes
  // nothing, so the card lands in one consistent state.
  it('resolves concurrent taps from two participants', async () => {
    let stored = targetPost();
    const deps: SurfaceApplyDeps = {
      fetchTargetPost: async () => stored,
      editPost: async (params) => {
        stored = { ...stored, blob: params.blob };
      },
      botShip: BOT,
    };

    const first = await applyInteractiveAction({
      action: action({ actionId: 'from-zod', expectedRevision: 3 }),
      actorShip: '~zod',
      channelNest: NEST,
      deps,
    });
    const second = await applyInteractiveAction({
      action: action({ actionId: 'from-bus', expectedRevision: 3 }),
      actorShip: '~bus',
      channelNest: NEST,
      deps,
    });

    expect(first).toBe('applied');
    expect(second).toBe('rejected');

    const surface = readSurfaceState(stored.blob, SURFACE_ID);
    expect(surface?.revision).toBe(4);
    expect(surface?.state).toEqual({ days: { mon: { done: true } } });
    // The loser's id is not recorded, so it can legitimately retry against 4.
    expect(surface?.processedActionIds).not.toContain('from-bus');
  });

  // The same pair retried against the revision they now see: both land, and the
  // toggle ends where two taps should leave it.
  it('lets a rejected actor retry against the new revision', async () => {
    let stored = targetPost();
    const deps: SurfaceApplyDeps = {
      fetchTargetPost: async () => stored,
      editPost: async (params) => {
        stored = { ...stored, blob: params.blob };
      },
      botShip: BOT,
    };

    await applyInteractiveAction({
      action: action({ actionId: 'from-zod', expectedRevision: 3 }),
      actorShip: '~zod',
      channelNest: NEST,
      deps,
    });
    const retry = await applyInteractiveAction({
      action: action({ actionId: 'from-bus', expectedRevision: 4 }),
      actorShip: '~bus',
      channelNest: NEST,
      deps,
    });

    expect(retry).toBe('applied');
    const surface = readSurfaceState(stored.blob, SURFACE_ID);
    expect(surface?.revision).toBe(5);
    expect(surface?.state).toEqual({ days: { mon: { done: false } } });
  });
});
