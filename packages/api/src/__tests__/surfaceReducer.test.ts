import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import type { Json, JsonObject } from '../client/surface/json';
import { jsonByteLength } from '../client/surface/json';
import {
  ReduceSurfaceInput,
  SurfacePostView,
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
function post(
  authorId: string,
  entries: unknown[],
  overrides: Partial<SurfacePostView> = {}
): SurfacePostView {
  return {
    authorId,
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
