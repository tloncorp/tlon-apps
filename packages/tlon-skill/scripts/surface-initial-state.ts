// The value import below uses a deep subpath for the same reason the gate and
// the transition walk do (see surface-lint.ts): `bunfig.toml` preloads a
// process-wide `mock.module('@tloncorp/api', …)` that does not carry the
// surface exports, so a root import resolves to the mock and fails ESM
// named-export validation. It lives here rather than in `commands/` because
// `command-contract.test.ts` forbids a command source from importing an API
// value at all — commands take pure helpers and injected deps, and the API
// wiring belongs on this side of that line.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceJsonPointerModule from '@tloncorp/api/client/surface/jsonPointer';

import { canonicalJson } from './surface-canonical-json';

// The reducer's own pointer formatter, so a path reported here is spelled the
// way an op targeting it would have to be. Duplicating the RFC 6901 escape
// would be a second answer to a question the reducer's parser already answers,
// free to drift from it.
const { formatPointer } = surfaceJsonPointerModule as Pick<
  typeof import('@tloncorp/api'),
  'formatPointer'
>;

/** A JSON object, as distinct from an array or any other value. */
export function plainObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Every leaf path at which two starting states disagree, as JSON Pointers.
 *
 * Written for one caller — `surface publish` refusing a preserving revision
 * that edits `initialState` — and the shape of the answer is decided by what
 * that refusal has to be able to say. It names paths because the remedy is a
 * host event, and a host event needs the path.
 *
 * The recursion descends only where BOTH sides are objects, so an array is a
 * leaf and is compared whole. That is not a shortcut, it is the honest answer:
 * an array's elements have no identity to align across two revisions, so
 * `["house","van"]` against `["house","van","lift"]` supports no finer claim
 * than "this path differs". Anything finer would be inventing an alignment.
 *
 * A key on one side only is reported at that key and not descended into: the
 * fact is that the subtree is absent, and listing every leaf inside it would
 * bury that fact under its own contents.
 *
 * Values are compared with `canonicalJson`, which erases key order and nothing
 * else (D109), so a reordered object is not a difference while every
 * difference a reader could observe is one.
 */
export function initialStateDivergence(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const walk = (
    left: unknown,
    right: unknown,
    segments: string[]
  ): string[] => {
    const leftObject = plainObject(left);
    const rightObject = plainObject(right);
    if (leftObject === null || rightObject === null) {
      return canonicalJson(left) === canonicalJson(right)
        ? []
        : [formatPointer(segments)];
    }
    const keys = [
      ...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)]),
    ].sort();
    return keys.flatMap((key) => {
      const path = [...segments, key];
      if (!Object.hasOwn(leftObject, key) || !Object.hasOwn(rightObject, key)) {
        return [formatPointer(path)];
      }
      return walk(leftObject[key], rightObject[key], path);
    });
  };
  return walk(before, after, []);
}
