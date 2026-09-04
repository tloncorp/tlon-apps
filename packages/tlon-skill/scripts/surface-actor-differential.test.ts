import { describe, expect, it } from 'bun:test';

// Deep subpaths for the reason the gate and the walk use them: `bunfig.toml`
// preloads a process-wide `mock.module('@tloncorp/api', …)` whose mock carries
// no surface exports, so a root import fails ESM named-export validation.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';

import { actionWritesOnlyTheActor } from './surface-transitions';

type ApiModule = typeof import('@tloncorp/api');

const { applyOp, ACTOR_PLACEHOLDER } = surfaceJsonPointerModule as Pick<
  ApiModule,
  'applyOp' | 'ACTOR_PLACEHOLDER'
>;

/**
 * TWO READERS OF ONE TOKEN, HELD TOGETHER BY A TEST INSTEAD OF BY LUCK.
 *
 * `$actor` is read in two places, written days apart in different packages:
 *
 *   - the REDUCER (`jsonPointer.ts`) SUBSTITUTES it — a whole path segment
 *     becomes the actor's ship, a value that IS the token becomes the ship;
 *   - the GATE (`surface-transitions.ts`) DETECTS it, to decide whether an
 *     action writes only the presser's own data and is therefore exempt from
 *     the `no-op-control` finding.
 *
 * Until this file, nothing imported both. They agreed only by sharing the
 * placeholder STRING — not its semantics — which is the same shape as the
 * raw-vs-validated divergence class (D72): two readers of one input, each
 * correct alone, with no test standing between them.
 *
 * The audit found the seam had already come apart. The gate's predicate was a
 * faithful transliteration of the reducer's `substituteActorInValue`,
 * including its recursive descent into objects and arrays — and that fidelity
 * was the bug. Substitution is a property of WHERE THE AUTHOR PUT the token;
 * ownership is a property of WHERE THE OP WRITES. Copying the reducer exactly
 * made the gate exempt three actions that write shared paths (D172).
 *
 * So this file asserts the agreement that must hold and pins the divergence
 * that must NOT be closed:
 *
 *   1. Anything the gate calls actor-only, the reducer really does substitute
 *      — no exemption for a token the reducer would ignore or refuse.
 *   2. The gate is strictly NARROWER on values than the reducer. The reducer
 *      substitutes at any depth (that is its job, and templates may rely on
 *      it); the gate exempts only the bare-string value. A future edit that
 *      "restores parity" by widening the gate reopens the bypass, and case 3
 *      below fails.
 */

const ACTOR = '~sampel-palnet';

type Op = { op: string; path: string; value?: unknown };

/**
 * Does the reducer actually substitute the token anywhere in this op?
 *
 * Measured by running the real `applyOp` and looking for the actor's name in
 * the state it produces. A refusal is NOT a substitution — that is the
 * `/votes/$actor-choice` case, where the reducer rejects the op outright, so
 * no exemption may rest on it.
 */
function reducerSubstitutes(op: Op): boolean {
  const result = applyOp({}, op as never, { actor: ACTOR } as never);
  if (!result.ok) {
    return false;
  }
  return JSON.stringify(result.state).includes(ACTOR);
}

const CASES: {
  label: string;
  ops: Op[];
  /** the gate's exemption verdict */
  gateExempts: boolean;
  /** does the reducer substitute the token in every op? */
  reducerSubstitutesAll: boolean;
}[] = [
  {
    label: 'whole path segment — the documented default',
    ops: [{ op: 'set', path: '/votes/$actor', value: 'pizza' }],
    gateExempts: true,
    reducerSubstitutesAll: true,
  },
  {
    label: 'bare-string value — the expense-split spelling',
    ops: [{ op: 'set', path: '/paidBy/ferry', value: ACTOR_PLACEHOLDER }],
    gateExempts: true,
    reducerSubstitutesAll: true,
  },
  {
    label: 'no token anywhere — a plain shared write',
    ops: [{ op: 'set', path: '/tasks/theme/status', value: 'doing' }],
    gateExempts: false,
    reducerSubstitutesAll: false,
  },
  {
    label: 'one op tokened, one not — exemption needs EVERY op',
    ops: [
      { op: 'set', path: '/tasks/theme/status', value: 'doing' },
      { op: 'set', path: '/claims/$actor', value: 'theme' },
    ],
    gateExempts: false,
    reducerSubstitutesAll: false,
  },
  {
    label: 'token nested in an object value (D172 bypass S1)',
    ops: [
      {
        op: 'set',
        path: '/tasks/theme',
        value: { status: 'doing', claimedBy: ACTOR_PLACEHOLDER },
      },
    ],
    // THE DELIBERATE DIVERGENCE: the reducer substitutes here, and the gate
    // must NOT read that as ownership — the op writes a shared path.
    gateExempts: false,
    reducerSubstitutesAll: true,
  },
  {
    label: 'token nested in an array value (D172 bypass S3)',
    ops: [
      {
        op: 'set',
        path: '/config/mode',
        value: ['fixed', ACTOR_PLACEHOLDER],
      },
    ],
    gateExempts: false,
    reducerSubstitutesAll: true,
  },
  {
    label: 'partial-segment path — the reducer refuses it outright',
    ops: [{ op: 'set', path: '/votes/$actor-choice', value: 'pizza' }],
    gateExempts: false,
    reducerSubstitutesAll: false,
  },
];

function specWith(ops: Op[]) {
  return {
    version: 1,
    surfaceId: 'srf-differential',
    specRevision: 1,
    title: 'Differential',
    initialState: {},
    actions: { act: { ops } },
  } as never;
}

describe("$actor: the gate's reader and the reducer's agree", () => {
  for (const testCase of CASES) {
    it(`${testCase.label}`, () => {
      expect(
        actionWritesOnlyTheActor(specWith(testCase.ops), 'act'),
        "the gate's exemption verdict changed"
      ).toBe(testCase.gateExempts);

      const substitutesAll = testCase.ops.every((op) => reducerSubstitutes(op));
      expect(
        substitutesAll,
        "the reducer's substitution behaviour changed"
      ).toBe(testCase.reducerSubstitutesAll);
    });
  }

  it('the gate never exempts an op the reducer would not substitute', () => {
    // The agreement that must hold in one direction: an exemption resting on
    // a token the reducer ignores or refuses would be an exemption for
    // nothing at all.
    for (const testCase of CASES) {
      if (!testCase.gateExempts) continue;
      for (const op of testCase.ops) {
        expect(
          reducerSubstitutes(op),
          `gate exempts "${testCase.label}" but the reducer does not substitute ${op.path}`
        ).toBe(true);
      }
    }
  });

  it('the gate is strictly narrower than the reducer on values', () => {
    // The divergence that must NOT be closed. If someone "restores parity"
    // by making the gate recurse again, this fails — and so does every S1/S3
    // control in surface-transitions.test.ts.
    const nested = CASES.filter(
      (testCase) => testCase.reducerSubstitutesAll && !testCase.gateExempts
    );
    expect(
      nested.length,
      'no case covers a value the reducer substitutes and the gate refuses to exempt — the narrowing is unpinned'
    ).toBeGreaterThan(0);
  });

  it('both readers spell the token the same way', () => {
    // The string itself is the only thing the two ever shared. If the
    // reducer's constant moved, the gate would silently stop recognising it.
    expect(ACTOR_PLACEHOLDER).toBe('$actor');
    expect(
      actionWritesOnlyTheActor(
        specWith([{ op: 'set', path: `/votes/${ACTOR_PLACEHOLDER}` }]),
        'act'
      )
    ).toBe(true);
  });
});
