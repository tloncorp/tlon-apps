import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../client/surface/json';
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

  test('$actor in host ops invalidates the op', () => {
    nextSeq = 1;
    const posts = [
      post(HOST, [
        hostEvent([
          { op: 'set', path: '/votes/$actor', value: 'x' },
          { op: 'set', path: '/title', value: 'still applies' },
        ]),
      ]),
    ];
    const result = expectReduced(reduce(posts));
    expect(result.state.votes).toEqual({});
    // remaining ops in the entry still apply in order (§7)
    expect(result.state.title).toBe('still applies');
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
              .array(fc.jsonValue({ maxDepth: 3 }) as fc.Arbitrary<any>, {
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
