import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSystemContacts: vi.fn() }));
vi.mock('./systemContactsApi', () => ({
  getSystemContacts: mocks.getSystemContacts,
}));

import * as db from '../db';
import { resetDb, setupDatabaseTestSuite } from '../test/helpers';
import {
  addContact,
  addContacts,
  removeContact,
  removeContactSuggestion,
} from './contactActions';
import {
  partitionDiscoveryMatches,
  setContactsMatchedHandler,
} from './lanyardActions';
import { syncContactDiscovery } from './sync/sync';
import { syncContacts } from './sync/syncContacts';

setupDatabaseTestSuite();
const id = '~nec';
const phone = '+15555550123';
let saved: Set<string>;
let removed: Map<string, boolean>;
let hidden: Set<string>;
let suggested: Set<string>;

beforeEach(async () => {
  api.setDeskSupportsContactRemoval(true);
  mocks.getSystemContacts.mockResolvedValue([
    { id: 'phone', phoneNumber: phone },
  ]);
  saved = new Set([id]);
  removed = new Map();
  hidden = new Set([id]);
  suggested = new Set();
  const initiate = (ship: string) => {
    if (removed.get(ship) === false) {
      removed.set(ship, true);
      hidden.delete(ship);
      suggested.add(ship);
    }
  };
  vi.mocked(api.scry).mockImplementation(async ({ path }) => {
    if (path === '/v2/init')
      return {
        directory: {},
        book: Object.fromEntries([...saved].map((ship) => [ship, [{}, {}]])),
        removed: [...removed.keys()],
      };
    if (path === '/suggested-contacts')
      return [...suggested].filter((ship) => !hidden.has(ship));
    throw new Error(`unexpected scry ${path}`);
  });
  vi.mocked(api.poke).mockImplementation(async ({ mark, json }) => {
    if (mark === 'contact-remove') {
      const action = json as { kip: string; suggest: boolean };
      saved.delete(action.kip);
      removed.set(action.kip, false);
      if (action.suggest) initiate(action.kip);
    } else if (mark === 'contact-discover') {
      const ship = json as string;
      if (removed.has(ship)) initiate(ship);
      else saved.add(ship);
    } else if (mark === 'ui-hide-contact') hidden.add(json as string);
    else if (mark === 'contact-action-1') {
      const action = json as { page: { kip: string } };
      saved.add(action.page.kip);
      hidden.add(action.page.kip);
      removed.delete(action.page.kip);
    } else throw new Error(`unexpected poke ${mark}`);
    return 1;
  });
  await db.insertSystemContacts({
    systemContacts: [{ id: 'phone', phoneNumber: phone, contactId: id }],
  });
  await syncContacts();
});

afterEach(() => {
  setContactsMatchedHandler(null);
  api.setDeskSupportsContactRemoval(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('Remove becomes a suggestion, survives cache purge, repeated discovery, and explicit Add', async () => {
  await removeContact(id);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  resetDb();
  await syncContacts();
  expect(await db.getSuggestedContacts()).toEqual([
    expect.objectContaining({ id }),
  ]);
  for (let run = 0; run < 2; run++) {
    const partition = await partitionDiscoveryMatches([[phone, id]], {
      isMocked: false,
    });
    expect(partition).toMatchObject({
      newMatches: [],
      removedMatches: [[phone, id]],
    });
    expect(await addContacts([id], { source: 'discovery' })).toEqual({
      addedContactIds: [],
      failedContactIds: [],
    });
    expect((await db.getContact({ id }))?.matchedAt).toBeNull();
  }
  expect(saved.has(id)).toBe(false);
  await addContact(id);
  expect(saved.has(id)).toBe(true);
  expect(removed.has(id)).toBe(false);
  expect(api.poke).not.toHaveBeenCalledWith(
    expect.objectContaining({ mark: 'ui-hide-contact' })
  );
  await db.insertSystemContacts({
    systemContacts: [{ id: 'phone', phoneNumber: phone, contactId: id }],
  });
  await removeContact(id);
  expect(await db.getSuggestedContacts()).toEqual([
    expect.objectContaining({ id }),
  ]);
  await addContact(id);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
});

test('Decline after Remove remains declined during discovery and restart', async () => {
  await removeContact(id);
  await removeContactSuggestion(id);
  await addContacts([id], { source: 'discovery' });
  resetDb();
  await syncContacts();
  expect(await db.getSuggestedContacts()).toEqual([]);
  expect(saved.has(id)).toBe(false);
  expect(removed.get(id)).toBe(true);
});

test('a non-phone removal is suggested once it is later discovered in the phone book', async () => {
  mocks.getSystemContacts.mockResolvedValue([]);
  await removeContact(id);
  expect(await db.getSuggestedContacts()).toEqual([]);
  expect(removed.get(id)).toBe(false);
  await addContacts([id], { source: 'discovery' });
  expect(await db.getSuggestedContacts()).toEqual([
    expect.objectContaining({ id }),
  ]);
  await removeContactSuggestion(id);
  await addContacts([id], { source: 'discovery' });
  expect(await db.getSuggestedContacts()).toEqual([]);
});

test('failed Remove restores the prior contact and suggestion flags', async () => {
  vi.mocked(api.poke).mockRejectedValueOnce(new Error('offline'));
  await removeContact(id);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
  expect(saved.has(id)).toBe(true);
});

test('a removal after discovery classification cannot be automatically added', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  removed.set(id, false);
  expect(await addContacts([id], { source: 'discovery' })).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,

    isContactSuggestion: true,
  });
  expect(saved.has(id)).toBe(false);
});

