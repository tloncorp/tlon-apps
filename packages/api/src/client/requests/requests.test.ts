import { type Mock, beforeEach, expect, test, vi } from 'vitest';

import { poke, request, requestJson, scry, scryNoun, thread } from '../urbit';
import {
  base,
  channels,
  groups,
  httpRequest,
  lanyard,
  notes,
  pokeRequest,
  rawRequest,
  scryNounRequest,
  scryRequest,
  steward,
  subscribeOnceRequest,
  threadRequest,
  trackedPokeRequest,
} from './index';

vi.mock('../urbit', async () => {
  const actual = await vi.importActual<typeof import('../urbit')>('../urbit');
  return {
    ...actual,
    poke: vi.fn(),
    request: vi.fn(),
    requestJson: vi.fn(),
    scry: vi.fn(),
    scryNoun: vi.fn(),
    thread: vi.fn(),
  };
});

const calls = (fn: unknown) => (fn as Mock).mock.calls;

beforeEach(() => {
  vi.clearAllMocks();
});

test('caller options cannot change the declared request', async () => {
  const hostile = {
    timeout: 5,
    app: 'steward',
    path: '/v1/automation/tasks',
    desk: 'x',
    threadName: 'x',
    inputMark: 'x',
    outputMark: 'x',
    body: 'x',
  } as never;
  await scryRequest(groups.groups)({}, hostile);
  await scryNounRequest(lanyard.records)({}, hostile);
  await threadRequest(groups.create)({ b: 1 }, hostile);
  expect(calls(scry)).toEqual([
    [{ app: 'groups', path: '/v3/groups', timeout: 5 }],
  ]);
  expect(calls(scryNoun)).toEqual([
    [{ app: 'lanyard', path: '/v1/records', timeout: 5 }],
  ]);
  expect(calls(thread)).toEqual([
    [
      {
        desk: 'groups',
        inputMark: 'group-create-thread',
        threadName: 'group-create-1',
        outputMark: 'group-ui-2',
        body: { b: 1 },
        timeout: 5,
      },
    ],
  ]);
});

test('a typed poke sends its payload unchanged', async () => {
  await pokeRequest(groups.join)({ flag: '~zod/g', 'join-all': true });
  expect(calls(poke)).toEqual([
    [
      {
        app: 'groups',
        mark: 'group-join',
        json: { flag: '~zod/g', 'join-all': true },
      },
    ],
  ]);
});

test('rawRequest sends the entry method whatever the init says', async () => {
  await rawRequest(base.metagrab)({ url: 'u' }, {
    method: 'PUT',
    mode: 'cors',
  } as never);
  expect(calls(request)).toEqual([
    ['/apps/groups/~/metagrab/u', { mode: 'cors', method: 'GET' }],
  ]);
});

test('httpRequest encodes the query and forwards method, body and options', async () => {
  const options = { reauthStatuses: [401] };
  const flag = { host: '~zod', name: 'nb' };
  await httpRequest(notes.search)(flag, {
    query: { tries: 3, needle: 'a b&c' },
    body: { x: 1 },
    options,
  });
  expect(calls(requestJson)).toEqual([
    [
      '/notes/~/v1/notebooks/~zod/nb/search/bounded/text?needle=a%20b%26c&tries=3',
      'GET',
      { x: 1 },
      options,
    ],
  ]);
});

test.each(['x?y', 'x#y', 'x\\y', '%2e%2E'])('a hole rejects %j', (count) => {
  expect(() => scryRequest(steward.lensRecentN)({ count })).toThrow(
    /^steward\.lensRecentN: path parameter count /
  );
});

test('hole values cannot reroute the request', async () => {
  const count = (value: string) => () =>
    scryRequest(steward.lensRecentN)({ count: value });
  expect(count('../../automation/tasks')).toThrow(
    'steward.lensRecentN: path parameter count contains / but'
  );
  expect(count('..')).toThrow('contains a . or .. segment');
  expect(count('1\t')).toThrow('contains a control character');
  const nest = 'chat/~zod/c';
  const after = '~2026.9.24..16.26.49..370a.3d70.a3d7.0a3d';
  await scryRequest(channels.postsChanges)({ nest, start: 1, end: 2, after });
  expect(calls(scry)).toEqual([
    [{ app: 'channels', path: `/v4/${nest}/posts/changes/1/2/${after}` }],
  ]);
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
  subscribeOnceRequest(groups.gangIndex)<G>({ ship: '~zod' });
  trackedPokeRequest(groups.action, groups.updates)<{ flag: string }>(
    { leave: '~zod/g' },
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
  // a payload of the wrong shape for its mark
  // @ts-expect-error
  pokeRequest(groups.join)({ flag: '~zod/g' });
  // @ts-expect-error
  trackedPokeRequest(groups.action, groups.updates)({}, {}, pred);
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

  const nb = { host: '~zod', name: 'nb' };
  // compiles
  httpRequest(notes.search)(nb, { query: { needle: 'x', tries: 1 } });
  httpRequest(notes.folderDelete)(
    { ...nb, folderId: 1 },
    { query: { recursive: true } }
  );
  httpRequest(notes.notesGet)(nb);
  rawRequest(base.metagrab)({ url: 'u' }, { mode: 'cors' }, 10_000);
  // a required query key is missing, or the whole init is
  // @ts-expect-error
  httpRequest(notes.search)(nb);
  // @ts-expect-error
  httpRequest(notes.search)(nb, { query: { from: 1 } });
  // @ts-expect-error
  httpRequest(notes.folderDelete)({ ...nb, folderId: 1 });
  // rawRequest takes raw routes only, and never a method
  // @ts-expect-error
  rawRequest(notes.noteDelete);
  // @ts-expect-error
  rawRequest(base.metagrab)({ url: 'u' }, { method: 'PUT' });
  // httpRequest takes no raw route
  // @ts-expect-error
  httpRequest(base.metagrab);
  // misnamed query key
  // @ts-expect-error
  httpRequest(notes.search)(nb, { query: { text: 'x' } });
  // query on a route that declares none
  // @ts-expect-error
  httpRequest(notes.notesGet)(nb, { query: { needle: 'x' } });
  // an http route is not a scry
  // @ts-expect-error
  scryRequest(notes.notesGet);
  // missing hole on an http route
  // @ts-expect-error
  httpRequest(notes.noteGet)(nb);
}
