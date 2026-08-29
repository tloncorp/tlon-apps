import {
  Json,
  JsonObject,
  SURFACE_JSON_MAX_DEPTH,
  isForbiddenObjectKey,
  isJson,
  jsonContainerDepth,
} from './json';

/**
 * Restricted RFC 6901 JSON Pointer ops for surface channels.
 *
 * This module is the write path for all surface state. Every input is
 * untrusted; nothing here throws on bad input — a refused op reports failure
 * and leaves state untouched, tagged with the `OpRefusal` kind the caller
 * decides on. Semantics:
 *
 * - Paths must start with `/`; `~0`/`~1` escaping; max 200 chars and 12
 *   segments; no `__proto__`/`constructor`/`prototype` segments; the empty
 *   pointer is not a valid op target.
 * - `set` creates missing intermediate objects (never arrays); `del` on a
 *   missing path is a no-op; `append` requires an existing array target.
 * - Writes never index into arrays: every traversed container must be a
 *   plain object, except `append`'s final target, which must be an array.
 * - `$actor` is permitted only when an actor is supplied (spec-declared
 *   action ops): as a whole path segment, or as an exact string value.
 *   With no actor (host ops), any `$actor` use invalidates the op.
 */

export const POINTER_MAX_LENGTH = 200;
export const POINTER_MAX_SEGMENTS = 12;

/** The placeholder substituted with the verified actor's ship string. */
export const ACTOR_PLACEHOLDER = '$actor';

export type SurfaceOp =
  | { op: 'set'; path: string; value: Json }
  | { op: 'del'; path: string }
  | { op: 'append'; path: string; value: Json };

export type PointerResult =
  | { ok: true; segments: string[] }
  | { ok: false; error: string };

/** `~` → `~0`, `/` → `~1` (RFC 6901). */
export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Single-pass RFC 6901 unescape. Returns null on a dangling `~` or a `~`
 * followed by anything but `0`/`1`.
 */
export function unescapePointerSegment(segment: string): string | null {
  if (!segment.includes('~')) {
    return segment;
  }
  let out = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment[i];
    if (char !== '~') {
      out += char;
      continue;
    }
    const next = segment[i + 1];
    if (next === '0') {
      out += '~';
    } else if (next === '1') {
      out += '/';
    } else {
      return null;
    }
    i++;
  }
  return out;
}

export function formatPointer(segments: readonly string[]): string {
  return segments
    .map((segment) => `/${escapePointerSegment(segment)}`)
    .join('');
}

/**
 * Parses a pointer into unescaped segments under the restricted profile.
 * `$actor` placeholder segments pass here; substitution and its rules are
 * applied separately.
 */
export function parsePointer(path: string): PointerResult {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, error: 'empty pointer is not a valid op target' };
  }
  if (path.length > POINTER_MAX_LENGTH) {
    return { ok: false, error: `path exceeds ${POINTER_MAX_LENGTH} chars` };
  }
  if (!path.startsWith('/')) {
    return { ok: false, error: 'path must start with /' };
  }
  const rawSegments = path.slice(1).split('/');
  if (rawSegments.length > POINTER_MAX_SEGMENTS) {
    return {
      ok: false,
      error: `path exceeds ${POINTER_MAX_SEGMENTS} segments`,
    };
  }
  const segments: string[] = [];
  for (const raw of rawSegments) {
    const segment = unescapePointerSegment(raw);
    if (segment === null) {
      return { ok: false, error: `invalid escape in segment: ${raw}` };
    }
    if (isForbiddenObjectKey(segment)) {
      return { ok: false, error: `forbidden segment: ${segment}` };
    }
    segments.push(segment);
  }
  return { ok: true, segments };
}

type SegmentsResult =
  | { ok: true; segments: string[] }
  | { ok: false; error: string };

/**
 * Resolves `$actor` in parsed segments. With an actor: a segment that is
 * exactly `$actor` becomes the actor's ship string; a segment merely
 * containing it is invalid (partial-segment use). Without an actor (host
 * ops): any occurrence at all is invalid.
 */
