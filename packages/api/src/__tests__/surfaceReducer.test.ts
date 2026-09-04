import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import type { Json, JsonObject } from '../client/surface/json';
import { jsonByteLength } from '../client/surface/json';
import {
  ReduceSurfaceInput,
  SurfacePostView,
  __comparePostIdsForTest,
  reduceSurface,
} from '../client/surface/reducer';
import { SurfaceSpec } from '../client/surface/schemas';
import { validSpec } from './surfaceSchemas.test';

const HOST = '~zod';
const MEMBER = '~ten';
const OTHER = '~bus';

function spec(overrides: Partial<SurfaceSpec> = {}): SurfaceSpec {
  return validSpec({
    initialState: { votes: {}, log: [], title: 'initial' },
    actions: {
      vote: {
        ops: [{ op: 'set', path: '/votes/$actor', value: 'yes' }],
      },
      'vote-stale-ok': {
        ops: [{ op: 'set', path: '/votes/$actor', value: 'stale-resolved' }],
        acceptStale: true,
      },
      'log-entry': {
        ops: [{ op: 'append', path: '/log', value: { who: '$actor' } }],
      },
    },
    ...overrides,
  });
}

let nextSeq = 1;
let nextPostId = 1;
function post(
  authorId: string,
  entries: unknown[],
  overrides: Partial<SurfacePostView> = {}
): SurfacePostView {
  return {
    authorId,
    // Required since D189. A post with no tie-break id cannot be ordered
    // against a post sharing its sequence number, so the reducer skips it
    // outright — a helper that omitted it would build posts that silently
    // never fold, and every assertion below would be about an empty log.
    id: `default-post-id-${nextPostId++}`,
    sequenceNum: nextSeq++,
    blob: JSON.stringify(entries),
    ...overrides,
  };
}

function hostEvent(ops: unknown[], specRevision = 3) {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision,
    mode: 'host',
    ops,
  };
}

function invoke(actionId: string, specRevision = 3) {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision,
    mode: 'invoke',
    actionId,
  };
}

function snapshot(
  state: JsonObject,
  upToSequenceNum: number,
  specRevision = 3
) {
  return {
    type: 'surface-snapshot',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision,
    upToSequenceNum,
    state,
  };
}

function reduce(
  posts: SurfacePostView[],
  specOverrides?: Partial<SurfaceSpec>
) {
  nextSeq = Math.max(nextSeq, 1);
  const input: ReduceSurfaceInput = {
    spec: spec(specOverrides),
    hostShip: HOST,
    posts,
  };
  return reduceSurface(input);
}

function reduceWithHead(
  posts: SurfacePostView[],
  advertisedHead: number | null,
  specOverrides?: Partial<SurfaceSpec>
) {
  const input: ReduceSurfaceInput = {
    spec: spec(specOverrides),
    hostShip: HOST,
    posts,
    advertisedHead,
  };
  return reduceSurface(input);
}

function expectReduced(result: ReturnType<typeof reduceSurface>) {
  expect(result.status).toBe('reduced');
  if (result.status !== 'reduced') {
    throw new Error('unreachable');
  }
  return result;
}

describe('basic folding', () => {
  test('folds from initialState with no posts', () => {
    nextSeq = 1;
    const result = expectReduced(reduce([]));
    expect(result.state).toEqual({ votes: {}, log: [], title: 'initial' });
    expect(result.baseSnapshotSeq).toBeNull();
  });

  test('folds host ops and member invokes in sequence order', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'Poll' }])]),
      post(MEMBER, [invoke('vote')]),
      post(OTHER, [invoke('vote')]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state).toEqual({
      votes: { [MEMBER]: 'yes', [OTHER]: 'yes' },
      log: [],
      title: 'Poll',
    });
    expect(result.foldedEventCount).toBe(3);
    expect(result.skippedEventCount).toBe(0);
  });

  test('$actor keys per-user state by the verified author', () => {
    nextSeq = 1;
    const posts = [
      post(MEMBER, [invoke('log-entry')]),
      post(OTHER, [invoke('log-entry')]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.log).toEqual([{ who: MEMBER }, { who: OTHER }]);
  });

  test('sequence order governs regardless of input order', () => {
    nextSeq = 1;
    const a = post(HOST, [
      hostEvent([{ op: 'set', path: '/title', value: 'first' }]),
    ]);
    const b = post(HOST, [
      hostEvent([{ op: 'set', path: '/title', value: 'second' }]),
    ]);
    const result = expectReduced(reduce([b, a]));
    expect(result.state.title).toBe('second');
  });
});