test('a deleted or inaccessible native phone book does not reuse a stale linked row', async () => {
  mocks.getSystemContacts.mockResolvedValue([]);
  await removeContact(id);
  expect(api.poke).toHaveBeenCalledWith({
    app: 'contacts',
    mark: 'contact-remove',
    json: { kip: id, suggest: false },
  });
  expect(await db.getSuggestedContacts()).toEqual([]);
});

test('failed explicit Add restores the removed suggestion snapshot', async () => {
  await removeContact(id);
  vi.mocked(api.poke).mockRejectedValueOnce(new Error('offline'));
  await addContact(id);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('repeated full discovery neither marks nor announces a removed suggestion', async () => {
  await removeContact(id);
  const announce = vi.fn();
  setContactsMatchedHandler(announce);
  vi.spyOn(api, 'discoverContacts').mockResolvedValue({
    matches: [[phone, id]],
    nextSalt: '0x1',
  });
  vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
  vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
    {
      id: 'phone-attestation',
      contactId: api.getCurrentUserId(),
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
  const readState = vi.spyOn(api, 'getContactState');
  for (let run = 0; run < 2; run++) {
    expect(await syncContactDiscovery()).toEqual({
      didSucceed: true,
      didDiscover: true,
      newMatches: [],
    });
    expect(readState).toHaveBeenCalledTimes((run + 1) * 2);
  }
  expect(announce).not.toHaveBeenCalled();
  expect(api.updateContactMetadata).not.toHaveBeenCalled();
  expect((await db.getContact({ id }))?.matchedAt).toBeNull();
  expect(saved.has(id)).toBe(false);
});

test('an older desk uses the existing wipe/show/manual suggestion projection', async () => {
  api.setDeskSupportsContactRemoval(false);
  vi.mocked(api.poke).mockResolvedValue(1);
  vi.mocked(api.scry).mockImplementation(async ({ path }) => {
    if (path === '/v1/directory') return {};
    if (path === '/v1/book') return {};
    if (path === '/suggested-contacts') return [id];
    throw new Error(`new desk request sent to old desk: ${path}`);
  });
  await removeContact(id);
  expect(api.poke).toHaveBeenCalledWith({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { wipe: [id] },
  });
  expect(api.poke).toHaveBeenCalledWith({
    app: 'groups-ui',
    mark: 'ui-show-contact',
    json: id,
  });
  expect(api.poke).toHaveBeenCalledWith({
    app: 'groups-ui',
    mark: 'ui-add-contact-suggestions',
    json: [id],
  });
  expect(await db.getSuggestedContacts()).toEqual([
    expect.objectContaining({ id }),
  ]);
});

test('a failed legacy hide does not stop an explicit Add on an older desk', async () => {
  api.setDeskSupportsContactRemoval(false);
  vi.mocked(api.poke)
    .mockRejectedValueOnce(new Error('hide failed'))
    .mockResolvedValueOnce(1);
  await expect(api.addContact('~bud')).resolves.toBe(1);
  expect(api.poke).toHaveBeenLastCalledWith({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { page: { kip: '~bud', contact: {} } },
  });
});

test('Remove while a discovery save is in flight wins over its stale classification', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  const apply = vi.mocked(api.poke).getMockImplementation()!;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.mocked(api.poke).mockImplementation(async (request) => {
    if (request.mark === 'contact-discover') {
      started();
      await waiting;
    }
    return apply(request);
  });
  const discovery = addContacts([id], { source: 'discovery' });
  await sent;
  await removeContact(id);
  release();
  expect(await discovery).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,

    isContactSuggestion: true,
  });
});

