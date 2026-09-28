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

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Eyre routes. `agent` names the agent that binds the route; routing itself
// ignores it, which is why the check refuses a desk label on these kinds.
// Query keys are listed in send order; a trailing `?` marks one optional.
// Holes stay path segments.
export interface HttpEntry extends BaseEntry {
  readonly kind: 'http';
  readonly method: HttpMethod;
  readonly path: string;
  readonly query?: readonly string[];
}

// A route fetched with the plain `request` transport rather than the
// JSON-with-reauth one (`requestJson`).
export interface RawEntry extends BaseEntry {
  readonly kind: 'raw';
  readonly method: HttpMethod;
  readonly path: string;
}

export type Entry =
  | ScryEntry
  | SubscribeEntry
  | PokeEntry
  | ThreadEntry
  | HttpEntry
  | RawEntry;

type HoleName<K extends string> = K extends `${infer N}*` ? N : K;
type HoleNames<P extends string> = P extends `${string}{${infer K}}${infer R}`
  ? HoleName<K> | HoleNames<R>
  : never;

// Holes are `{name}` path segments. `{name*}` is a composite hole whose value
// spans several segments (a nest kind/host/name, a flag host/name); any other
// hole's value may not contain `/`. A path without holes takes `{}` and
// nothing else.
export type Params<P extends string> = [HoleNames<P>] extends [never]
  ? Record<string, never>
  : { [K in HoleNames<P>]: string | number };

type QueryKeys<E> = E extends {
  readonly query: readonly (infer K extends string)[];
}
  ? K
  : never;
type RequiredKey<K> = K extends `${string}?` ? never : K;
type OptionalKey<K> = K extends `${infer N}?` ? N : never;
type QueryValue = string | number | boolean;

export type QueryParams<E> = {
  [Q in RequiredKey<QueryKeys<E>>]: QueryValue;
} & { [Q in OptionalKey<QueryKeys<E>>]?: QueryValue };

interface HttpInitBase {
  body?: unknown;
  options?: import('../urbit').RequestJsonOptions;
}

// The init argument is required, with its query, when the route declares a
// required query key, and takes no query when it declares none.
export type HttpInitArgs<E> = [QueryKeys<E>] extends [never]
  ? [init?: HttpInitBase]
  : [RequiredKey<QueryKeys<E>>] extends [never]
    ? [init?: HttpInitBase & { query?: QueryParams<E> }]
    : [init: HttpInitBase & { query: QueryParams<E> }];

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

// A widened entry type (a union of entries, e.g. a conditional expression or a
// cast to the kind) is never a single declared entry.
export type One<E> = true extends IsUnion<E> ? never : E;
