import * as api from '@tloncorp/api';
import type * as ub from '@tloncorp/api/urbit';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({ getSystemContacts: vi.fn() }));
vi.mock('./systemContactsApi', () => ({
  getSystemContacts: native.getSystemContacts,
}));

import * as db from '../db';
import { resetDb, setupDatabaseTestSuite } from '../test/helpers';
import { createDeferred } from '../utils/deferred';
import {
  addContacts,
  addContact,
  removeContact,
  removeContactSuggestion,
  updateContactMetadata,
} from './contactActions';
import {
  partitionDiscoveryMatches,
  setContactsMatchedHandler,
} from './lanyardActions';
import { updateInitializedClient } from './session';
import { syncContactDiscovery } from './sync/sync';
import { syncContacts } from './sync/syncContacts';

setupDatabaseTestSuite();
const id = '~nec';
const other = '~bud';
const phone = '+15555550123';
let matches: [string, string][];
let pages: Map<string, ub.ContactBookProfile>;
let directory: ub.ContactsDirectoryScryResult1;
let removed: Map<string, boolean>;
let declined: Set<string>;
let hidden: Set<string>;
let suggested: Set<string>;
const announce = vi.fn();

beforeEach(async () => {
  api.setDeskSupportsContactRemoval(true);
  api.setDeskSupportsContactDecisions(true);
  matches = [[phone, id]];
  pages = new Map();
  directory = {};
  removed = new Map();
  declined = new Set();
  hidden = new Set();
  suggested = new Set();
  announce.mockReset();
  setContactsMatchedHandler(announce);
  native.getSystemContacts.mockResolvedValue([
    {
      id: 'native',
      firstName: 'Address',
      lastName: 'Book',
      phoneNumber: phone,
    },
  ]);
  vi.spyOn(api, 'discoverContacts').mockImplementation(async () => ({
    matches,
    nextSalt: '0x1',
  }));
  vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
    {
      id: 'synthetic-proof',
      contactId: '~solfer-magfed',
      provider: 'test',
      type: 'phone',
      value: '+15555550000',
      discoverability: 'verified',
      status: 'verified',
      initiatedAt: null,
      statusMessage: null,
      providerUrl: null,
      provingTweetId: null,
      signature: null,
    },
  ]);
  vi.mocked(api.scry).mockImplementation(async ({ path }) => {
    if (path === '/v3/init' || path === '/v2/init')
      return {
        directory,
        book: Object.fromEntries(
          [...pages].map(([ship, overlay]) => [
            ship,
            [directory[ship]?.contact ?? {}, overlay],
          ])
        ),
        removed: [...removed.keys()],
        ...(path === '/v3/init' ? { declined: [...declined] } : {}),
      };
    if (path === '/suggested-contacts')
      return [...suggested].filter(
        (ship) => !hidden.has(ship) && !declined.has(ship)
      );
    if (path === '/hidden-contact-suggestions') return [...hidden];
    if (path === '/v1/directory') return directory;
    if (path === '/v1/book')
      return Object.fromEntries(
        [...pages].map(([ship, overlay]) => [ship, [{}, overlay]])
      );
    throw new Error(`Unexpected scry ${path}`);
  });
  vi.mocked(api.poke).mockImplementation(async ({ mark, json }) => {
    if (mark === 'contact-discover-1' || mark === 'contact-discover') {
      const action =
        mark === 'contact-discover-1'
          ? (json as { kip: string; nickname: string | null })
          : { kip: json as string, nickname: null };
      if (declined.has(action.kip)) return 1;
      if (removed.has(action.kip)) {
        if (!removed.get(action.kip)) {
          removed.set(action.kip, true);
          hidden.delete(action.kip);
          suggested.add(action.kip);
        }
        return 1;
      }
      if (
        pages.has(action.kip) ||
        hidden.has(action.kip) ||
        suggested.has(action.kip)
      )
        return 1;
      pages.set(
        action.kip,
        action.nickname
          ? { nickname: { type: 'text', value: action.nickname } }
          : {}
      );
      hidden.add(action.kip);
    } else if (mark === 'contact-decline-1') {
      pages.delete(json as string);
      declined.add(json as string);
      hidden.add(json as string);
    } else if (mark === 'contact-remove') {
      const action = json as { kip: string; suggest: boolean };
      pages.delete(action.kip);
      removed.set(action.kip, action.suggest);
      if (action.suggest) {
        hidden.delete(action.kip);
        suggested.add(action.kip);
      }
    } else if (mark === 'contact-action-1') {
      const action = json as {
        page?: { kip: string };
        edit?: { kip: string; contact: ub.ContactBookProfileEdit };
      };
      if (action.page) {
        pages.set(action.page.kip, {});
        removed.delete(action.page.kip);
        declined.delete(action.page.kip);
        hidden.add(action.page.kip);
      } else if (action.edit) {
        if (!pages.has(action.edit.kip)) throw new Error('No saved page');
        const overlay = pages.get(action.edit.kip)!;
        for (const [key, value] of Object.entries(action.edit.contact)) {
          if (value === null) delete overlay[key as keyof typeof overlay];
          else Object.assign(overlay, { [key]: value });
        }
      }
    } else if (mark === 'ui-hide-contact') hidden.add(json as string);
    else throw new Error(`Unexpected poke ${mark}`);
    return 1;
  });
  await db.insertSystemContacts({
    systemContacts: await native.getSystemContacts(),
  });
});

