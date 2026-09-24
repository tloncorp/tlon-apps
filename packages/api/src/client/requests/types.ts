// Shape only: `${number}` admits '1e0'. The registry check re-validates every
// `since` strictly.
export type DeskVersion = `${number}.${number}.${number}`;

// Desks other than %groups that host an agent the client talks to. Only the
// registry check decides whether a label is honest (it owns the agent map).
export type ExternalDesk = 'base' | 'landscape';

interface BaseEntry {
  readonly agent: string;
  // Oldest %groups desk release that serves this request.
  readonly since: DeskVersion;
  readonly desk?: ExternalDesk;
}

export interface ScryEntry extends BaseEntry {
  readonly kind: 'scry';
  readonly path: string;
}

export interface SubscribeEntry extends BaseEntry {
  readonly kind: 'subscribe';
  readonly path: string;
}

export interface PokeEntry extends BaseEntry {
  readonly kind: 'poke';
  readonly mark: string;
}

// `agent` is the desk the thread runs from.
export interface ThreadEntry extends BaseEntry {
  readonly kind: 'thread';
  readonly name: string;
  readonly inputMark: string;
  readonly outputMark: string;
}

// Raw eyre routes. `agent` names the agent that binds the route; routing
// itself ignores it, which is why the check refuses a desk label here.
export interface HttpEntry extends BaseEntry {
  readonly kind: 'http';
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly query?: readonly string[];
}

export type Entry =
  | ScryEntry
  | SubscribeEntry
  | PokeEntry
  | ThreadEntry
  | HttpEntry;

type HoleNames<P extends string> = P extends `${string}{${infer K}}${infer R}`
  ? K | HoleNames<R>
  : never;

// Holes are `{name}` path segments. A path without holes takes `{}` and
// nothing else.
export type Params<P extends string> = [HoleNames<P>] extends [never]
  ? Record<string, never>
  : { [K in HoleNames<P>]: string | number };

export type QueryParams<E> = E extends {
  readonly query: readonly (infer K extends string)[];
}
  ? { [Q in K]?: string | number | boolean }
  : never;

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

// A widened entry type (a union of entries, e.g. a conditional expression or a
// cast to the kind) is never a single declared entry.
export type One<E> = true extends IsUnion<E> ? never : E;
