import type { Noun } from '@urbit/nockjs';

import {
  type RequestJsonOptions,
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
import { groups } from './groups';
import { groupsUi } from './groups-ui';
import type { HttpEntry, One, Params, QueryParams } from './types';

export type * from './types';
export { groups, groupsUi };

// Every request the client makes of a desk. The registry check enumerates
// this object; the helpers below accept only its members.
export const REGISTRY = {
  groups,
  groupsUi,
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

const HOLE = /\{([^}]+)\}/g;

function fillPath(path: string, params: Record<string, string | number>) {
  return path.replace(HOLE, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`missing path parameter ${name} for ${path}`);
    }
    return String(value);
  });
}

function withQuery(
  path: string,
  names: readonly string[] | undefined,
  query: Record<string, string | number | boolean | undefined> | undefined
) {
  if (!names || !query) {
    return path;
  }
  const parts = names.flatMap((name) =>
    query[name] === undefined
      ? []
      : [`${name}=${encodeURIComponent(String(query[name]))}`]
  );
  return parts.length ? `${path}?${parts.join('&')}` : path;
}

// Each helper is curried: the entry is inferred from the registry member in
// the outer call, the response type is given explicitly to the inner call
// (TypeScript cannot infer one type argument while taking another).

export function scryRequest<E extends ScryReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    opts?: { timeout?: number }
  ): Promise<T> =>
    scry<T>({ app: entry.agent, path: fillPath(entry.path, params), ...opts });
}

export function scryNounRequest<E extends ScryReg>(entry: One<E>) {
  return (
    params: Params<E['path']>,
    opts?: { timeout?: number }
  ): Promise<Noun> =>
    scryNoun({
      app: entry.agent,
      path: fillPath(entry.path, params),
      ...opts,
    });
}

export function subscribeRequest<E extends SubscribeReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    handler: (update: T, id?: number) => void
  ) =>
    subscribe<T>(
      { app: entry.agent, path: fillPath(entry.path, params) },
      handler
    );
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
  ): Promise<T> =>
    subscribeOnce<T>(
      { app: entry.agent, path: fillPath(entry.path, params) },
      ...rest
    );
}

export function pokeRequest<E extends PokeReg>(entry: One<E>) {
  return (json: unknown) => poke({ app: entry.agent, mark: entry.mark, json });
}

export function pokeNounRequest<E extends PokeReg>(entry: One<E>) {
  return (noun: Noun) => pokeNoun({ app: entry.agent, mark: entry.mark, noun });
}

// T mirrors trackedPoke's own first type argument, which only defaults R.
export function trackedPokeRequest<E extends PokeReg, S extends SubscribeReg>(
  entry: One<E>,
  watch: One<S>
) {
  return <T = unknown, R = T>(
    json: unknown,
    watchParams: Params<S['path']>,
    predicate: (event: R) => boolean,
    ...config: [requestConfig?: { tag?: string; timeout?: number }]
  ) =>
    trackedPoke<T, R>(
      { app: entry.agent, mark: entry.mark, json },
      { app: watch.agent, path: fillPath(watch.path, watchParams) },
      predicate,
      ...config
    );
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
  ) =>
    trackedPokeNoun<T, R>(
      { app: entry.agent, mark: entry.mark, noun },
      { app: watch.agent, path: fillPath(watch.path, watchParams) },
      predicate,
      ...config
    );
}

export function threadRequest<E extends ThreadReg>(entry: One<E>) {
  return <T, R = any>(body: T, opts?: { timeout?: number }): Promise<R> =>
    thread<T, R>({
      desk: entry.agent,
      inputMark: entry.inputMark,
      threadName: entry.name,
      outputMark: entry.outputMark,
      body,
      ...opts,
    });
}

export interface HttpInit<E> {
  query?: QueryParams<E>;
  body?: unknown;
  options?: RequestJsonOptions;
}

// Forwards only the arguments given, so requestJson sees the same arity a
// direct call would.
export function httpRequest<E extends HttpReg>(entry: One<E>) {
  return <T = any>(
    params: Params<E['path']>,
    init: HttpInit<E> = {}
  ): Promise<T> => {
    const e = entry as unknown as HttpEntry;
    const path = withQuery(fillPath(e.path, params), e.query, init.query);
    if (init.options) {
      return requestJson<T>(path, e.method, init.body, init.options);
    }
    if ('body' in init) {
      return requestJson<T>(path, e.method, init.body);
    }
    return requestJson<T>(path, e.method);
  };
}

// The unauthenticated-JSON transport (`request`), for routes that are not
// eyre JSON endpoints of an agent.
export function rawRequest<E extends HttpReg>(entry: One<E>) {
  return <T = unknown>(
    params: Params<E['path']>,
    ...rest: [options?: RequestInit, timeout?: number]
  ): Promise<T> =>
    request<T>(
      fillPath((entry as unknown as HttpEntry).path, params),
      ...rest
    ) as Promise<T>;
}