test('a never-removed fresh match can still be saved automatically', async () => {
  expect(await addContacts(['~bud'], { source: 'discovery' })).toEqual({
    addedContactIds: ['~bud'],
    failedContactIds: [],
  });
  expect(saved.has('~bud')).toBe(true);
  expect(await db.getContact({ id: '~bud' })).toMatchObject({
    isContact: true,
  });
});

test('an authoritative known profile keeps the existing discovery filter', async () => {
  resetDb();
  vi.mocked(api.scry).mockImplementation(async ({ path }) =>
    path === '/v2/init'
      ? {
          directory: {
            [id]: {
              isContact: false,
              contact: { nickname: { type: 'text', value: 'Known peer' } },
              mod: {},
            },
          },
          book: {},
          removed: [],
        }
      : []
  );
  expect(
    await partitionDiscoveryMatches([[phone, id]], { isMocked: false })
  ).toMatchObject({ newMatches: [], removedMatches: [] });
  expect(await db.getContact({ id })).toBeNull();
});

test('a partition snapshot issued before Remove cannot restore the removed contact', async () => {
  const beforeRemove = await api.getContactState();
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState').mockImplementationOnce(async () => {
    started();
    await waiting;
    return beforeRemove;
  });
  const partition = partitionDiscoveryMatches([[phone, id]], {
    isMocked: false,
  });
  await sent;
  await removeContact(id);
  const { handleContactUpdate } = await import('./sync/sync');
  await handleContactUpdate({ type: 'removeContact', contactId: id });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  release();
  const result = await partition;
  expect(result).toMatchObject({ newMatches: [], removedMatches: [] });
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('a Remove waiting on the address book must not mutate a new login', async () => {
  const { updateInitializedClient, getClientGeneration } =
    await import('./session');
  updateInitializedClient(true);
  const oldGeneration = getClientGeneration();
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  mocks.getSystemContacts.mockImplementationOnce(async () => {
    started();
    await waiting;
    return [{ id: 'phone', phoneNumber: phone }];
  });
  const removal = removeContact(id);
  await sent;
  expect(api.poke).not.toHaveBeenCalled();
  // These are the session-generation and database transitions on logout/login.
  updateInitializedClient(false);
  resetDb();
  updateInitializedClient(true);
  // The transport now addresses the new login's independent contact book.
  saved = new Set([id]);
  removed = new Map();
  suggested = new Set();
  hidden = new Set([id]);
  await syncContacts();
  expect(getClientGeneration()).not.toBe(oldGeneration);
  release();
  await removal;
  expect(saved.has(id)).toBe(true);
  expect(removed.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
  expect(api.poke).not.toHaveBeenCalled();
  updateInitializedClient(false);
});

test('a confirmation snapshot issued before Remove cannot restore the removed contact', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  const readState = api.getContactState;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      const beforeRemove = await readState();
      started();
      await waiting;
      return beforeRemove;
    });
  const discovery = addContacts([id], { source: 'discovery' });
  await sent;
  expect(saved.has(id)).toBe(true);
  await removeContact(id);
  const { handleContactUpdate } = await import('./sync/sync');
  await handleContactUpdate({ type: 'removeContact', contactId: id });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  release();
  const result = await discovery;
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  expect(result).toMatchObject({ addedContactIds: [] });
});

test('confirming B cannot restore an unrelated contact A removed during the read', async () => {
  const other = '~bud';
  const readState = api.getContactState;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      const state = await readState();
      started();
      await waiting;
      return state;
    });
  const discovery = addContacts([other], { source: 'discovery' });
  await sent;
  await removeContact(id);
  release();
  expect(await discovery).toEqual({
    addedContactIds: [other],
    failedContactIds: [],
  });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  expect(await db.getContact({ id: other })).toMatchObject({ isContact: true });
});