function resolveActorSegments(
  segments: readonly string[],
  actor: string | undefined
): SegmentsResult {
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === ACTOR_PLACEHOLDER) {
      if (actor === undefined) {
        return { ok: false, error: '$actor is not valid in host ops' };
      }
      if (isForbiddenObjectKey(actor)) {
        return { ok: false, error: 'actor resolves to a forbidden segment' };
      }
      resolved.push(actor);
      continue;
    }
    if (segment.includes(ACTOR_PLACEHOLDER)) {
      return {
        ok: false,
        error: `partial-segment $actor use is invalid: ${segment}`,
      };
    }
    resolved.push(segment);
  }
  return { ok: true, segments: resolved };
}

function valueContainsActorPlaceholder(value: Json): boolean {
  if (value === ACTOR_PLACEHOLDER) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(valueContainsActorPlaceholder);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(valueContainsActorPlaceholder);
  }
  return false;
}

/**
 * Replaces every string that is exactly `$actor` with the actor's ship
 * string. Substrings are left literal. Returns a new tree; the input is
 * never mutated.
 */
function substituteActorInValue(value: Json, actor: string): Json {
  if (value === ACTOR_PLACEHOLDER) {
    return actor;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteActorInValue(item, actor));
  }
  if (typeof value === 'object' && value !== null) {
    const out: JsonObject = {};
    for (const key of Object.keys(value)) {
      out[key] = substituteActorInValue(value[key], actor);
    }
    return out;
  }
  return value;
}

/**
 * Why an op was refused. The reason travels with the failure because the
 * reducer's continue-or-abort decision turns on it, and re-deriving it from
 * the message text would be a decision made by string matching.
 *
 * - `grammar`   — the op is malformed on its face: a bad pointer, an over-long
 *                 or over-segmented path, a forbidden segment, `$actor`
 *                 misuse, a value that is not surface JSON.
 * - `structure` — the op is well formed, but the state's shape has no such
 *                 write: a scalar or array where an object must be traversed,
 *                 an `append` onto something that is not an array.
 * - `depth-cap` — the op is well formed and the shape admits it; the result
 *                 would simply nest past the JSON depth cap.
 *
 * `depth-cap` is a *resource* refusal — a limit on what state may hold — and
 * the other two are not. The consequence of that split lives in the reducer,
 * the only place that folds a sequence of ops.
 */
export type OpRefusal = 'grammar' | 'structure' | 'depth-cap';

export type ApplyOpResult =
  | { ok: true; state: JsonObject; changed: boolean }
  | { ok: false; refusal: OpRefusal; error: string };

