import { INTERACTIVE_SURFACE_LIMITS } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import type { JsonObject } from './state-ops.js';
import {
  type SurfaceAction,
  type SurfaceState,
  decideSurfaceAction,
  emptySurface,
  jsonEqual,
} from './surface-actions.js';

const SURFACE_ID = 'meal-plan-0v4.a1b2c';

function surface(overrides: Partial<SurfaceState> = {}): SurfaceState {
  return {
    surfaceId: SURFACE_ID,
    revision: 3,
    state: { days: { mon: { done: false } } },
    processedActionIds: ['act-1', 'act-2'],
    ...overrides,
  };
}

function action(overrides: Partial<SurfaceAction> = {}): SurfaceAction {
  return {
    surfaceId: SURFACE_ID,
    actionId: 'act-3',
    expectedRevision: 3,
    name: 'toggle',
    params: { path: 'days.mon.done' },
    ...overrides,
  };
}

function decide(
  overrides: {
    surface?: SurfaceState | null;
    action?: Partial<SurfaceAction>;
    actorMayWrite?: boolean;
  } = {}
) {
  return decideSurfaceAction({
    surface: overrides.surface === undefined ? surface() : overrides.surface,
    action: action(overrides.action),
    actorMayWrite: overrides.actorMayWrite ?? true,
  });
}