describe('adversarial events (§4.3)', () => {
  test('non-host raw ops are inert', () => {
    nextSeq = 1;
    const posts = [
      post(MEMBER, [
        hostEvent([{ op: 'set', path: '/title', value: 'pwned' }]),
      ]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.title).toBe('initial');
    expect(result.skippedEventCount).toBe(1);
  });

  test('a hand-crafted invoke achieves exactly what tapping achieves', () => {
    nextSeq = 1;
    // A member forging an invoke entry gets their own authorship folded —
    // identity comes from post.authorId, never from blob content.
    const crafted = {
      ...invoke('vote'),
      // fields a forger might add, all ignored or stripped by validation:
      actor: OTHER,
      ops: [{ op: 'set', path: '/votes/~bus', value: 'forged' }],
    };
    const result = expectReduced(reduce([post(MEMBER, [crafted])]));
    expect(result.state.votes).toEqual({ [MEMBER]: 'yes' });
  });

  test('stale host events are dropped (no stale exception for hosts)', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'old' }], 2)]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.title).toBe('initial');
    expect(result.skippedEventCount).toBe(1);
  });

  test('future-revision events are dropped, host and invoke alike', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'x' }], 4)]),
      post(MEMBER, [invoke('vote-stale-ok', 4)]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.title).toBe('initial');
    expect(result.state.votes).toEqual({});
    expect(result.skippedEventCount).toBe(2);
  });

  test('stale invokes without acceptStale are dropped', () => {
    nextSeq = 1;
    const result = expectReduced(reduce([post(MEMBER, [invoke('vote', 2)])]));
    expect(result.state.votes).toEqual({});
    expect(result.skippedEventCount).toBe(1);
  });

  test('stale invokes with acceptStale resolve against the CURRENT action', () => {
    nextSeq = 1;
    const result = expectReduced(
      reduce([post(MEMBER, [invoke('vote-stale-ok', 1)])])
    );
    // the folded value comes from the current spec's ops, not anything old
    expect(result.state.votes).toEqual({ [MEMBER]: 'stale-resolved' });
  });

  test('stale invokes whose actionId no longer exists are dropped', () => {
    nextSeq = 1;
    const result = expectReduced(
      reduce([post(MEMBER, [invoke('retired-action', 1)])])
    );
    expect(result.state.votes).toEqual({});
    expect(result.skippedEventCount).toBe(1);
  });

  test('invokes of undeclared actions are dropped even at current revision', () => {
    nextSeq = 1;
    const result = expectReduced(
      reduce([post(MEMBER, [invoke('not-declared')])])
    );
    expect(result.skippedEventCount).toBe(1);
  });

  test('$actor in host ops invalidates the op and stops the entry', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [
        hostEvent([
          { op: 'set', path: '/votes/$actor', value: 'x' },
          { op: 'set', path: '/title', value: 'never reached' },
        ]),
      ]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.votes).toEqual({});
    // every refusal aborts the rest of its entry (§7)
    expect(result.state.title).toBe('initial');
    expect(result.abortedSequenceNums).toHaveLength(1);
  });

  test('edited surface posts are retracted wholesale', () => {
    nextSeq = 1;
    const posts = [
      post(
        HOST,
        [hostEvent([{ op: 'set', path: '/title', value: 'edited' }])],
        {
          isEdited: true,
        }
      ),
      post(MEMBER, [invoke('vote')], { isEdited: true }),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state).toEqual({ votes: {}, log: [], title: 'initial' });
  });

  test('oversize and malformed entries are inert, valid siblings still fold', () => {
    nextSeq = 1;
    const oversize = hostEvent([
      { op: 'set', path: '/a', value: 'x'.repeat(9000) },
    ]);
    const malformed = { type: 'surface-event', version: 1, mode: 'nope' };
    const posts = [
      post(HOST, [
        oversize,
        malformed,
        hostEvent([{ op: 'set', path: '/title', value: 'valid' }]),
      ]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.a).toBeUndefined();
    expect(result.state.title).toBe('valid');
  });

  test('entries for another surfaceId are ignored', () => {
    nextSeq = 1;
    const foreign = {
      ...hostEvent([{ op: 'set', path: '/title', value: 'foreign' }]),
      surfaceId: 'other-surface',
    };
    const result = expectReduced(reduce([post(HOST, [foreign])]));
    expect(result.state.title).toBe('initial');
  });

  test('posts without a sequence number never fold', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'x' }])], {
        sequenceNum: null,
      }),
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'y' }])], {
        sequenceNum: undefined,
      }),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.title).toBe('initial');
  });
});

describe('snapshots (§4.4, §6)', () => {
  test('folds from the newest valid snapshot; earlier events are frozen', () => {
    nextSeq = 1;
    const posts = [
      post(MEMBER, [invoke('vote')]), // seq 1, frozen below boundary
      post(HOST, [snapshot({ votes: { [OTHER]: 'no' } }, 1)]), // seq 2
      post(MEMBER, [invoke('log-entry')]), // seq 3, above boundary
    ];
    const result = expectReduced(reduce(posts));
    expect(result.baseSnapshotSeq).toBe(1);
    // snapshot state replaces initialState wholesale; frozen vote absent
    expect(result.state).toEqual({
      votes: { [OTHER]: 'no' },
      log: undefined,
    });
  });

  test('the effective snapshot has the greatest upToSequenceNum', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ marker: 'older' }, 5)]),
      post(HOST, [snapshot({ marker: 'newer', log: [] }, 9)]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.baseSnapshotSeq).toBe(9);
    expect(result.state.marker).toBe('newer');
  });

  test('non-host snapshots are ignored', () => {
    nextSeq = 1;
    const result = expectReduced(
      reduce([post(MEMBER, [snapshot({ pwned: true }, 99)])])
    );
    expect(result.baseSnapshotSeq).toBeNull();
    expect(result.state.pwned).toBeUndefined();
  });

  test('wrong-revision snapshots are ignored under every setting', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ old: true }, 5, 2)]),
      post(HOST, [snapshot({ future: true }, 5, 4)]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.baseSnapshotSeq).toBeNull();
    expect(result.state.old).toBeUndefined();
    expect(result.state.future).toBeUndefined();
  });

  test('deleting or editing the newest snapshot falls back to the next-oldest', () => {
    nextSeq = 1;
    const older = post(HOST, [snapshot({ marker: 'older' }, 5)]);
    const newerDeleted = post(HOST, [snapshot({ marker: 'newer' }, 9)], {
      isDeleted: true,
    });
    const newerEdited = post(HOST, [snapshot({ marker: 'newest' }, 12)], {
      isEdited: true,
    });
    const result = expectReduced(reduce([older, newerDeleted, newerEdited]));
    expect(result.baseSnapshotSeq).toBe(5);
    expect(result.state.marker).toBe('older');
  });

  test('with no snapshot left, non-preserving specs refold from initialState', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ gone: true }, 5)], { isDeleted: true }),
      post(MEMBER, [invoke('vote')]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.baseSnapshotSeq).toBeNull();
    expect(result.state.votes).toEqual({ [MEMBER]: 'yes' });
  });
});

describe('migration gate (§6)', () => {
  test('preserveState with no current-revision snapshot is migration-pending', () => {
    nextSeq = 1;
    expect(reduce([], { preserveState: true }).status).toBe(
      'migration-pending'
    );
    // a snapshot at an older revision does not satisfy the gate
    const oldSnap = [post(HOST, [snapshot({ s: 1 }, 5, 2)])];
    expect(reduce(oldSnap, { preserveState: true }).status).toBe(
      'migration-pending'
    );
  });

  test('a current-revision migration snapshot unlocks the surface', () => {
    nextSeq = 1;
    const posts = [post(HOST, [snapshot({ migrated: true }, 0)])];
    const result = expectReduced(reduce(posts, { preserveState: true }));
    expect(result.state.migrated).toBe(true);
  });

  test('deleting the migration snapshot returns to migration-pending', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ migrated: true }, 0)], { isDeleted: true }),
    ];
    expect(reduce(posts, { preserveState: true }).status).toBe(
      'migration-pending'
    );
  });

  test('a non-preserving revision reset never replays prior-revision events', () => {
    nextSeq = 1;
    // Events and snapshot tagged revision 2; spec is at revision 3 without
    // preserveState: state is exactly initialState.
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'old' }], 2)]),
      post(MEMBER, [invoke('vote', 2)]),
      post(HOST, [snapshot({ old: true }, 2, 2)]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state).toEqual({ votes: {}, log: [], title: 'initial' });
    expect(result.baseSnapshotSeq).toBeNull();
  });
});

