/**
 * The action vocabulary for interactive card state.
 *
 * A card's `state` is opaque to the protocol, but something has to be able to
 * change it when someone taps a button. A kit cannot supply a reducer — kits
 * carry no executable code by design (see docs/kits.md), and that is a security
 * property rather than an implementation detail. So the agent ships a fixed,
 * small set of operations instead, each addressing a path inside `state`.
 *
 * Everything here is pure and total: an operation either returns new state or
 * returns a reason it refused. Nothing mutates its input, because the caller
 * compares before and after to decide whether the revision moves.
 *
 * See docs/tlon-apps/interactive-surfaces.md.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** The operations a button's `name` may select. */
export const STATE_OPS = [
  'set',
  'toggle',
  'increment',
  'append',
  'remove',
] as const;

export type StateOp = (typeof STATE_OPS)[number];

export function isStateOp(name: string): name is StateOp {
  return (STATE_OPS as readonly string[]).includes(name);
}

export type StateOpResult =
  | { ok: true; state: JsonObject }
  | { ok: false; reason: string };

/**
 * Apply one operation to a card's state.
 *
 * `params.path` is dot-separated; a numeric segment indexes an array. Missing
 * intermediate containers are created, because a card's first tap legitimately
 * writes a key that does not exist yet — but only where the path itself says
 * which kind of container to make.
 */
export function applyStateOp(
  state: JsonObject,
  name: string,
  params: JsonObject | undefined
): StateOpResult {
  if (!isStateOp(name)) {
    return { ok: false, reason: `unknown action "${name}"` };
  }

  const rawPath = params?.path;
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return { ok: false, reason: `action "${name}" requires a string path` };
  }
  const path = parsePath(rawPath);
  if (!path) {
    return { ok: false, reason: `malformed path "${rawPath}"` };
  }

  const current = readPath(state, path);

  switch (name) {
    case 'set': {
      if (!('value' in (params ?? {}))) {
        return { ok: false, reason: 'set requires a value' };
      }
      return writePath(state, path, params!.value);
    }

    case 'toggle': {
      // Absent reads as false so a first tap turns something on. A non-boolean
      // is refused rather than coerced: silently truthy-flipping a string would
      // corrupt state that some other operation owns.
      if (current !== undefined && typeof current !== 'boolean') {
        return {
          ok: false,
          reason: `toggle expects a boolean at "${rawPath}"`,
        };
      }
      return writePath(state, path, !(current ?? false));
    }

    case 'increment': {
      const by = params?.by ?? 1;
      if (typeof by !== 'number' || !Number.isFinite(by)) {
        return { ok: false, reason: 'increment expects a finite numeric by' };
      }
      if (current !== undefined && typeof current !== 'number') {
        return {
          ok: false,
          reason: `increment expects a number at "${rawPath}"`,
        };
      }
      return writePath(state, path, (current ?? 0) + by);
    }

    case 'append': {
      if (!('value' in (params ?? {}))) {
        return { ok: false, reason: 'append requires a value' };
      }
      if (current !== undefined && !Array.isArray(current)) {
        return { ok: false, reason: `append expects an array at "${rawPath}"` };
      }
      const next = [...((current as Json[] | undefined) ?? []), params!.value];
      return writePath(state, path, next);
    }

    case 'remove': {
      // A numeric last segment splices an array element; anything else deletes
      // an object key. Both are "remove what this path names", which keeps the
      // operation unambiguous.
      return removePath(state, path);
    }
  }
}

type Segment = string;

// Dot-separated, and deliberately strict: no bracket syntax, no empty segments,
// and no `__proto__`/`constructor`/`prototype`, which would let a card's params
// reach outside its own state.
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function parsePath(raw: string): Segment[] | null {
  const segments = raw.split('.');
  if (segments.some((segment) => segment === '')) {
    return null;
  }
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
    return null;
  }
  return segments;
}

function isIndex(segment: Segment): boolean {
  return /^\d+$/.test(segment);
}

function readPath(state: JsonObject, path: Segment[]): Json | undefined {
  let node: Json | undefined = state;
  for (const segment of path) {
    if (node === null || node === undefined) {
      return undefined;
    }
    if (Array.isArray(node)) {
      if (!isIndex(segment)) {
        return undefined;
      }
      node = node[Number(segment)];
      continue;
    }
    if (typeof node !== 'object') {
      return undefined;
    }
    node = (node as JsonObject)[segment];
  }
  return node;
}

/**
 * Return a copy of `state` with `value` at `path`.
 *
 * Copies only the containers along the path — everything else is shared, which
 * is safe because nothing here mutates.
 */
function writePath(
  state: JsonObject,
  path: Segment[],
  value: Json
): StateOpResult {
  const set = (node: Json | undefined, depth: number): StateOpResult => {
    const segment = path[depth];
    const last = depth === path.length - 1;

    if (isIndex(segment)) {
      const index = Number(segment);
      if (node !== undefined && !Array.isArray(node)) {
        return {
          ok: false,
          reason: `expected an array at segment "${segment}"`,
        };
      }
      const arr = [...((node as Json[] | undefined) ?? [])];
      // Appending at the end is fine; writing past it would leave holes.
      if (index > arr.length) {
        return { ok: false, reason: `index ${index} is past the end` };
      }
      if (last) {
        arr[index] = value;
        return { ok: true, state: arr as unknown as JsonObject };
      }
      const child = set(arr[index], depth + 1);
      if (!child.ok) {
        return child;
      }
      arr[index] = child.state as unknown as Json;
      return { ok: true, state: arr as unknown as JsonObject };
    }

    if (
      node !== undefined &&
      (typeof node !== 'object' || Array.isArray(node))
    ) {
      return {
        ok: false,
        reason: `expected an object at segment "${segment}"`,
      };
    }
    const obj: JsonObject = { ...((node as JsonObject | undefined) ?? {}) };
    if (last) {
      obj[segment] = value;
      return { ok: true, state: obj };
    }
    const child = set(obj[segment], depth + 1);
    if (!child.ok) {
      return child;
    }
    obj[segment] = child.state as unknown as Json;
    return { ok: true, state: obj };
  };

  return set(state, 0);
}

function removePath(state: JsonObject, path: Segment[]): StateOpResult {
  const drop = (node: Json | undefined, depth: number): StateOpResult => {
    const segment = path[depth];
    const last = depth === path.length - 1;

    if (isIndex(segment)) {
      if (!Array.isArray(node)) {
        return {
          ok: false,
          reason: `expected an array at segment "${segment}"`,
        };
      }
      const arr = [...node];
      const index = Number(segment);
      if (index >= arr.length) {
        return { ok: false, reason: `index ${index} is out of range` };
      }
      if (last) {
        arr.splice(index, 1);
        return { ok: true, state: arr as unknown as JsonObject };
      }
      const child = drop(arr[index], depth + 1);
      if (!child.ok) {
        return child;
      }
      arr[index] = child.state as unknown as Json;
      return { ok: true, state: arr as unknown as JsonObject };
    }

    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return {
        ok: false,
        reason: `expected an object at segment "${segment}"`,
      };
    }
    const obj: JsonObject = { ...(node as JsonObject) };
    if (last) {
      if (!(segment in obj)) {
        return { ok: false, reason: `nothing at "${segment}" to remove` };
      }
      delete obj[segment];
      return { ok: true, state: obj };
    }
    const child = drop(obj[segment], depth + 1);
    if (!child.ok) {
      return child;
    }
    obj[segment] = child.state as unknown as Json;
    return { ok: true, state: obj };
  };

  return drop(state, 0);
}
