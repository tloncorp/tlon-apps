import type { Noun } from '@urbit/nockjs';

import {
  DeskUnsupportedError,
  getDeskSupportsBuckets,
  poke,
  pokeNoun,
  request,
  requestJson,
  scry,
  scryNoun,
  subscribe,
  subscribeOnce,
  thread,
  trackedPoke,
  trackedPokeNoun,
} from '../urbit';
import { activity } from './activity';
import { base } from './base';
import { buckets } from './buckets';
import { channels } from './channels';
import { chat } from './chat';
import { contacts } from './contacts';
import { groups } from './groups';
import { groupsUi } from './groups-ui';
import { lanyard } from './lanyard';
import { notes } from './notes';
import { presence } from './presence';
import { reel } from './reel';
import type { PayloadOf } from './payloads';
import { steward } from './steward';
import {
  GUARDS,
  type GuardName,
  type HttpEntry,
  type HttpInitArgs,
  type One,
  type Params,
  type RawEntry,
} from './types';

export type * from './payloads';
export type * from './types';
export {
  activity,
  base,
  buckets,
  channels,
  chat,
  contacts,
  groups,
  groupsUi,
  lanyard,
  notes,
  presence,
  reel,
  steward,
};

// Every request the client makes of a desk. The registry check enumerates
// this object; the helpers below accept only its members.
export const REGISTRY = {
  groups,
  groupsUi,
  channels,
  chat,
  activity,
  contacts,
  lanyard,
  notes,
  presence,
  steward,
  reel,
  base,
  buckets,
} as const;

type Values<T> = T[keyof T];
export type RegistryEntry = Values<{
  [A in keyof typeof REGISTRY]: Values<(typeof REGISTRY)[A]>;
}>;
type ScryReg = Extract<RegistryEntry, { kind: 'scry' }>;
type SubscribeReg = Extract<RegistryEntry, { kind: 'subscribe' }>;
type PokeReg = Extract<RegistryEntry, { kind: 'poke' }>;
type ThreadReg = Extract<RegistryEntry, { kind: 'thread' }>;
type HttpReg = Extract<RegistryEntry, { kind: 'http' }>;
type RawReg = Extract<RegistryEntry, { kind: 'raw' }>;

const HOLE = /\{([^}]+)\}/g;

let entryNames: Map<unknown, string> | undefined;
function nameOf(entry: { agent: string; path?: string }) {
  entryNames ??= new Map(
    Object.entries(REGISTRY).flatMap(([group, entries]) =>
      Object.entries(entries).map(([key, e]) => [e, `${group}.${key}`])
    )
  );
  return entryNames.get(entry) ?? `${entry.agent} ${entry.path ?? ''}`;
}

// Read at call time, not when this module loads: a helper can be bound
// before the capability is known, and tests mock '../urbit' partially.
const GUARD_FNS: Record<GuardName, () => boolean> = {
  deskSupportsBuckets: () => getDeskSupportsBuckets(),
};

// Refuses a guarded request before anything is sent. Throws synchronously,
// as fillPath does.
export function assertGuard(entry: {
  agent: string;
  path?: string;
  guardedBy?: GuardName;
}) {
  const guard = entry.guardedBy;
  if (guard && !GUARD_FNS[guard]()) {
    throw new DeskUnsupportedError(nameOf(entry), GUARDS[guard].since, guard);
  }
}

const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;

// A value that adds delimiters or dot segments would route the request
// somewhere other than the declared path once the URL is parsed.
function holeProblem(value: string, composite: boolean) {
  if (/[?#\\]/.test(value)) {
    return 'contains ?, # or \\';
  }
  // The URL parser drops tab, CR and LF before it resolves dot segments.
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return 'contains a control character';
  }
  if (!composite && value.includes('/')) {
    return 'contains / but is not a composite hole';
  }
  if (value.split('/').some((segment) => DOT_SEGMENT.test(segment))) {
    return 'contains a . or .. segment';
  }
  return undefined;
}

function fillPath(
  entry: { agent: string; path: string },
  params: Record<string, string | number>
) {
  return entry.path.replace(HOLE, (_, hole: string) => {
    const composite = hole.endsWith('*');
    const name = composite ? hole.slice(0, -1) : hole;
    const value = params[name];
    if (value === undefined) {
      throw new Error(`${nameOf(entry)}: missing path parameter ${name}`);
    }
    const text = String(value);
    const problem = holeProblem(text, composite);
    if (problem) {
      throw new Error(`${nameOf(entry)}: path parameter ${name} ${problem}`);
    }
    return text;
  });
}