describe('newestFoldedSeq watermark', () => {
  test('null with nothing folded; snapshot boundary counts as folded', () => {
    nextSeq = 1;
    expect(expectReduced(reduce([])).newestFoldedSeq).toBeNull();

    nextSeq = 1;
    const snapOnly = expectReduced(
      reduce([post(HOST, [snapshot({ s: 1 }, 7)])])
    );
    expect(snapOnly.newestFoldedSeq).toBe(7);
  });

  test('advances to the last folded event, not past skipped events', () => {
    nextSeq = 1;
    const posts = [
      post(MEMBER, [invoke('vote')]), // seq 1, folds
      post(MEMBER, [invoke('vote', 99)]), // seq 2, skipped (future revision)
    ];
    const result = expectReduced(reduce(posts));
    expect(result.newestFoldedSeq).toBe(1);
    expect(result.skippedEventCount).toBe(1);
  });

  test('takes the greater of snapshot boundary and folded events', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ votes: {}, log: [] }, 5)]), // seq 1
      post(MEMBER, [invoke('vote')]), // seq 2, below boundary: frozen
    ];
    const result = expectReduced(reduce(posts));
    expect(result.baseSnapshotSeq).toBe(5);
    expect(result.newestFoldedSeq).toBe(5);

    nextSeq = 6;
    const above = post(MEMBER, [invoke('vote')]); // seq 6, above boundary
    const result2 = expectReduced(reduce([...posts, above]));
    expect(result2.newestFoldedSeq).toBe(6);
  });
});

describe('state cap', () => {
  test('ops pushing state over the cap are refused and flagged', () => {
    nextSeq = 1;
    // initialState small; append 4KB chunks until refusal
    const chunk = 'x'.repeat(4000);
    const posts = Array.from({ length: 40 }, () =>
      post(HOST, [hostEvent([{ op: 'append', path: '/log', value: chunk }])])
    );
    const result = expectReduced(reduce(posts));
    expect(result.stateFull).toBe(true);
    expect(jsonByteLength(result.state)).toBeLessThanOrEqual(128 * 1024);
    // state still holds everything that fit
    expect((result.state.log as unknown[]).length).toBeGreaterThan(20);
  });
});

/* ------------------------------------------------------------------ */
/* An op is refused: every remaining op in that entry is refused too,    */
/* whatever the refusal was about (§7). State after an entry is always a */
/* prefix of its ops, never a subsequence with a hole in it.             */
/* ------------------------------------------------------------------ */

const STATE_CAP = 128 * 1024;
const ROLLOVER_DATE = '2026-08-29';

/**
 * The host-is-the-clock shape at the edge of the cap: `/history` is the
 * accumulated archive, `/today` the scratch area a rollover copies and then
 * clears. `headroom` is how many bytes of the reduced-state cap are left
 * free, so a test can pick an op that does or does not fit.
 */
function nearCapState(headroom: number): JsonObject {
  const state: JsonObject = {
    history: { '2026-08-01': '' },
    today: { [MEMBER]: { r: 'ok' } },
  };
  const pad = STATE_CAP - headroom - jsonByteLength(state);
  (state.history as JsonObject)['2026-08-01'] = 'x'.repeat(pad);
  return state;
}

/** A host snapshot carrying `nearCapState`, so the fold starts at the edge. */
function nearCapSnapshotPost(headroom: number) {
  return post(HOST, [snapshot(nearCapState(headroom), 0)]);
}

/**
 * The same shape with `/history` holding a scalar instead of the archive —
 * the state a rollover meets when an earlier op put the wrong thing there.
 * Nothing is near the cap here: only the shape refuses the write.
 */
function badShapeSnapshotPost(today: JsonObject) {
  return post(HOST, [snapshot({ history: 'archived elsewhere', today }, 0)]);
}

/** Did the rollover's archiving `set` land? */
function archivedDate(state: JsonObject): boolean {
  const history = state.history;
  if (
    typeof history !== 'object' ||
    history === null ||
    Array.isArray(history)
  ) {
    return false;
  }
  return (history as JsonObject)[ROLLOVER_DATE] !== undefined;
}

/** `set /history/<date>` with a copy of `/today`, then `del /today`. */
function rolloverEvent(archive: Json) {
  return hostEvent([
    { op: 'set', path: `/history/${ROLLOVER_DATE}`, value: archive },
    { op: 'del', path: '/today' },
  ]);
}