describe('decideSurfaceAction', () => {
  // AC #1
  it('applies a member action and bumps the revision by exactly one', () => {
    const decision = decide();

    expect(decision).toMatchObject({
      kind: 'apply',
      revision: 4,
      noChange: false,
    });
    expect(decision.kind === 'apply' && decision.state).toEqual({
      days: { mon: { done: true } },
    });
    expect(decision.kind === 'apply' && decision.processedActionIds).toEqual([
      'act-1',
      'act-2',
      'act-3',
    ]);
  });

  // AC #2
  it('rejects an action from an actor who may not write', () => {
    expect(decide({ actorMayWrite: false })).toEqual({
      kind: 'reject',
      reason: 'actor may not write this channel',
    });
  });

  // Checked before idempotency on purpose: otherwise an unauthorized ship could
  // learn which action ids a card has applied by watching which of its taps are
  // refused differently.
  it('rejects an unauthorized actor even when the action was already applied', () => {
    const decision = decide({
      actorMayWrite: false,
      action: { actionId: 'act-1' },
    });
    expect(decision.kind).toBe('reject');
  });

  // AC #3. No edit is the load-bearing part: the tapping client receives
  // nothing and falls back to its timeout. Emitting an edit here would apply
  // the action a second time.
  it('is a no-op for an action id already applied', () => {
    expect(decide({ action: { actionId: 'act-2' } })).toEqual({
      kind: 'noop',
      reason: 'action already applied',
    });
  });

  // AC #4
  it('rejects a stale expected revision without changing anything', () => {
    const decision = decide({ action: { expectedRevision: 2 } });
    expect(decision.kind).toBe('reject');
    expect(decision.kind === 'reject' && decision.reason).toContain(
      'stale revision'
    );
  });

  it('applies against the current revision when none is expected', () => {
    expect(decide({ action: { expectedRevision: undefined } })).toMatchObject({
      kind: 'apply',
      revision: 4,
    });
  });

  it('rejects an action aimed at a different surface', () => {
    const decision = decide({ action: { surfaceId: 'someone-else' } });
    expect(decision.kind).toBe('reject');
    expect(decision.kind === 'reject' && decision.reason).toContain(
      'different surface'
    );
  });

  // A card that has never been acted on carries no surface entry. The first tap
  // creates it, which is why the client omits expectedRevision in that case.
  it('creates the surface on a first tap against no state', () => {
    const decision = decideSurfaceAction({
      surface: null,
      action: action({ expectedRevision: undefined }),
      actorMayWrite: true,
    });

    expect(decision).toMatchObject({ kind: 'apply', revision: 1 });
    expect(decision.kind === 'apply' && decision.state).toEqual({
      days: { mon: { done: true } },
    });
  });

  it('accepts expectedRevision 0 against a card with no state', () => {
    expect(
      decideSurfaceAction({
        surface: null,
        action: action({ expectedRevision: 0 }),
        actorMayWrite: true,
      })
    ).toMatchObject({ kind: 'apply', revision: 1 });
  });

  it('rejects a non-zero expectedRevision against a card with no state', () => {
    expect(
      decideSurfaceAction({
        surface: null,
        action: action({ expectedRevision: 2 }),
        actorMayWrite: true,
      }).kind
    ).toBe('reject');
  });

  // A no-change records the id so a retry stays idempotent, but must not move
  // the revision — the client would otherwise never see it land, because it
  // reconciles on the revision advancing *or* the id appearing.
  it('records the action id without bumping the revision on a no-change', () => {
    const decision = decide({
      surface: surface({ state: { portions: 4 } }),
      action: { name: 'set', params: { path: 'portions', value: 4 } },
    });

    expect(decision).toMatchObject({
      kind: 'apply',
      revision: 3,
      noChange: true,
    });
    expect(decision.kind === 'apply' && decision.processedActionIds).toContain(
      'act-3'
    );
  });

  it('rejects an action the state vocabulary refuses', () => {
    const decision = decide({ action: { name: 'frobnicate' } });
    expect(decision.kind).toBe('reject');
    expect(decision.kind === 'reject' && decision.reason).toContain(
      'unknown action'
    );
  });

  // Every byte replicates to every member on every edit, so growth is refused
  // rather than truncated.
  it('rejects an action that would push state past its size cap', () => {
    const big = 'x'.repeat(INTERACTIVE_SURFACE_LIMITS.maxStateBytes);
    const decision = decide({
      action: { name: 'set', params: { path: 'notes', value: big } },
    });

    expect(decision.kind).toBe('reject');
    expect(decision.kind === 'reject' && decision.reason).toContain(
      'size limit'
    );
  });

  it('caps the remembered action ids, dropping the oldest', () => {
    const cap = INTERACTIVE_SURFACE_LIMITS.maxProcessedActionIds;
    const full = Array.from({ length: cap }, (_, i) => `old-${i}`);
    const decision = decide({
      surface: surface({ processedActionIds: full }),
      action: { actionId: 'newest' },
    });

    expect(decision.kind).toBe('apply');
    if (decision.kind !== 'apply') return;
    expect(decision.processedActionIds).toHaveLength(cap);
    expect(decision.processedActionIds).not.toContain('old-0');
    expect(decision.processedActionIds.at(-1)).toBe('newest');
  });

  // AC #5. Two participants tapping against the same revision: whoever the host
  // ordered first wins, and the second is now stale. Neither corrupts state,
  // and the loser's client re-renders from the authoritative post.
  it('resolves concurrent actions to one consistent state', () => {
    const start = surface({ revision: 3, state: { n: 0 } });

    const first = decideSurfaceAction({
      surface: start,
      action: action({
        actionId: 'from-zod',
        expectedRevision: 3,
        name: 'increment',
        params: { path: 'n' },
      }),
      actorMayWrite: true,
    });
    expect(first).toMatchObject({ kind: 'apply', revision: 4 });
    if (first.kind !== 'apply') return;

    const afterFirst: SurfaceState = {
      surfaceId: SURFACE_ID,
      revision: first.revision,
      state: first.state,
      processedActionIds: first.processedActionIds,
    };

    const second = decideSurfaceAction({
      surface: afterFirst,
      action: action({
        actionId: 'from-bus',
        expectedRevision: 3,
        name: 'increment',
        params: { path: 'n' },
      }),
      actorMayWrite: true,
    });

    expect(second.kind).toBe('reject');
    expect(afterFirst.state).toEqual({ n: 1 });
  });

  // The same pair with expectedRevision omitted both apply, which is the
  // documented last-write-wins opt-in — and the result is still consistent
  // rather than corrupt.
  it('serializes concurrent last-write-wins actions', () => {
    const start = surface({ revision: 3, state: { n: 0 } });
    const inc = (from: SurfaceState, actionId: string) => {
      const d = decideSurfaceAction({
        surface: from,
        action: action({
          actionId,
          expectedRevision: undefined,
          name: 'increment',
          params: { path: 'n' },
        }),
        actorMayWrite: true,
      });
      if (d.kind !== 'apply') throw new Error(`expected apply, got ${d.kind}`);
      return {
        surfaceId: SURFACE_ID,
        revision: d.revision,
        state: d.state,
        processedActionIds: d.processedActionIds,
      };
    };

    const end = inc(inc(start, 'from-zod'), 'from-bus');

    expect(end.revision).toBe(5);
    expect(end.state).toEqual({ n: 2 });
  });
});

describe('emptySurface', () => {
  it('is revision zero with empty state', () => {
    expect(emptySurface('s1')).toEqual({
      surfaceId: 's1',
      revision: 0,
      state: {},
      processedActionIds: [],
    });
  });
});

describe('jsonEqual', () => {
  // Key order must not count as a change, or every tap would bump the revision
  // and the no-change rule would never fire.
  it('ignores key order', () => {
    expect(jsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(jsonEqual({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toBe(true);
  });

  it('respects array order', () => {
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
  });

  it('distinguishes values and types', () => {
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: '1' })).toBe(false);
    expect(jsonEqual({ a: null }, {})).toBe(false);
  });

  it('compares nested structures', () => {
    const value: JsonObject = { days: { mon: { done: true }, tue: [1, 2] } };
    expect(jsonEqual(value, JSON.parse(JSON.stringify(value)))).toBe(true);
  });
});