afterEach(() => {
  setContactsMatchedHandler(null);
  api.setDeskSupportsContactRemoval(null);
  api.setDeskSupportsContactDecisions(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const cachedFields = [
  ['peerNickname', 'Cached peer'],
  ['customNickname', 'Chosen name'],
  ['peerAvatarImage', 'https://example.test/peer.png'],
  ['customAvatarImage', 'https://example.test/custom.png'],
  ['coverImage', 'https://example.test/cover.png'],
  ['bio', 'Cached biography'],
  ['status', 'Cached status'],
] as const;

test.each(cachedFields)(
  'a cached %s alone remains eligible, is saved and announced once',
  async (field, value) => {
    await db.upsertContact({ id, [field]: value, isContact: false });
    expect(await syncContactDiscovery()).toMatchObject({
      didSucceed: true,
      newMatches: [[phone, id]],
    });
    expect(announce).toHaveBeenCalledWith([id]);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(await db.getContact({ id })).toMatchObject({
      isContact: true,
      [field]: value,
    });
    expect(pages.get(id)?.nickname?.value).toBe(
      field === 'customNickname' ? value : 'Address Book'
    );
    announce.mockClear();
    await db.clearContactsMatchedAt();
    expect((await syncContactDiscovery()).newMatches).toEqual([]);
    expect(announce).not.toHaveBeenCalled();
  }
);

test.each(['12.4-style', 'removal-only', 'unknown'] as const)(
  'the %s desk keeps conservative cached-profile suppression',
  async (desk) => {
    api.setDeskSupportsContactDecisions(desk === 'unknown' ? null : false);
    api.setDeskSupportsContactRemoval(desk === '12.4-style' ? false : true);
    await db.upsertContact({
      id,
      peerNickname: 'Cached peer',
      isContact: false,
    });
    expect(
      (await partitionDiscoveryMatches(matches, { isMocked: false })).newMatches
    ).toEqual([]);
    expect((await syncContactDiscovery()).newMatches).toEqual([]);
    expect(pages.has(id)).toBe(false);
    expect(announce).not.toHaveBeenCalled();
  }
);

test.each([
  'saved',
  'suggested',
  'removed',
  'declined',
  'historical hidden',
] as const)(
  '%s membership or intent blocks profile-only discovery',
  async (state) => {
    await db.upsertContact({
      id,
      peerNickname: 'Cached peer',
      isContact: false,
    });
    if (state === 'saved') pages.set(id, {});
    if (state === 'suggested') suggested.add(id);
    if (state === 'removed') removed.set(id, false);
    if (state === 'declined') declined.add(id);
    if (state === 'historical hidden') hidden.add(id);
    expect((await syncContactDiscovery()).newMatches).toEqual([]);
    expect(announce).not.toHaveBeenCalled();
    expect(pages.has(id)).toBe(state === 'saved');
    if (state === 'removed')
      expect(await db.getSuggestedContacts()).toEqual([
        expect.objectContaining({ id }),
      ]);
  }
);

test('a populated local name is promoted atomically and survives a web-style cache rebuild', async () => {
  await db.upsertContact({
    id,
    customNickname: 'Chosen locally',
    peerNickname: 'Peer name',
    isContact: false,
  });
  expect((await syncContactDiscovery()).newMatches).toEqual([[phone, id]]);
  expect(api.poke).toHaveBeenCalledWith({
    app: 'contacts',
    mark: 'contact-discover-1',
    json: { kip: id, nickname: 'Chosen locally' },
  });
  expect(pages.get(id)?.nickname?.value).toBe('Chosen locally');
  expect(api.poke).not.toHaveBeenCalledWith(
    expect.objectContaining({
      json: expect.objectContaining({ edit: expect.anything() }),
    })
  );
  resetDb();
  await syncContacts();
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    customNickname: 'Chosen locally',
    nickname: 'Chosen locally',
  });
});

test.each([null, 'Stale local name'])(
  'a newer authoritative custom name wins over captured local name %s and is reconciled locally',
  async (customNickname) => {
    await db.upsertContact({
      id,
      customNickname,
      isContact: false,
    });
    const poke = vi.mocked(api.poke).getMockImplementation()!;
    vi.mocked(api.poke).mockImplementationOnce(async (request) => {
      pages.set(id, {
        nickname: { type: 'text', value: 'New authoritative name' },
      });
      return poke(request);
    });
    await syncContactDiscovery(undefined, { invokeHandler: false });
    expect(pages.get(id)?.nickname?.value).toBe('New authoritative name');
    expect(await db.getContact({ id })).toMatchObject({
      isContact: true,
      customNickname: 'New authoritative name',
    });
  }
);

test('confirmation of a promoted name cannot overwrite a later local user edit', async () => {
  await db.upsertContact({
    id,
    customNickname: 'Original local name',
    isContact: false,
  });
  const waiting = createDeferred<void>();
  const release = createDeferred<void>();
  const read = api.getContactState;
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => read())
    .mockImplementationOnce(async () => {
      const state = await read();
      waiting.resolve();
      await release.promise;
      return state;
    });
  const adding = addContacts([id], { source: 'discovery' });
  await waiting.promise;
  await updateContactMetadata(id, { nickname: 'Later user edit' });
  release.resolve();
  await adding;
  expect(pages.get(id)?.nickname?.value).toBe('Later user edit');
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    customNickname: 'Later user edit',
  });
});