describe('every refusal aborts the entry (§7)', () => {
  // The negative control. Pre-amendment the archiving `set` was refused for
  // the state cap and the `del` still applied, so the day's data was neither
  // archived nor still in `/today` — PARADIGM's "fully idempotent, gracefully
  // degrading" rollover destroying data at the cap.
  test('a near-cap rollover never loses the day it failed to archive', () => {
    nextSeq = 1;
    const today = { [MEMBER]: { r: 'ok' } };
    const result = expectReduced(
      reduce([nearCapSnapshotPost(10), post(HOST, [rolloverEvent(today)])])
    );

    const history = result.state.history as JsonObject;
    const archived = history[ROLLOVER_DATE] !== undefined;
    const kept = result.state.today !== undefined;

    // the invariant: the archive lands, or the day survives to be archived
    // later. "Neither" is the day destroyed.
    expect(archived || kept).toBe(true);

    // and specifically: the refused `set` stops the entry, so `del` is never
    // reached and `/today` is exactly as it was.
    expect(archived).toBe(false);
    expect(result.state.today).toEqual(today);
    expect(result.stateFull).toBe(true);
    expect(result.abortedSequenceNums).toHaveLength(1);
    // an aborted entry is still folded: it moved state and the watermark
    expect(result.foldedEventCount).toBe(1);
    expect(result.newestFoldedSeq).toBe(2);
  });

  test('the same rollover with room to spare applies both ops', () => {
    nextSeq = 1;
    const result = expectReduced(
      reduce([
        nearCapSnapshotPost(4096),
        post(HOST, [rolloverEvent({ [MEMBER]: { r: 'ok' } })]),
      ])
    );
    expect((result.state.history as JsonObject)[ROLLOVER_DATE]).toEqual({
      [MEMBER]: { r: 'ok' },
    });
    expect(result.state.today).toBeUndefined();
    expect(result.stateFull).toBe(false);
    expect(result.abortedSequenceNums).toHaveLength(0);
  });

  test('the depth cap aborts too: state cannot hold the result', () => {
    nextSeq = 1;
    // 12 path segments (the pointer maximum, so the path itself is legal)
    // carrying a value nested 5 deep: 17 containers against a depth cap of
    // 16. The op is well formed and the shape admits it, the state simply
    // cannot hold the result. The `del` after it must not run.
    const tooDeep = `/${Array.from({ length: 12 }, (_, i) => `d${i}`).join('/')}`;
    const nested = { a: { b: { c: { d: {} } } } };
    const result = expectReduced(
      reduce([
        post(HOST, [
          hostEvent([
            { op: 'set', path: '/keep', value: 'before' },
            { op: 'set', path: tooDeep, value: nested },
            { op: 'del', path: '/keep' },
          ]),
        ]),
      ])
    );
    expect(result.state.keep).toBe('before');
    expect(result.abortedSequenceNums).toHaveLength(1);
    // depth is not "dashboard full" — pruning state does not fix it
    expect(result.stateFull).toBe(false);
  });

  test('a malformed op aborts the rest of its entry too (§7)', () => {
    // The withdrawn criterion let this one through: `$actor` in a host op is
    // a `grammar` refusal, the op alone was voided, and the `del` after it
    // ran. Dependency does not track blame — the `del` was written on the
    // assumption that the op before it landed either way.
    nextSeq = 1;
    const result = expectReduced(
      reduce([
        post(HOST, [
          hostEvent([
            { op: 'set', path: '/keep', value: 'before' },
            { op: 'set', path: '/votes/$actor', value: 'x' }, // $actor in host ops
            { op: 'del', path: '/keep' },
          ]),
        ]),
      ])
    );
    expect(result.state.keep).toBe('before');
    expect(result.abortedSequenceNums).toHaveLength(1);
    // a malformed op is not "dashboard full" either
    expect(result.stateFull).toBe(false);
  });

  // The reason the skip-or-abort criterion was withdrawn. This is the same
  // archive-then-clear data loss as the near-cap and bad-shape rollovers
  // above, reached through a malformed op instead of a well-formed one: a
  // path missing its leading `/` is a `grammar` refusal, so under the old
  // criterion it skipped and the `del` still cleared the day that was never
  // archived.
  test('a rollover whose archiving op is malformed still keeps the day', () => {
    nextSeq = 1;
    const today = { [MEMBER]: { r: 'ok' } };
    const result = expectReduced(
      reduce([
        post(HOST, [snapshot({ history: {}, today }, 0)]),
        post(HOST, [
          hostEvent([
            // no leading slash: malformed, not a refusal state made
            { op: 'set', path: `history/${ROLLOVER_DATE}`, value: today },
            { op: 'del', path: '/today' },
          ]),
        ]),
      ])
    );

    // the invariant, unchanged: the archive lands, or the day survives to be
    // archived later. "Neither" is the day destroyed.
    expect(archivedDate(result.state)).toBe(false);
    expect(result.state.today).toEqual(today);
    expect(result.abortedSequenceNums).toHaveLength(1);
    expect(result.stateFull).toBe(false);
  });

  // Ruling 2: `del` through a non-object is uniformly a no-op. `del /x/y`
  // means "there is nothing at that path" whether `/x` holds a scalar or an
  // array, so both spellings continue the entry. The accepted cost is that
  // `del /list/0` — deleting an array element, which §7 does not admit as a
  // write target — is now silent rather than an error.
  test('both spellings of a missing del path are no-ops', () => {
    const entry = (holder: Json) => [
      post(
        HOST,
        [
          hostEvent([
            { op: 'set', path: '/holder', value: holder },
            { op: 'del', path: '/holder/inner' },
            { op: 'set', path: '/after', value: 'ran' },
          ]),
        ],
        { sequenceNum: 1 }
      ),
    ];

    const belowScalar = expectReduced(reduce(entry(5)));
    expect(belowScalar.state.after).toBe('ran');
    expect(belowScalar.abortedSequenceNums).toHaveLength(0);

    const belowArray = expectReduced(reduce(entry([1])));
    expect(belowArray.state.after).toBe('ran');
    expect(belowArray.state.holder).toEqual([1]);
    expect(belowArray.abortedSequenceNums).toHaveLength(0);
  });

  test('a structural refusal aborts too: it loses the same day the same way', () => {
    // The third kind, ruled onto the abort side after the amendment landed.
    // Nothing about this entry is wrong — it is the rollover, verbatim. The
    // state it met is the wrong shape: `/history` holds a scalar, so the
    // archiving `set` has nowhere to write. Continuing to the `del` destroys
    // the day exactly as the near-cap rollover did.
    nextSeq = 1;
    const today = { [MEMBER]: { r: 'ok' } };
    const result = expectReduced(
      reduce([badShapeSnapshotPost(today), post(HOST, [rolloverEvent(today)])])
    );

    // the invariant, unchanged: the archive lands, or the day survives to be
    // archived later. "Neither" is the day destroyed.
    expect(archivedDate(result.state)).toBe(false);
    expect(result.state.today).toEqual(today);
    expect(result.abortedSequenceNums).toHaveLength(1);
    // not "dashboard full": pruning state never makes `/history` an object,
    // so the flag a host repairs by snapshotting stays down.
    expect(result.stateFull).toBe(false);
  });

  test('property: a structural refusal leaves exactly the prefix that applied', () => {
    // Same shape as the cap property below, with a shape mismatch as the
    // refusal: the abort must give structure the same prefix guarantee.
    const trailingOp = fc.constantFrom<Json>(
      { op: 'del', path: '/today' },
      { op: 'del', path: '/history' },
      { op: 'set', path: '/today', value: 'clobbered' },
      { op: 'del', path: '/marks' }
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(trailingOp, { minLength: 1, maxLength: 6 }),
        (leadingCount, trailing) => {
          const leading = Array.from({ length: leadingCount }, (_, i) => ({
            op: 'set',
            path: `/marks/m${i}`,
            value: i,
          }));
          const today = { [MEMBER]: { r: 'ok' } };
          // refused whatever the leading ops did: `/history` is a scalar
          const throughScalar = {
            op: 'set',
            path: `/history/${ROLLOVER_DATE}`,
            value: today,
          };

          nextSeq = 1;
          const full = expectReduced(
            reduce([
              badShapeSnapshotPost(today),
              post(HOST, [hostEvent([...leading, throughScalar, ...trailing])]),
            ])
          );

          nextSeq = 1;
          const prefixOnly = expectReduced(
            reduce([
              badShapeSnapshotPost(today),
              post(HOST, [hostEvent(leading)]),
            ])
          );

          expect(full.state).toEqual(prefixOnly.state);
          expect(full.stateFull).toBe(false);
          expect(full.abortedSequenceNums).toHaveLength(1);
          // the destructive trailing ops never ran
          expect(full.state.today).toEqual(today);
        }
      )
    );
  });

  test('property: a cap refusal leaves exactly the prefix that applied', () => {
    // Every op before the refusal keeps its effect; no op after it has any.
    // Prefix, not subsequence, is the whole point: a subsequence can contain
    // a destructive op without the op it depended on.
    const trailingOp = fc.constantFrom<Json>(
      { op: 'del', path: '/today' },
      { op: 'del', path: '/history' },
      { op: 'set', path: '/today', value: 'clobbered' },
      { op: 'del', path: '/marks' }
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(trailingOp, { minLength: 1, maxLength: 6 }),
        (leadingCount, trailing) => {
          const leading = Array.from({ length: leadingCount }, (_, i) => ({
            op: 'set',
            path: `/marks/m${i}`,
            value: i,
          }));
          // 300 bytes of value against 200 bytes of headroom: refused however
          // many of the (tiny) leading ops landed first.
          const overflow = {
            op: 'set',
            path: `/history/${ROLLOVER_DATE}`,
            value: 'x'.repeat(300),
          };

          nextSeq = 1;
          const base = nearCapSnapshotPost(200);
          const full = expectReduced(
            reduce([
              base,
              post(HOST, [hostEvent([...leading, overflow, ...trailing])]),
            ])
          );

          nextSeq = 1;
          const prefixOnly = expectReduced(
            reduce([nearCapSnapshotPost(200), post(HOST, [hostEvent(leading)])])
          );

          expect(full.state).toEqual(prefixOnly.state);
          expect(full.stateFull).toBe(true);
          expect(full.abortedSequenceNums).toHaveLength(1);
          // the destructive trailing ops never ran
          expect(full.state.today).toEqual({ [MEMBER]: { r: 'ok' } });
        }
      )
    );
  });

  test('property: an author error stops the ops after it as well', () => {
    // Same generator shape, a malformed op instead of a refused one. The
    // withdrawn criterion continued the entry here, on the reasoning that
    // nothing was ever asked of state. It is the wrong question: whether the
    // ops after this one depended on it has nothing to do with whose fault
    // the refusal was, so a malformed op leaves the same prefix.
    const invalidOp = fc.constantFrom<Json>(
      { op: 'set', path: 'no-leading-slash', value: 1 },
      { op: 'set', path: '/votes/$actor', value: 1 }, // $actor in a host op
      { op: 'set', path: '/__proto__/x', value: 1 },
      { op: 'set', path: '/bad~zescape', value: 1 },
      { op: 'set', path: `/${'seg/'.repeat(13)}x`, value: 1 },
      { op: 'set', path: `/${'a'.repeat(250)}`, value: 1 },
      { op: 'set', path: '', value: 1 }
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        invalidOp,
        fc.integer({ min: 1, max: 6 }),
        (leadingCount, invalid, trailingCount) => {
          const leading = Array.from({ length: leadingCount }, (_, i) => ({
            op: 'set',
            path: `/marks/lead${i}`,
            value: i,
          }));
          const trailing = Array.from({ length: trailingCount }, (_, i) => ({
            op: 'set',
            path: `/marks/tail${i}`,
            value: i,
          }));

          nextSeq = 1;
          const full = expectReduced(
            reduce([
              post(HOST, [hostEvent([...leading, invalid, ...trailing])]),
            ])
          );

          nextSeq = 1;
          const prefixOnly = expectReduced(
            reduce([post(HOST, [hostEvent(leading)])])
          );

          // prefix, not subsequence — the same guarantee the cap and shape
          // properties above assert, now for a malformed op too
          expect(full.state).toEqual(prefixOnly.state);
          const marks = (full.state.marks ?? {}) as JsonObject;
          for (let i = 0; i < leadingCount; i++) {
            expect(marks[`lead${i}`]).toBe(i);
          }
          for (let i = 0; i < trailingCount; i++) {
            expect(marks[`tail${i}`]).toBeUndefined();
          }
          expect(full.abortedSequenceNums).toHaveLength(1);
        }
      )
    );
  });

  test('property: clients converge on a log containing an aborted entry', () => {
    // The abort has to be a function of the log alone, or the one component
    // every client runs identically stops agreeing.
    nextSeq = 1;
    const posts = [
      nearCapSnapshotPost(200),
      post(MEMBER, [invoke('vote')]),
      post(HOST, [rolloverEvent({ [MEMBER]: 'x'.repeat(300) })]),
      post(OTHER, [invoke('vote')]),
      post(HOST, [hostEvent([{ op: 'del', path: '/today' }])]),
    ];
    const reference = reduceSurface({ spec: spec(), hostShip: HOST, posts });
    expect(expectReduced(reference).abortedSequenceNums).toHaveLength(1);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(posts, {
          minLength: posts.length,
          maxLength: posts.length,
        }),
        (shuffled) => {
          expect(
            reduceSurface({ spec: spec(), hostShip: HOST, posts: shuffled })
          ).toEqual(reference);
        }
      )
    );
  });

  test('property: clients converge on a structurally aborted entry too', () => {
    // A structural refusal reads accumulated state, so it is worth showing
    // separately that it is still a function of the log: the shape `/history`
    // has is itself a pure function of the posts that folded before.
    nextSeq = 1;
    const today = { [MEMBER]: { r: 'ok' } };
    const posts = [
      badShapeSnapshotPost(today),
      post(MEMBER, [invoke('vote')]),
      post(HOST, [rolloverEvent(today)]),
      post(OTHER, [invoke('vote')]),
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'after' }])]),
    ];
    const reference = reduceSurface({ spec: spec(), hostShip: HOST, posts });
    expect(expectReduced(reference).abortedSequenceNums).toHaveLength(1);
    expect(expectReduced(reference).state.today).toEqual(today);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(posts, {
          minLength: posts.length,
          maxLength: posts.length,
        }),
        (shuffled) => {
          expect(
            reduceSurface({ spec: spec(), hostShip: HOST, posts: shuffled })
          ).toEqual(reference);
        }
      )
    );
  });

  test("compaction at the watermark never replays an aborted entry's prefix", () => {
    // The only two-batch fold the reducer has an interface for: a host folds
    // the log so far, writes the result down as a snapshot at
    // `newestFoldedSeq`, and prunes everything the snapshot covers. The
    // aborted entry's leading `append` has to land exactly once across that
    // boundary — which is what "an aborted entry still advances the
    // watermark" buys, and an `append` is the op that shows it, since
    // replaying an idempotent `set` looks identical either way.
    nextSeq = 1;
    const today = { [MEMBER]: { r: 'ok' } };
    const posts = [
      // `/history` holds a scalar, so the rollover's archiving `set` is
      // refused however the entry got here
      post(HOST, [snapshot({ history: 'elsewhere', today, log: [] }, 0)]),
      post(HOST, [
        hostEvent([
          { op: 'append', path: '/log', value: 'rolled' }, // lands
          { op: 'set', path: `/history/${ROLLOVER_DATE}`, value: today }, // refused
          { op: 'del', path: '/today' }, // never runs
        ]),
      ]),
      post(OTHER, [invoke('vote')]),
    ];

    const whole = expectReduced(
      reduceSurface({ spec: spec(), hostShip: HOST, posts })
    );
    expect(whole.abortedSequenceNums).toHaveLength(1);
    expect(whole.state.log).toEqual(['rolled']);
    expect(whole.state.today).toEqual(today);

    // batch 1: the log through the aborted entry
    const firstBatch = expectReduced(
      reduceSurface({ spec: spec(), hostShip: HOST, posts: posts.slice(0, 2) })
    );
    expect(firstBatch.abortedSequenceNums).toHaveLength(1);
    expect(firstBatch.newestFoldedSeq).toBe(2);

    // batch 2: that state written down, and only the posts it does not cover
    const watermark = firstBatch.newestFoldedSeq ?? -Infinity;
    const compacted = expectReduced(
      reduceSurface({
        spec: spec(),
        hostShip: HOST,
        posts: [
          post(HOST, [snapshot(firstBatch.state, watermark)], {
            sequenceNum: 100,
          }),
          ...posts.filter((p) => (p.sequenceNum as number) > watermark),
        ],
      })
    );
    expect(compacted.state).toEqual(whole.state);
  });

  /**
   * The audit trail `--allow-aborted-events` prints in the CLI is this array,
   * so it carries the same determinism obligation every other reduction field
   * does: a pure function of the SORTED log, identical on every client
   * whatever order the posts arrived in — including the order of the array
   * itself, which is what makes it readable as "go and look at 11, then 17".
   *
   * The sequences are non-adjacent and away from both ends of the history,
   * with clean entries before, between and after. An off-by-one, a "report
   * every folded entry", a "report the first one only", and an order that
   * follows arrival rather than sequence all read differently from [11, 17].
   */
  test('property: the aborted sequences are the same array in any input order', () => {
    nextSeq = 1;
    const aborting = () =>
      hostEvent([
        // `/title` holds a string, so there is nowhere to write through it
        { op: 'set', path: '/title/inner', value: 'nowhere' },
        { op: 'set', path: '/never', value: 'applied' },
      ]);
    const clean = (value: string) =>
      hostEvent([{ op: 'set', path: '/subtitle', value }]);
    const posts = [
      post(HOST, [clean('a')], { sequenceNum: 5 }),
      post(HOST, [aborting()], { sequenceNum: 11 }),
      post(HOST, [clean('b')], { sequenceNum: 12 }),
      post(HOST, [aborting()], { sequenceNum: 17 }),
      post(HOST, [clean('c')], { sequenceNum: 23 }),
    ];

    const reference = expectReduced(
      reduceSurface({ spec: spec(), hostShip: HOST, posts })
    );
    // The premise: both entries really did stop, and the op after each
    // refusal really did not apply.
    expect(reference.abortedSequenceNums).toEqual([11, 17]);
    expect(reference.state.never).toBeUndefined();
    expect(reference.state.subtitle).toBe('c');

    fc.assert(
      fc.property(
        fc.shuffledSubarray(posts, {
          minLength: posts.length,
          maxLength: posts.length,
        }),
        (shuffled) => {
          const result = expectReduced(
            reduceSurface({ spec: spec(), hostShip: HOST, posts: shuffled })
          );
          expect(result.abortedSequenceNums).toEqual([11, 17]);
        }
      )
    );
  });
});