function withQuery(
  path: string,
  keys: readonly string[] | undefined,
  query: Record<string, QueryValue | undefined> | undefined
) {
  if (!keys || !query) {
    return path;
  }
  const parts = keys.flatMap((key) => {
    const name = key.replace(/\?$/, '');
    const value = query[name];
    return value === undefined
      ? []
      : [`${name}=${encodeURIComponent(String(value))}`];
  });
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

type QueryValue = string | number | boolean;

// Caller options never reach the request identity: only these fields are
// forwarded, and only when the caller set them, so the wrapper sees the
// same object a direct call would.
function timeoutOf(opts: { timeout?: number } | undefined) {
  return opts && 'timeout' in opts ? { timeout: opts.timeout } : {};
}

// The filled path of a scry or subscribe entry, for a client that sends the
// request through its own transport (the web app's api instance).
export function entryPath<E extends ScryReg | SubscribeReg>(
  entry: One<E>,
  params: Params<E['path']>
) {
  return fillPath(entry, params);
}

// Each helper is curried: the entry is inferred from the registry member in
// the outer call, the response type is given explicitly to the inner call
// (TypeScript cannot infer one type argument while taking another).

export function scryRequest<E extends ScryReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    opts?: { timeout?: number }
  ): Promise<T> => {
    assertGuard(entry);
    return scry<T>({
      app: entry.agent,
      path: fillPath(entry, params),
      ...timeoutOf(opts),
    });
  };
}

export function scryNounRequest<E extends ScryReg>(entry: One<E>) {
  return (
    params: Params<E['path']>,
    opts?: { timeout?: number }
  ): Promise<Noun> => {
    assertGuard(entry);
    return scryNoun({
      app: entry.agent,
      path: fillPath(entry, params),
      ...timeoutOf(opts),
    });
  };
}

export function subscribeRequest<E extends SubscribeReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    handler: (update: T, id?: number) => void
  ) => {
    assertGuard(entry);
    return subscribe<T>(
      { app: entry.agent, path: fillPath(entry, params) },
      handler
    );
  };
}

type SubscribeOnceRest = [
  timeout?: number,
  ship?: string,
  requestConfig?: { tag?: string },
];

export function subscribeOnceRequest<E extends SubscribeReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    ...rest: SubscribeOnceRest
  ): Promise<T> => {
    assertGuard(entry);
    return subscribeOnce<T>(
      { app: entry.agent, path: fillPath(entry, params) },
      ...rest
    );
  };
}

export function pokeRequest<E extends PokeReg>(entry: One<E>) {
  return (json: PayloadOf<E>) => {
    assertGuard(entry);
    return poke({ app: entry.agent, mark: entry.mark, json });
  };
}

export function pokeNounRequest<E extends PokeReg>(entry: One<E>) {
  return (noun: Noun) => {
    assertGuard(entry);
    return pokeNoun({ app: entry.agent, mark: entry.mark, noun });
  };
}

// T mirrors trackedPoke's own first type argument, which only defaults R.
export function trackedPokeRequest<E extends PokeReg, S extends SubscribeReg>(
  entry: One<E>,
  watch: One<S>
) {
  return <T = unknown, R = T>(
    json: PayloadOf<E>,
    watchParams: Params<S['path']>,
    predicate: (event: R) => boolean,
    ...config: [requestConfig?: { tag?: string; timeout?: number }]
  ) => {
    assertGuard(entry);
    assertGuard(watch);
    return trackedPoke<T, R>(
      { app: entry.agent, mark: entry.mark, json },
      { app: watch.agent, path: fillPath(watch, watchParams) },
      predicate,
      ...config
    );
  };
}

export function trackedPokeNounRequest<
  E extends PokeReg,
  S extends SubscribeReg,
>(entry: One<E>, watch: One<S>) {
  return <T = unknown, R = T>(
    noun: Noun,
    watchParams: Params<S['path']>,
    predicate: (event: R) => boolean,
    ...config: [requestConfig?: { tag: string; timeout?: number }]
  ) => {
    assertGuard(entry);
    assertGuard(watch);
    return trackedPokeNoun<T, R>(
      { app: entry.agent, mark: entry.mark, noun },
      { app: watch.agent, path: fillPath(watch, watchParams) },
      predicate,
      ...config
    );
  };
}

export function threadRequest<E extends ThreadReg>(entry: One<E>) {
  return <T, R = any>(body: T, opts?: { timeout?: number }): Promise<R> => {
    assertGuard(entry);
    return thread<T, R>({
      desk: entry.agent,
      inputMark: entry.inputMark,
      threadName: entry.name,
      outputMark: entry.outputMark,
      body,
      ...timeoutOf(opts),
    });
  };
}

// Forwards only the arguments given, so requestJson sees the same arity a
// direct call would.
export function httpRequest<E extends HttpReg>(entry: One<E>) {
  return <T = any>(
    params: Params<E['path']>,
    ...[init = {}]: HttpInitArgs<E>
  ): Promise<T> => {
    assertGuard(entry);
    const { method, query: keys } = entry as HttpEntry;
    const { body, options } = init;
    const query = 'query' in init ? init.query : undefined;
    const path = withQuery(fillPath(entry, params), keys, query);
    if (options) {
      return requestJson<T>(path, method, body, options);
    }
    if ('body' in init) {
      return requestJson<T>(path, method, body);
    }
    return requestJson<T>(path, method);
  };
}

// The plain `request` transport, for routes declared `kind: 'raw'`. The
// method is the entry's; the caller supplies the rest of the fetch init.
export function rawRequest<E extends RawReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    init: Omit<RequestInit, 'method'> = {},
    ...timeout: [timeout?: number]
  ): Promise<T> => {
    assertGuard(entry);
    const { method } = entry as RawEntry;
    return request<T>(
      fillPath(entry, params),
      { ...init, method },
      ...timeout
    ) as Promise<T>;
  };
}