test('a cached named profile remains eligible after an add failure and retries with its original name', async () => {
  await db.upsertContact({
    id,
    customNickname: 'Keep this name',
    peerNickname: 'Cached peer',
    isContact: false,
  });
  vi.mocked(api.poke).mockRejectedValueOnce(new Error('offline'));
  expect(await syncContactDiscovery()).toMatchObject({
    didSucceed: false,
    newMatches: [],
  });
  expect(announce).not.toHaveBeenCalled();
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    customNickname: 'Keep this name',
  });
  expect((await syncContactDiscovery()).newMatches).toEqual([[phone, id]]);
  expect(pages.get(id)?.nickname?.value).toBe('Keep this name');
  expect(announce).toHaveBeenCalledWith([id]);
  expect(announce).toHaveBeenCalledTimes(1);
});

test('several numbers preserve all onboarding matches while yielding one save, indicator and handler recipient', async () => {
  matches = [
    [phone, id],
    ['+15555550124', id],
    ['+15555550125', id],
  ];
  const systemContacts = matches.map(([phoneNumber], index) => ({
    id: `native-${index}`,
    firstName: 'Same person',
    phoneNumber,
  }));
  native.getSystemContacts.mockResolvedValue(systemContacts);
  await db.insertSystemContacts({ systemContacts });
  await db.upsertContact({ id, peerNickname: 'Cached peer', isContact: false });
  expect((await syncContactDiscovery()).newMatches).toEqual(matches);
  expect(announce).toHaveBeenCalledWith([id]);
  expect(announce).toHaveBeenCalledTimes(1);
  expect(
    vi
      .mocked(api.poke)
      .mock.calls.filter(([request]) => request.mark === 'contact-discover-1')
  ).toHaveLength(1);
  expect(
    (await db.getContactsBatch({ contactIds: [id] })).filter(
      (contact) => contact.matchedAt
    )
  ).toHaveLength(1);
  expect(
    new Set(
      (await db.getSystemContactsBatchByContactId([id])).map(
        (contact) => contact.phoneNumber
      )
    ).size
  ).toBe(3);
});

test('distinct successful people are emitted together once while a failed person remains retryable', async () => {
  const failure = '~zod';
  matches = [
    [phone, id],
    ['+15555550124', id],
    ['+15555550125', other],
    ['+15555550126', failure],
  ];
  const systemContacts = matches.map(([phoneNumber], index) => ({
    id: `native-${index}`,
    firstName: 'Synthetic person',
    phoneNumber,
  }));
  native.getSystemContacts.mockResolvedValue(systemContacts);
  await db.insertSystemContacts({ systemContacts });
  const poke = vi.mocked(api.poke).getMockImplementation()!;
  vi.mocked(api.poke).mockImplementation(async (request) => {
    if (
      request.mark === 'contact-discover-1' &&
      (request.json as { kip: string }).kip === failure
    )
      throw new Error('offline');
    return poke(request);
  });
  expect(await syncContactDiscovery()).toMatchObject({
    didSucceed: false,
    newMatches: [
      [phone, id],
      ['+15555550124', id],
      ['+15555550125', other],
    ],
  });
  expect(announce).toHaveBeenCalledWith([id, other]);
  expect(announce).toHaveBeenCalledTimes(1);
  expect(pages.has(failure)).toBe(false);
});