describe('totality and determinism', () => {
  test('property: never throws on arbitrary post garbage', () => {
    const garbagePost = fc.record(
      {
        authorId: fc.oneof(fc.constantFrom(HOST, MEMBER), fc.string()),
        sequenceNum: fc.option(
          fc.oneof(fc.integer(), fc.double(), fc.constant(NaN)),
          { nil: null }
        ),
        isEdited: fc.option(fc.boolean(), { nil: undefined }),
        isDeleted: fc.option(fc.boolean(), { nil: undefined }),
        blob: fc.option(
          fc.oneof(
            fc.string(),
            fc
              .array(fc.jsonValue({ maxDepth: 3 }) as fc.Arbitrary<Json>, {
                maxLength: 3,
              })
              .map((arr) => JSON.stringify(arr)),
            fc
              .array(
                fc.constantFrom(
                  hostEvent([{ op: 'set', path: '/title', value: 'x' }]),
                  invoke('vote'),
                  invoke('vote', 99),
                  snapshot({ s: 1 }, 2),
                  { type: 'surface-event' },
                  null
                ),
                { maxLength: 4 }
              )
              .map((arr) => JSON.stringify(arr))
          ),
          { nil: null }
        ),
      },
      { requiredKeys: [] }
    );
    fc.assert(
      fc.property(
        fc.array(garbagePost, { maxLength: 12 }),
        fc.boolean(),
        (posts, preserveState) => {
          const result = reduceSurface({
            spec: spec({ preserveState }),
            hostShip: HOST,
            posts: posts as SurfacePostView[],
          });
          expect(['reduced', 'migration-pending']).toContain(result.status);
        }
      )
    );
  });

  test('property: input order never changes the result', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'Poll' }])]),
      post(MEMBER, [invoke('vote')]),
      post(HOST, [snapshot({ votes: {}, log: [] }, 1)]),
      post(OTHER, [invoke('log-entry')]),
      post(MEMBER, [invoke('vote', 1)]),
    ];
    const reference = reduceSurface({ spec: spec(), hostShip: HOST, posts });
    fc.assert(
      fc.property(
        fc.shuffledSubarray(posts, {
          minLength: posts.length,
          maxLength: posts.length,
        }),
        (shuffled) => {
          const result = reduceSurface({
            spec: spec(),
            hostShip: HOST,
            posts: shuffled,
          });
          expect(result).toEqual(reference);
        }
      )
    );
  });

  test('property: reducing twice is deterministic', () => {
    nextSeq = 1;
    const posts = [
      post(MEMBER, [invoke('log-entry')]),
      post(HOST, [hostEvent([{ op: 'set', path: '/n', value: 1 }])]),
    ];
    const input: ReduceSurfaceInput = { spec: spec(), hostShip: HOST, posts };
    expect(reduceSurface(input)).toEqual(reduceSurface(input));
  });

  test('never mutates the spec initialState', () => {
    nextSeq = 1;
    const theSpec = spec();
    const before = JSON.parse(JSON.stringify(theSpec.initialState));
    reduceSurface({
      spec: theSpec,
      hostShip: HOST,
      posts: [
        post(MEMBER, [invoke('vote')]),
        post(MEMBER, [invoke('log-entry')]),
      ],
    });
    expect(theSpec.initialState).toEqual(before);
  });
});