test('a failed discovery confirmation cannot roll back a later Remove suggestion', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  const readState = api.getContactState;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      started();
      await waiting;
      throw new Error('confirmation unavailable');
    });
  const discovery = addContacts([id], { source: 'discovery' });
  await sent;
  await removeContact(id);
  release();
  expect(await discovery).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('a discovery confirmation cannot undo a later Decline', async () => {
  await removeContact(id);
  const readState = api.getContactState;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      const state = await readState();
      started();
      await waiting;
      return state;
    });
  const discovery = addContacts([id], { source: 'discovery' });
  await sent;
  await removeContactSuggestion(id);
  release();
  expect(await discovery).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(await db.getSuggestedContacts()).toEqual([]);
});

test('a confirmation already queued for SQLite cannot overwrite a later Remove', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  const readState = api.getContactState;
  let releaseSnapshot!: () => void;
  let snapshotStarted!: () => void;
  const snapshotWaiting = new Promise<void>((resolve) => {
    releaseSnapshot = resolve;
  });
  const snapshotSent = new Promise<void>((resolve) => {
    snapshotStarted = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      const state = await readState();
      snapshotStarted();
      await snapshotWaiting;
      return state;
    });
  const discovery = addContacts([id], { source: 'discovery' });
  await snapshotSent;
  const { batchEffects, withTransactionCtx } = await import('../db/query');
  let releaseWriter!: () => void;
  let writerStarted!: () => void;
  const writerWaiting = new Promise<void>((resolve) => {
    releaseWriter = resolve;
  });
  const writerSent = new Promise<void>((resolve) => {
    writerStarted = resolve;
  });
  const writer = batchEffects('reviewPendingWriter', (ctx) =>
    withTransactionCtx(ctx, async () => {
      writerStarted();
      await writerWaiting;
    })
  );
  await writerSent;
  const upsert = db.applyContactMembership;
  let queued!: () => void;
  const confirmQueued = new Promise<void>((resolve) => {
    queued = resolve;
  });
  vi.spyOn(db, 'applyContactMembership').mockImplementationOnce((...args) => {
    const result = upsert(...args);
    queued();
    return result;
  });
  releaseSnapshot();
  await confirmQueued;
  await removeContact(id);
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
  releaseWriter();
  await writer;
  const result = await discovery;
  expect(result).toEqual({ addedContactIds: [], failedContactIds: [] });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('a buffered wipe from earlier Remove must not cancel a newer manual Add', async () => {
  await removeContact(id);
  const readContacts = api.getContacts;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContacts').mockImplementationOnce(async () => {
    const snapshot = await readContacts();
    started();
    await waiting;
    return snapshot;
  });
  const adding = addContacts([id], { source: 'manual' });
  await sent;
  const { handleContactUpdate } = await import('./sync/sync');
  // Deliver the earlier successful Remove's wipe while the newer manual Add
  // is waiting on its ordinary preflight network request.
  await handleContactUpdate({ type: 'removeContact', contactId: id });
  release();
  const result = await adding;
  expect({
    result,
    saved: saved.has(id),
    local: await db.getContact({ id }),
    pagePokes: vi
      .mocked(api.poke)
      .mock.calls.filter(([r]) => r.mark === 'contact-action-1'),
  }).toMatchObject({
    result: { addedContactIds: [id], failedContactIds: [] },
    saved: true,
    local: { isContact: true, isContactSuggestion: false },
  });
});