test('Remove and Decline persist across profile-only retries and a cache rebuild until explicit Add', async () => {
  pages.set(id, { nickname: { type: 'text', value: 'Saved before removal' } });
  await syncContacts();
  await db.linkSystemContacts({ matches });
  await removeContact(id);
  await removeContactSuggestion(id);
  resetDb();
  await syncContacts();
  expect((await syncContactDiscovery()).newMatches).toEqual([]);
  expect(announce).not.toHaveBeenCalled();
  expect(pages.has(id)).toBe(false);
  await addContact(id);
  expect(pages.has(id)).toBe(true);
  expect(declined.has(id)).toBe(false);
});

test('a session switch while discovery is pending cancels saves, metadata, cursor writes and notifications', async () => {
  const waiting = createDeferred<void>();
  const release = createDeferred<void>();
  vi.mocked(api.discoverContacts).mockImplementationOnce(async () => {
    waiting.resolve();
    await release.promise;
    return { matches, nextSalt: 'old-session-salt' };
  });
  const cursor = vi.spyOn(db.lastLanyardSalt, 'setValue');
  const request = syncContactDiscovery();
  await waiting.promise;
  updateInitializedClient(false);
  release.resolve();
  expect((await request).newMatches).toEqual([]);
  expect(cursor).not.toHaveBeenCalled();
  expect(api.poke).not.toHaveBeenCalled();
  expect(announce).not.toHaveBeenCalled();
});

test.each([
  { nickname: { type: 'text' as const, value: 'Authoritative peer name' } },
  { avatar: { type: 'look' as const, value: 'https://example.test/peer.png' } },
  { cover: { type: 'look' as const, value: 'https://example.test/cover.png' } },
  { bio: { type: 'text' as const, value: 'Authoritative biography' } },
  { status: { type: 'text' as const, value: 'Authoritative status' } },
])(
  'a profile cached on the ship is eligible independently of its fields: %j',
  async (profile) => {
    directory[id] = { isContact: false, contact: profile, mod: {} };
    expect((await syncContactDiscovery()).newMatches).toEqual([[phone, id]]);
    expect(announce).toHaveBeenCalledWith([id]);
    expect(announce).toHaveBeenCalledTimes(1);
  }
);

test('a failed address-book name write keeps the successful save and retries only naming on the next scan', async () => {
  await db.upsertContact({ id, peerNickname: 'Cached peer', isContact: false });
  const poke = vi.mocked(api.poke).getMockImplementation()!;
  vi.mocked(api.poke).mockImplementation(async (request) => {
    if (
      request.mark === 'contact-action-1' &&
      'edit' in (request.json as object)
    )
      throw new Error('name write unavailable');
    return poke(request);
  });
  expect(await syncContactDiscovery()).toMatchObject({
    didSucceed: false,
    newMatches: [[phone, id]],
  });
  expect(pages.has(id)).toBe(true);
  expect(announce).toHaveBeenCalledWith([id]);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    customNickname: null,
  });
  vi.mocked(api.poke).mockImplementation(poke);
  announce.mockClear();
  expect(await syncContactDiscovery()).toMatchObject({
    didSucceed: true,
    newMatches: [],
  });
  expect(pages.get(id)?.nickname?.value).toBe('Address Book');
  expect(announce).not.toHaveBeenCalled();
});

test.each(['Remove', 'Decline'] as const)(
  '%s while cached-profile discovery is in flight cancels its later indicator, name write and notification',
  async (decision) => {
    await db.upsertContact({
      id,
      peerNickname: 'Cached peer',
      customNickname: 'Existing local name',
      isContact: false,
    });
    const dispatched = createDeferred<void>();
    const release = createDeferred<void>();
    const poke = vi.mocked(api.poke).getMockImplementation()!;
    vi.mocked(api.poke).mockImplementationOnce(async (request) => {
      await poke(request);
      dispatched.resolve();
      await release.promise;
      return 1;
    });
    const discovery = syncContactDiscovery();
    await dispatched.promise;
    if (decision === 'Remove') await removeContact(id);
    else await removeContactSuggestion(id);
    release.resolve();
    expect((await discovery).newMatches).toEqual([]);
    expect(pages.has(id)).toBe(false);
    expect(announce).not.toHaveBeenCalled();
    expect(await db.getContact({ id })).toMatchObject({
      isContact: false,
      isContactSuggestion: decision === 'Remove',
      matchedAt: null,
      customNickname: 'Existing local name',
    });
  }
);