/**
 * DUPLICATE SEQUENCE NUMBERS (D174).
 *
 * Nothing guarantees `sequenceNum` is unique — there is no unique index on
 * `(channelId, sequenceNum)` — and two posts sharing one used to tie
 * completely in the sort, so `Array.prototype.sort`'s stability handed the
 * decision to whichever order the posts arrived in. Two clients holding
 * identical posts could then hold different state, which is exactly what §6
 * says cannot happen.
 *
 * The existing order-invariance properties could not see it: every one of
 * them shuffles posts whose sequence numbers are DISTINCT, because the
 * generator hands them out from a strictly-increasing counter. The failing
 * case was outside the generator, so the property that was supposed to cover
 * convergence excluded the only input that breaks it.
 */
describe('total order under duplicate sequence numbers (D174)', () => {
  /** two posts, same sequence number, writing the same pointer */
  function collidingPosts() {
    return [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'first' }])], {
        sequenceNum: 7,
        id: '170.141.184.500',
      }),
      post(
        HOST,
        [hostEvent([{ op: 'set', path: '/title', value: 'second' }])],
        { sequenceNum: 7, id: '170.141.184.501' }
      ),
    ];
  }

  test('property: two posts sharing a sequence number still converge', () => {
    nextSeq = 1;
    const posts = collidingPosts();
    const reference = expectReduced(reduce(posts));
    fc.assert(
      fc.property(
        fc.shuffledSubarray(posts, {
          minLength: posts.length,
          maxLength: posts.length,
        }),
        (shuffled) => {
          expect(reduce(shuffled)).toEqual(reference);
        }
      )
    );
  });

  test('the later post id wins, whichever order they arrive in', () => {
    const [a, b] = collidingPosts();
    // the tie-break is the host id, so both arrival orders must agree AND
    // must agree on the HIGHER id — a test that only asserted agreement
    // would pass on a coin flip that happened to be stable
    expect(expectReduced(reduce([a, b])).state).toMatchObject({
      title: 'second',
    });
    expect(expectReduced(reduce([b, a])).state).toMatchObject({
      title: 'second',
    });
  });

  test('dotted @ud ids order numerically, not lexicographically', () => {
    // `9` vs `10`: a plain string compare puts `9` last and would invert
    // the fold. Canonical ids are dot-grouped and variable length, so this
    // is the ordinary case, not an edge one.
    const posts = [
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'nine' }])], {
        sequenceNum: 4,
        id: '9',
      }),
      post(HOST, [hostEvent([{ op: 'set', path: '/title', value: 'ten' }])], {
        sequenceNum: 4,
        id: '10',
      }),
    ];
    expect(expectReduced(reduce(posts)).state).toMatchObject({ title: 'ten' });
    expect(expectReduced(reduce([...posts].reverse())).state).toMatchObject({
      title: 'ten',
    });
  });

  test('a post with no id is skipped, not folded in caller order', () => {
    // The field is REQUIRED since D189, so this is the shape only a caller
    // that is not typechecked against us can produce — and the reducer has
    // to refuse it rather than fall back to arrival order, which is the
    // dependence the key exists to remove. The cast is the point of the
    // test: without it this does not compile.
    nextSeq = 1;
    const withId = post(HOST, [
      hostEvent([{ op: 'set', path: '/title', value: 'kept' }]),
    ]);
    const withoutId = post(HOST, [
      hostEvent([{ op: 'set', path: '/title', value: 'dropped' }]),
    ]);
    delete (withoutId as { id?: string }).id;
    const result = expectReduced(reduce([withId, withoutId]));
    expect(result.state).toMatchObject({ title: 'kept' });
    expect(result.foldedEventCount).toBe(1);
    // and it is skipped whichever order it arrives in
    expect(expectReduced(reduce([withoutId, withId])).state).toMatchObject({
      title: 'kept',
    });
  });
});