test('an observed removal from another client cancels stale discovery confirmation', async () => {
  saved.delete(id);
  await db.updateContact({ id, isContact: false });
  const readState = api.getContactState;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sent = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(api, 'getContactState')
    .mockImplementationOnce(() => readState())
    .mockImplementationOnce(async () => {
      const state = await readState();
      started();
      await waiting;
      return state;
    });
  const discovery = addContacts([id], { source: 'discovery' });
  await sent;
  // Another client's successful Remove changes the ship and emits a wipe.
  saved.delete(id);
  removed.set(id, true);
  hidden.delete(id);
  suggested.add(id);
  const { handleContactUpdate } = await import('./sync/sync');
  await handleContactUpdate({ type: 'removeContact', contactId: id });
  release();
  expect(await discovery).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('membership-only writes preserve profile overrides and attestation links', async () => {
  await db.updateContact({ id, customNickname: 'Chosen name' });
  await db.resetContactAttestations({
    contactId: id,
    attestations: [
      {
        contactId: id,
        attestationId: 'phone-proof',
        attestation: {
          id: 'phone-proof',
          contactId: id,
          provider: 'test',
          type: 'phone',
          value: phone,
          status: 'verified',
          discoverability: 'verified',
        },
      },
    ],
  });
  expect((await db.getContact({ id }))?.attestations).toHaveLength(1);
  expect(await addContacts([id])).toEqual({
    addedContactIds: [id],
    failedContactIds: [],
  });
  const contact = await db.getContact({ id });
  expect(contact?.customNickname).toBe('Chosen name');
  expect(contact?.attestations).toHaveLength(1);
});

test.each([
  ['single', 'single'],
  ['single', 'bulk'],
  ['bulk', 'single'],
  ['bulk', 'bulk'],
] as const)(
  'a pending %s Add still rolls back after a duplicate %s Add',
  async (initial, duplicate) => {
    await removeContact(id);
    let fail!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new Error('offline'));
    });
    const sent = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.mocked(api.poke).mockImplementationOnce(async () => {
      started();
      await waiting;
      return 1;
    });
    const adding = initial === 'single' ? addContact(id) : addContacts([id]);
    await sent;
    expect(await db.getContact({ id })).toMatchObject({
      isContact: true,
      isContactSuggestion: false,
    });
    if (duplicate === 'single') await addContact(id);
    else await addContacts([id]);
    fail();
    await adding;
    expect(saved.has(id)).toBe(false);
    expect(await db.getContact({ id })).toMatchObject({
      isContact: false,
      isContactSuggestion: true,
    });
  }
);

test('address-book read failure still removes without creating a suggestion', async () => {
  mocks.getSystemContacts.mockRejectedValueOnce(
    new Error('native read failed')
  );
  await removeContact(id);
  expect(api.poke).toHaveBeenCalledWith({
    app: 'contacts',
    mark: 'contact-remove',
    json: { kip: id, suggest: false },
  });
  expect(saved.has(id)).toBe(false);
  expect(removed.get(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: false,
  });
  await addContacts([id], { source: 'discovery' });
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('failed Remove after address-book read failure restores saved contact', async () => {
  mocks.getSystemContacts.mockRejectedValueOnce(
    new Error('native read failed')
  );
  vi.mocked(api.poke).mockRejectedValueOnce(new Error('offline'));
  await removeContact(id);
  expect(saved.has(id)).toBe(true);
  expect(removed.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
});

test.each(['removed', 'declined'] as const)(
  'phone-book names override an internal nickname on a %s match without saving it',
  async (status) => {
    await db.updateContact({ id, customNickname: 'Internal name' });
    const bookEntry = {
      id: 'phone',
      phoneNumber: phone,
      contactId: id,
      firstName: 'Phone',
      lastName: 'Book',
    };
    await db.insertSystemContacts({ systemContacts: [bookEntry] });
    mocks.getSystemContacts.mockResolvedValue([bookEntry]);
    await removeContact(id);
    if (status === 'declined') await removeContactSuggestion(id);
    const announce = vi.fn();
    setContactsMatchedHandler(announce);
    vi.spyOn(api, 'discoverContacts').mockResolvedValue({
      matches: [[phone, id]],
      nextSalt: '0x1',
    });
    vi.spyOn(api, 'updateContactMetadata').mockResolvedValue(1);
    vi.spyOn(db, 'getUserAttestations').mockResolvedValue([
      {
        id: 'phone-attestation',
        contactId: api.getCurrentUserId(),
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
    expect(await syncContactDiscovery()).toEqual({
      didSucceed: true,
      didDiscover: true,
      newMatches: [],
    });
    expect(await db.getContact({ id })).toMatchObject({
      isContact: false,
      isContactSuggestion: status === 'removed',
      customNickname: 'Phone Book',
      matchedAt: null,
    });
    expect(saved.has(id)).toBe(false);
    expect(api.updateContactMetadata).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  }
);
