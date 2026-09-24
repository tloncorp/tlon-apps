import { type Mock, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  poke,
  request,
  requestJson,
  scry,
  scryNoun,
  subscribe,
  subscribeOnce,
  thread,
  trackedPoke,
} from '../urbit';
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
  subscribeRequest,
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
    await subscribeOnceRequest(groups.gangPreview)({ groupId: '~zod/g' });
    await subscribeOnceRequest(groups.gangIndex)({ ship: '~zod' }, 30_000);
    await subscribeOnceRequest(groups.gangPreview)(
      { groupId: '~zod/g' },
      undefined,
      undefined,
      { tag: 't' }
    );
    expect(calls(subscribeOnce)).toEqual([
      [{ app: 'groups', path: '/gangs/~zod/g/preview' }],
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

describe('http and noun transports', () => {
  test('requestJson gets the arity the caller supplied', async () => {
    const flag = { host: '~zod', name: 'nb' };
    const options = { reauthStatuses: [401, 403] };
    await httpRequest(notes.notebooksGet)({});
    await httpRequest(notes.notebooksPost)({}, { body: { title: 't' } });
    await httpRequest(notes.notesGet)(flag, { body: undefined, options });
    await httpRequest(notes.root)({}, { body: { a: 1 }, options });
    expect(calls(requestJson)).toEqual([
      ['/notes/~/v1/notebooks', 'GET'],
      ['/notes/~/v1/notebooks', 'POST', { title: 't' }],
      ['/notes/~/v1/notebooks/~zod/nb/notes', 'GET', undefined, options],
      ['/notes/~/v1', 'POST', { a: 1 }, options],
    ]);
    expect(calls(requestJson).map((c) => c.length)).toEqual([2, 3, 4, 4]);
  });

  test('query parameters are encoded, ordered as declared, and optional', async () => {
    const flag = { host: '~zod', name: 'nb' };
    await httpRequest(notes.search)(flag, {
      query: { tries: 3, needle: 'a b.c&d' },
    });
    await httpRequest(notes.search)(flag, { query: { needle: 'x', from: 7 } });
    await httpRequest(notes.folderDelete)(
      { ...flag, folderId: 4 },
      { query: { recursive: false } }
    );
    expect(calls(requestJson)).toEqual([
      [
        '/notes/~/v1/notebooks/~zod/nb/search/bounded/text?needle=a%20b.c%26d&tries=3',
        'GET',
      ],
      [
        '/notes/~/v1/notebooks/~zod/nb/search/bounded/text?needle=x&from=7',
        'GET',
      ],
      ['/notes/~/v1/notebooks/~zod/nb/folders/4?recursive=false', 'DELETE'],
    ]);
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

  test('rawRequest sends the entry method whatever the init says', async () => {
    await rawRequest(base.metagrab)({ url: 'u' }, {
      method: 'PUT',
      mode: 'cors',
    } as never);
    // a non-raw entry forced through by a cast still sends its own method
    await rawRequest(notes.noteDelete as never)(
      { host: '~zod', name: 'nb', id: 1 } as never,
      { method: 'PUT' } as never
    );
    expect(calls(request)).toEqual([
      ['/apps/groups/~/metagrab/u', { mode: 'cors', method: 'GET' }],
      ['/notes/~/v1/notebooks/~zod/nb/notes/1', { method: 'DELETE' }],
    ]);
  });

  test('rawRequest and scryNounRequest', async () => {
    await rawRequest(base.metagrab)({ url: '0wabc' }, { mode: 'cors' }, 10_000);
    await scryNounRequest(lanyard.records)({});
    expect(calls(request)).toEqual([
      [
        '/apps/groups/~/metagrab/0wabc',
        { mode: 'cors', method: 'GET' },
        10_000,
      ],
    ]);
    expect(calls(scryNoun)).toEqual([
      [{ app: 'lanyard', path: '/v1/records' }],
    ]);
  });
});

describe('hole values cannot reroute the request', () => {
  test('a plain hole rejects /, dot segments, ?, # and \\', () => {
    const bad = ['a/b', '..', '.', '%2E%2e', 'x?y=1', 'x#y', 'a\\b'];
    for (const count of bad) {
      expect(() => scryRequest(steward.lensRecentN)({ count })).toThrow(
        /^steward\.lensRecentN: path parameter count /
      );
    }
    expect(() =>
      scryRequest(steward.lensRecentN)({ count: '../../automation/tasks' })
    ).toThrow('steward.lensRecentN: path parameter count contains / but');
    expect(() =>
      rawRequest(base.metagrab)({
        url: '../../../../steward/~/v1/automation/tasks',
      })
    ).toThrow('base.metagrab: path parameter url contains / but');
    expect(calls(scry)).toEqual([]);
    expect(calls(request)).toEqual([]);
  });

  test('a composite hole allows / but not dot segments, ? or #', async () => {
    await scryRequest(channels.post)({ nest: 'chat/~zod/c', id: 1 });
    expect(calls(scry)).toEqual([
      [{ app: 'channels', path: '/v5/chat/~zod/c/posts/post/1' }],
    ]);
    for (const nest of [
      'chat/../../x',
      'chat/~zod/.',
      'chat/~zod/c?x',
      'c#x',
    ]) {
      expect(() => scryRequest(channels.post)({ nest, id: 1 })).toThrow(
        /^channels\.post: path parameter nest /
      );
    }
  });

  test('control characters are rejected, so tabs cannot hide dot segments', () => {
    const nest = '~zod/' + '.\t./'.repeat(5) + 'steward/v1/automation/tasks';
    expect(() => scryRequest(channels.post)({ nest, id: 1 })).toThrow(
      'channels.post: path parameter nest contains a control character'
    );
    for (const count of ['1\n', '\r1', '1\u0000', '1\u007f']) {
      expect(() => scryRequest(steward.lensRecentN)({ count })).toThrow(
        'steward.lensRecentN: path parameter count contains a control character'
      );
    }
    expect(calls(scry)).toEqual([]);
  });

  test('dots inside a segment are ordinary text (@da, @ud)', async () => {
    const after = '~2026.9.24..16.26.49..370a.3d70.a3d7.0a3d';
    await scryRequest(channels.postsChanges)({
      nest: 'chat/~zod/c',
      start: '1.234',
      end: '2.345',
      after,
    });
    expect(calls(scry)).toEqual([
      [
        {
          app: 'channels',
          path: `/v4/chat/~zod/c/posts/changes/1.234/2.345/${after}`,
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
  subscribeOnceRequest(groups.gangIndex)<G>({ ship: '~zod' });
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