/**
 * THE TIE-BREAK KEY HAS TO BE A TOTAL ORDER, NOT A COMPARATOR (D189).
 *
 * `comparePostIds` is the second sort key, so the "posts, any order"
 * contract on `reduceSurface` is worth exactly what the order underneath it
 * is worth. It was not one, twice over:
 *
 *   - `1.000` and `1000` strip to the same digits at the same length, so
 *     neither `<` held and BOTH directions returned 1 — `a > b` and `b > a`
 *     at once, which makes `Array.prototype.sort` a function of arrival
 *     order for the tied pair.
 *   - Numeric and non-numeric ids were compared raw against each other,
 *     closing a cycle across the two classes: `"2" > "1x" > "10" > "2"`.
 *
 * Neither defect is visible to a test that checks a handful of hand-picked
 * pairs, because both are properties of the RELATION and not of any one
 * comparison. So this asserts the three laws directly, over every pair and
 * every triple of a corpus that spans both classes.
 */
describe('comparePostIds is a total order (D189)', () => {
  /**
   * Both id classes the fold can meet, plus the two shapes that broke it.
   *
   * Small enough that all 900 pairs and all 27,000 triples are cheap, which
   * is why the assertion can be exhaustive rather than sampled — the defects
   * live in specific pairs, and a sampler can miss a specific pair.
   */
  const ID_CORPUS = [
    // canonical dotted @ud renders, the ordinary case
    '170.141.184.505.988',
    '170.141.184.505.989',
    '170.141.184.506.000',
    '170.141.184.505.987',
    // plain digit strings, short and long
    '0',
    '1',
    '2',
    '9',
    '10',
    '11',
    '100',
    '12.345',
    '12345',
    '999999999999999999999999',
    // the pair that returned 1 in both directions: same digits, same length,
    // different rendering
    '1.000',
    '1000',
    // sequence stubs — the non-numeric ids that really exist
    'sequence-stub-chat-1',
    'sequence-stub-chat-2',
    'sequence-stub-chat-10',
    'sequence-stub-other-1',
    // the members of the cross-class cycle, and near neighbours of them
    '1x',
    '2x',
    '10x',
    'x',
    '',
    ' ',
    '1.',
    '.1',
    '-1',
    '1e3',
  ];

  const sign = (n: number) => (n === 0 ? 0 : n > 0 ? 1 : -1);
  const cmp = (a: string, b: string) => sign(__comparePostIdsForTest(a, b));

  test('reflexive: every id compares equal to itself', () => {
    for (const id of ID_CORPUS) {
      expect(__comparePostIdsForTest(id, id)).toBe(0);
    }
  });

  test('antisymmetric: sign(cmp(a,b)) === -sign(cmp(b,a)) for every pair', () => {
    for (const a of ID_CORPUS) {
      for (const b of ID_CORPUS) {
        expect([a, b, cmp(a, b)]).toEqual([a, b, sign(-cmp(b, a))]);
      }
    }
  });

  test('total: distinct ids never compare equal', () => {
    // A tie-break that ties is not a tie-break — the sort falls through to
    // arrival order exactly where the key was supposed to decide.
    for (const a of ID_CORPUS) {
      for (const b of ID_CORPUS) {
        if (a === b) continue;
        expect([a, b, cmp(a, b)]).not.toEqual([a, b, 0]);
      }
    }
  });

  test('transitive: a < b and b < c implies a < c, over every triple', () => {
    for (const a of ID_CORPUS) {
      for (const b of ID_CORPUS) {
        if (cmp(a, b) >= 0) continue;
        for (const c of ID_CORPUS) {
          if (cmp(b, c) >= 0) continue;
          expect([a, b, c, cmp(a, c)]).toEqual([a, b, c, -1]);
        }
      }
    }
  });

  test('sorting the corpus is independent of its starting order', () => {
    // The property the fold actually consumes: `events.sort` has to land on
    // one arrangement whatever order the posts arrived in. An inconsistent
    // comparator does not throw here — it silently returns a different
    // permutation, which is how the defect reached a board.
    const reference = [...ID_CORPUS].sort(__comparePostIdsForTest);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ID_CORPUS, {
          minLength: ID_CORPUS.length,
          maxLength: ID_CORPUS.length,
        }),
        (shuffled) => {
          expect([...shuffled].sort(__comparePostIdsForTest)).toEqual(
            reference
          );
        }
      )
    );
  });

  test("the reviewer's tie: two conflicting host writes converge either way", () => {
    // The reproduction, at the fold rather than at the comparator. Same
    // sequence number, conflicting writes to one pointer, and ids that are
    // the same number rendered two ways — the pair the old comparator
    // ordered both ways at once. It reduced to {"x": 2} given one input
    // order and {"x": 1} given the other.
    nextSeq = 1;
    const dotted = post(
      HOST,
      [hostEvent([{ op: 'set', path: '/x', value: 1 }])],
      { sequenceNum: 7, id: '1.000' }
    );
    const plain = post(
      HOST,
      [hostEvent([{ op: 'set', path: '/x', value: 2 }])],
      { sequenceNum: 7, id: '1000' }
    );
    const forward = expectReduced(reduce([dotted, plain]));
    const backward = expectReduced(reduce([plain, dotted]));
    expect(forward.state).toEqual(backward.state);
    // and it is the higher id that wins, not whichever arrived last — an
    // assertion of agreement alone would pass on a stable coin flip
    expect(forward.state).toMatchObject({ x: 2 });
  });
});

