import { type Mock, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  poke,
  scry,
  subscribe,
  subscribeOnce,
  thread,
  trackedPoke,
} from '../urbit';
import {
  groups,
  pokeRequest,
  scryRequest,
  subscribeOnceRequest,
  subscribeRequest,
  threadRequest,
  trackedPokeRequest,
} from './index';

vi.mock('../urbit', async () => {
  const actual = await vi.importActual<typeof import('../urbit')>('../urbit');
  return {
    ...actual,
    poke: vi.fn(),
    scry: vi.fn(),
    subscribe: vi.fn(),
    subscribeOnce: vi.fn(),
    thread: vi.fn(),
    trackedPoke: vi.fn(),
  };
});

const calls = (fn: unknown) => (fn as Mock).mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('helpers forward to the wrappers unchanged', () => {
  test('scry fills composite holes verbatim and passes options through', async () => {
    await scryRequest(groups.uiGroup)({ groupId: '~zod/g' });
    await scryRequest(groups.groups)({}, { timeout: 5 });
    expect(calls(scry)).toEqual([
      [{ app: 'groups', path: '/v3/ui/groups/~zod/g' }],
      [{ app: 'groups', path: '/v3/groups', timeout: 5 }],
    ]);
  });

  test('subscribeOnce keeps the positional arity of the call', async () => {
    await subscribeOnceRequest(groups.chanPreview)({ channelId: 'c' });
    await subscribeOnceRequest(groups.gangIndex)({ ship: '~zod' }, 30_000);
    await subscribeOnceRequest(groups.gangPreview)(
      { groupId: '~zod/g' },
      undefined,
      undefined,
      { tag: 't' }
    );
    expect(calls(subscribeOnce)).toEqual([
      [{ app: 'groups', path: '/chan/c' }],
      [{ app: 'groups', path: '/gangs/index/~zod' }, 30_000],
      [
        { app: 'groups', path: '/gangs/~zod/g/preview' },
        undefined,
        undefined,
        { tag: 't' },
      ],
    ]);
  });

  test('subscribe, poke, trackedPoke and thread', async () => {
    const handler = () => {};
    const predicate = () => true;
    await subscribeRequest(groups.updates)({}, handler);
    await pokeRequest(groups.leave)('~zod/g');
    await trackedPokeRequest(groups.action, groups.updates)(
      { a: 1 },
      {},
      predicate
    );
    await trackedPokeRequest(groups.action, groups.updates)(
      { a: 2 },
      {},
      predicate,
      { tag: 't' }
    );
    await threadRequest(groups.create)({ b: 1 });
    expect(calls(subscribe)).toEqual([
      [{ app: 'groups', path: '/v3/groups' }, handler],
    ]);
    expect(calls(poke)).toEqual([
      [{ app: 'groups', mark: 'group-leave', json: '~zod/g' }],
    ]);
    expect(calls(trackedPoke)).toEqual([
      [
        { app: 'groups', mark: 'group-action-5', json: { a: 1 } },
        { app: 'groups', path: '/v3/groups' },
        predicate,
      ],
      [
        { app: 'groups', mark: 'group-action-5', json: { a: 2 } },
        { app: 'groups', path: '/v3/groups' },
        predicate,
        { tag: 't' },
      ],
    ]);
    expect(calls(thread)).toEqual([
      [
        {
          desk: 'groups',
          inputMark: 'group-create-thread',
          threadName: 'group-create-1',
          outputMark: 'group-ui-2',
          body: { b: 1 },
        },
      ],
    ]);
  });
});

// Compile-time probes, checked by `tsc --noEmit` (CI: `pnpm -r tsc`). Each
// `@ts-expect-error` line is a one-fault variant of a line that compiles; an
// unused directive fails the build (TS2578). Never called.
export function typeProbes(flag: boolean) {
  type G = { title: string };
  type Either = typeof groups.uiGroup | typeof groups.groups;
  const ui = groups.uiGroup;
  const pred = (ev: { flag: string }) => ev.flag === 'x';

  // compiles
  scryRequest(ui)<G>({ groupId: '~zod/g' });
  scryRequest(ui)<G>({ groupId: 1 }, { timeout: 5 });
  scryRequest(groups.groups)<G>({});
  subscribeOnceRequest(groups.chanPreview)<G>({ channelId: 'c' });
  trackedPokeRequest(groups.action, groups.updates)<{ flag: string }>(
    {},
    {},
    pred,
    { tag: 't' }
  );
  threadRequest(groups.create)<{ a: 1 }, G>({ a: 1 });
  // a guarded choice is two separately bound calls
  void (flag
    ? scryRequest(ui)<G>({ groupId: 'x' })
    : scryRequest(groups.groups)<G>({}));

  // missing hole
  // @ts-expect-error
  scryRequest(ui)<G>({});
  // misnamed hole
  // @ts-expect-error
  scryRequest(ui)<G>({ flag: 'x' });
  // extra key on a path without holes
  // @ts-expect-error
  scryRequest(groups.groups)<G>({ extra: 1 });
  // missing hole on a subscription
  // @ts-expect-error
  subscribeOnceRequest(groups.gangPreview)({});
  // ad-hoc entry literal
  // @ts-expect-error
  scryRequest({ kind: 'scry', agent: 'x', path: '/n', since: '12.2.0' });
  const adHoc = {
    kind: 'scry',
    agent: 'groups',
    path: '/v99/new',
    since: '99.0.0',
  } as const;
  // ad-hoc entry through a variable
  // @ts-expect-error
  scryRequest(adHoc);
  // wrong kind
  // @ts-expect-error
  scryRequest(groups.action);
  // @ts-expect-error
  pokeRequest(groups.updates);
  // @ts-expect-error
  threadRequest(groups.action);
  // a scry is not a watch lane
  // @ts-expect-error
  trackedPokeRequest(groups.action, groups.groups);
  // widened entry type, explicit
  // @ts-expect-error
  scryRequest<Either>(ui);
  // widened entry type, by cast
  // @ts-expect-error
  scryRequest(ui as Either);
  // union-typed entry expression
  // @ts-expect-error
  scryRequest(flag ? ui : groups.groups);
  // a widened E cannot admit a missing hole
  // @ts-expect-error
  scryRequest<Either>(groups.groups)<G>({});
}