function isPlainObjectValue(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Own-property read: names inherited from Object.prototype (`toString`,
 * `valueOf`, ...) must read as absent, not as state.
 */
function getOwn(obj: JsonObject, key: string): Json | undefined {
  return hasOwn(obj, key) ? obj[key] : undefined;
}

// Internal write results are wrapped so state objects that themselves
// contain an `error` key can never be mistaken for failures.
type WriteResult = { next: JsonObject } | { error: string } | null; // no-op (del on a missing path)

/** Copy-on-write set along `segments`; missing intermediates are created. */
function setAtPath(
  root: JsonObject,
  segments: readonly string[],
  value: Json
): WriteResult {
  const key = segments[0];
  const copy: JsonObject = { ...root };
  if (segments.length === 1) {
    copy[key] = value;
    return { next: copy };
  }
  const existing = getOwn(root, key);
  let child: JsonObject;
  if (existing === undefined) {
    child = {};
  } else if (isPlainObjectValue(existing)) {
    child = existing;
  } else {
    return { error: `cannot write through non-object at segment: ${key}` };
  }
  const result = setAtPath(child, segments.slice(1), value);
  if (result === null || 'error' in result) {
    return result;
  }
  copy[key] = result.next;
  return { next: copy };
}

/** Copy-on-write delete; missing anything is a successful no-op. */
function delAtPath(root: JsonObject, segments: readonly string[]): WriteResult {
  const key = segments[0];
  const existing = getOwn(root, key);
  if (segments.length === 1) {
    if (!hasOwn(root, key)) {
      return null; // no-op
    }
    const copy: JsonObject = { ...root };
    delete copy[key];
    return { next: copy };
  }
  if (existing === undefined) {
    return null; // no-op: missing path
  }
  if (!isPlainObjectValue(existing)) {
    if (Array.isArray(existing)) {
      return { error: `cannot write through array at segment: ${key}` };
    }
    return null; // path cannot exist below a scalar: no-op
  }
  const result = delAtPath(existing, segments.slice(1));
  if (result === null || 'error' in result) {
    return result;
  }
  const copy: JsonObject = { ...root };
  copy[key] = result.next;
  return { next: copy };
}

/** Copy-on-write append; the target must be an existing array. */
function appendAtPath(
  root: JsonObject,
  segments: readonly string[],
  value: Json
): WriteResult {
  const key = segments[0];
  const existing = getOwn(root, key);
  if (segments.length === 1) {
    if (!Array.isArray(existing)) {
      return { error: `append target is not an existing array: ${key}` };
    }
    const copy: JsonObject = { ...root };
    copy[key] = [...existing, value];
    return { next: copy };
  }
  if (!isPlainObjectValue(existing)) {
    return { error: `cannot write through non-object at segment: ${key}` };
  }
  const result = appendAtPath(existing, segments.slice(1), value);
  if (result === null || 'error' in result) {
    return result;
  }
  const copy: JsonObject = { ...root };
  copy[key] = result.next;
  return { next: copy };
}

/**
 * Applies one op to `state`, returning the next state. Never mutates input.
 * Pass `actor` for spec-declared action ops (enables `$actor`); omit it for
 * host ops (any `$actor` use invalidates the op). State is unaffected by a
 * failure; what the caller does about it depends on the `refusal` kind, and
 * that decision belongs to the reducer.
 */
export function applyOp(
  state: JsonObject,
  op: SurfaceOp,
  opts: { actor?: string } = {}
): ApplyOpResult {
  const parsed = parsePointer(op.path);
  if (!parsed.ok) {
    return { ok: false, refusal: 'grammar', error: parsed.error };
  }
  const resolved = resolveActorSegments(parsed.segments, opts.actor);
  if (!resolved.ok) {
    return { ok: false, refusal: 'grammar', error: resolved.error };
  }
  const segments = resolved.segments;

  let value: Json | undefined;
  if (op.op === 'set' || op.op === 'append') {
    // Schemas validate op values upstream, but applyOp stays total against
    // hostile values on its own: no non-JSON runtime values, forbidden
    // keys, or over-deep trees enter state through this layer.
    if (!isJson(op.value)) {
      return {
        ok: false,
        refusal: 'grammar',
        error: 'op value is not valid surface JSON',
      };
    }
    if (opts.actor === undefined) {
      if (valueContainsActorPlaceholder(op.value)) {
        return {
          ok: false,
          refusal: 'grammar',
          error: '$actor is not valid in host ops',
        };
      }
      value = op.value;
    } else {
      value = substituteActorInValue(op.value, opts.actor);
    }
    // Keep the resulting state snapshottable: the written value's containers
    // nest inside `segments.length` objects (plus the target array for
    // append), and snapshot state must itself validate at the depth cap.
    const pathDepth = segments.length + (op.op === 'append' ? 1 : 0);
    if (pathDepth + jsonContainerDepth(value) > SURFACE_JSON_MAX_DEPTH) {
      return {
        ok: false,
        refusal: 'depth-cap',
        error: `op would nest state beyond depth ${SURFACE_JSON_MAX_DEPTH}`,
      };
    }
  }

  const result =
    op.op === 'set'
      ? setAtPath(state, segments, value as Json)
      : op.op === 'del'
        ? delAtPath(state, segments)
        : appendAtPath(state, segments, value as Json);
  if (result === null) {
    return { ok: true, state, changed: false };
  }
  if ('error' in result) {
    // every write-helper error is a shape mismatch with the state as it
    // stands: a scalar or array where an object had to be traversed, or an
    // append onto a non-array.
    return { ok: false, refusal: 'structure', error: result.error };
  }
  return { ok: true, state: result.next, changed: true };
}