/**
 * AN INFLATED SNAPSHOT BOUNDARY CANNOT BRICK A CHANNEL (D175).
 *
 * `upToSequenceNum` reads like a checked invariant in §4.4 and was only a
 * writer obligation. A snapshot claiming `upTo: 1_000_000` wins selection
 * forever (selection takes the greatest), freezes every real event beneath
 * its boundary, and leaves the board permanently at `foldedEventCount: 0`.
 * The realistic trigger is a writer putting a millisecond timestamp in the
 * field, not an attacker.
 */
describe('snapshot boundary vs the advertised head (D175)', () => {
  function postsWithInflatedSnapshot() {
    nextSeq = 1;
    return [
      post(HOST, [snapshot({ votes: { [OTHER]: 'no' } }, 1_000_000)]),
      post(MEMBER, [invoke('vote')]),
    ];
  }

  test('without a head, the inflated snapshot still freezes the board', () => {
    // The pre-fix behaviour, pinned deliberately: the reducer alone cannot
    // tell an honest boundary from a fabricated one, so callers that supply
    // no head get exactly what they got before.
    const result = expectReduced(reduce(postsWithInflatedSnapshot()));
    expect(result.foldedEventCount).toBe(0);
    expect(result.baseSnapshotSeq).toBe(1_000_000);
  });

  test('with the advertised head, the snapshot is refused and the log folds', () => {
    const result = expectReduced(
      reduceWithHead(postsWithInflatedSnapshot(), 2)
    );
    expect(result.baseSnapshotSeq).toBeNull();
    expect(result.foldedEventCount).toBeGreaterThan(0);
    expect(result.state).toMatchObject({ votes: { [MEMBER]: 'yes' } });
  });

  test('an honest snapshot at exactly the head is still selected', () => {
    // The boundary case that would make the guard over-eager: `upTo` equal
    // to the head is legal, and rejecting it would break every snapshot
    // written by the default path (which uses the newest sequence number).
    nextSeq = 1;
    const posts = [
      post(HOST, [snapshot({ votes: { [OTHER]: 'no' } }, 2)]),
      post(MEMBER, [invoke('vote')]),
    ];
    const result = expectReduced(reduceWithHead(posts, 2));
    expect(result.baseSnapshotSeq).toBe(2);
  });
});

/**
 * `initialState` IS REPLACED WHOLESALE, AND THAT IS THE CONTRACT (D176).
 *
 * `--preserve-state` publishing a revision that also edits `initialState`
 * silently loses the edit: the reducer never reads `initialState` on a
 * preserving spec, so the new values are simply absent. D167 put a guard in
 * `surface publish` — but the guard is publish-only, and any other writer
 * (Hermes, a hand-edited channel description, the client-executed publish
 * the plan contemplates for v1) reintroduces the bug at full strength.
 *
 * The reducer cannot fix it: every merge rule that WOULD carry the edit is
 * unsafe (D167), so the semantic has to be a writer obligation. These tests
 * pin the behaviour writers are obliged against, so a future "helpful merge"
 * has to delete an explicit test rather than quietly change a line.
 */
describe('initialState replacement is the contract, not a bug (D176)', () => {
  test('a snapshot replaces initialState wholesale — no merge, no fallback', () => {
    nextSeq = 1;
    const posts = [post(HOST, [snapshot({ votes: { [OTHER]: 'no' } }, 1)])];
    const result = expectReduced(reduce(posts));
    // `initialState` declares BOTH `votes` and `log`; the snapshot declares
    // only `votes`. If the reducer merged, `log` would survive.
    expect(result.state).toEqual({ votes: { [OTHER]: 'no' }, log: undefined });
    expect('log' in result.state).toBe(false);
  });

  test('a preserving spec never reads initialState at all', () => {
    // The migration gate returns before `initialState` is touched, so a
    // preserving revision that edits it changes nothing anywhere.
    nextSeq = 1;
    const withoutSnapshot = reduce([post(MEMBER, [invoke('vote')])], {
      preserveState: true,
    });
    expect(withoutSnapshot.status).toBe('migration-pending');

    const withSnapshot = expectReduced(
      reduce(
        [
          post(HOST, [snapshot({ carried: true } as JsonObject, 1)]),
          post(MEMBER, [invoke('vote')]),
        ],
        { preserveState: true }
      )
    );
    // the carried state, and nothing from initialState
    expect(withSnapshot.state).toMatchObject({ carried: true });
    expect(withSnapshot.state.log).toBeUndefined();
  });
});
