import * as api from '@tloncorp/api';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('./systemContactsApi', () => ({ getSystemContacts: async () => [] }));

import * as db from '../db';
import { resetDb, setupDatabaseTestSuite } from '../test/helpers';
import { createDeferred } from '../utils/deferred';
import {
  addContact,
  addContacts,
  removeContact,
  removeContactSuggestion,
} from './contactActions';
import { partitionDiscoveryMatches } from './lanyardActions';
import { updateInitializedClient } from './session';
import {
  syncAppInfo,
  syncReactionSupport,
  handleContactUpdate,
} from './sync/sync';
import {
  syncContactDecisionSupport,
  syncContactSuggestions,
  syncContacts,
} from './sync/syncContacts';

setupDatabaseTestSuite();
const id = '~nec';
let saved: Set<string>;
let declined: Set<string>;
let hidden: Set<string>;
let suggestions: Set<string>;

beforeEach(async () => {
  api.setDeskSupportsContactRemoval(true);
  api.setDeskSupportsContactDecisions(true);
  saved = new Set();
  declined = new Set();
  hidden = new Set();
  suggestions = new Set([id]);
  vi.mocked(api.scry).mockImplementation(async ({ app, path }) => {
    if (app === 'groups-ui' && path === '/v1/contact-decline-protection')
      return true;
    if (path === '/v3/init')
      return {
        directory: {},
        book: Object.fromEntries([...saved].map((ship) => [ship, [{}, {}]])),
        removed: [],
        declined: [...declined],
      };
    // Deliberately model a delayed suggestion echo: the client still must
    // apply the authoritative declined set from contacts.
    if (path === '/suggested-contacts') return [...suggestions];
    if (path === '/hidden-contact-suggestions') return [...hidden];
    throw new Error(`Unexpected scry ${path}`);
  });
  vi.mocked(api.poke).mockImplementation(async ({ mark, json }) => {
    const ship = json as string;
    if (mark === 'contact-decline-1') {
      saved.delete(ship);
      declined.add(ship);
      hidden.add(ship);
    } else if (mark === 'contact-discover' || mark === 'contact-discover-1') {
      const ship =
        mark === 'contact-discover-1'
          ? (json as { kip: string }).kip
          : (json as string);
      if (!declined.has(ship) && !hidden.has(ship) && !suggestions.has(ship))
        saved.add(ship);
    } else if (mark === 'contact-remove') {
      saved.delete((json as { kip: string }).kip);
    } else if (mark === 'contact-action-1') {
      const kip = (json as { page: { kip: string } }).page.kip;
      saved.add(kip);
      declined.delete(kip);
    } else throw new Error(`Unexpected poke ${mark}`);
    return 1;
  });
  await db.upsertContact({ id, isContact: false, isContactSuggestion: true });
});

afterEach(() => {
  api.setDeskSupportsContactRemoval(null);
  api.setDeskSupportsContactDecisions(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test('Decline persists for a never-saved suggestion through discovery, late suggestion echo and cache rebuild', async () => {
  await removeContactSuggestion(id);
  expect(declined.has(id)).toBe(true);
  expect(await addContacts([id], { source: 'discovery' })).toEqual({
    addedContactIds: [],
    failedContactIds: [],
  });
  expect(
    await partitionDiscoveryMatches([['+15555550123', id]], { isMocked: false })
  ).toMatchObject({ newMatches: [] });
  await syncContactSuggestions([id]);
  expect(await db.getSuggestedContacts()).toEqual([]);
  resetDb();
  await syncContacts();
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: false,
  });
});

test('Decline action membership writes leave concurrent local name edits for the authoritative wipe to reconcile', async () => {
  suggestions.clear();
  await db.updateContact({ id, isContactSuggestion: false });
  expect(
    (await addContacts([id], { source: 'discovery' })).addedContactIds
  ).toEqual([id]);
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  const poke = vi.mocked(api.poke).getMockImplementation()!;
  vi.mocked(api.poke).mockImplementationOnce(async (request) => {
    dispatch.resolve();
    await release.promise;
    return poke(request);
  });
  const decision = removeContactSuggestion(id);
  await dispatch.promise;
  await db.updateContact({ id, customNickname: 'Edited while declining' });
  release.resolve();
  await decision;
  expect(saved.has(id)).toBe(false);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    customNickname: 'Edited while declining',
  });
  await handleContactUpdate({ type: 'removeContact', contactId: id });
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: false,
    customNickname: null,
  });
});

test('failed Decline restores membership only and keeps a name edited while the poke was pending', async () => {
  saved.add(id);
  await db.updateContact({ id, isContact: true, customNickname: 'Before' });
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  vi.mocked(api.poke).mockImplementationOnce(async () => {
    dispatch.resolve();
    await release.promise;
    throw new Error('offline');
  });
  const decision = removeContactSuggestion(id);
  await dispatch.promise;
  await db.updateContact({
    id,
    customNickname: 'After',
    bio: 'Peer biography',
  });
  release.resolve();
  await decision;
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: true,
    customNickname: 'After',
    bio: 'Peer biography',
  });
});

test.each(['add', 'bulk add'] as const)(
  'a pending Decline finishes before a later explicit %s is dispatched',
  async (action) => {
    const dispatch = createDeferred<void>();
    const release = createDeferred<void>();
    const poke = vi.mocked(api.poke).getMockImplementation()!;
    vi.mocked(api.poke).mockImplementationOnce(async (request) => {
      dispatch.resolve();
      await release.promise;
      return poke(request);
    });
    const decline = removeContactSuggestion(id);
    await dispatch.promise;
    const add = action === 'add' ? addContact(id) : addContacts([id]);
    await Promise.resolve();
    expect(api.poke).toHaveBeenCalledTimes(1);
    release.resolve();
    await Promise.all([decline, add]);
    expect(saved.has(id)).toBe(true);
    expect(declined.has(id)).toBe(false);
    expect(await db.getContact({ id })).toMatchObject({
      isContact: true,
      isContactSuggestion: false,
    });
  }
);

test('a pending explicit Add finishes before a later Decline is dispatched', async () => {
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  const poke = vi.mocked(api.poke).getMockImplementation()!;
  vi.mocked(api.poke).mockImplementationOnce(async (request) => {
    dispatch.resolve();
    await release.promise;
    return poke(request);
  });
  const add = addContact(id);
  await dispatch.promise;
  const decline = removeContactSuggestion(id);
  release.resolve();
  await Promise.all([add, decline]);
  expect(saved.has(id)).toBe(false);
  expect(declined.has(id)).toBe(true);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: false,
  });
});

test('queued explicit decisions retain their original session generation', async () => {
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  vi.mocked(api.poke).mockImplementationOnce(async () => {
    dispatch.resolve();
    await release.promise;
    return 1;
  });
  const first = addContact(id);
  await dispatch.promise;
  const queued = removeContactSuggestion('~bud');
  updateInitializedClient(false);
  release.resolve();
  await Promise.all([first, queued]);
  expect(api.poke).toHaveBeenCalledTimes(1);
  expect(await db.getContact({ id: '~bud' })).toBeNull();
});

test('a full refresh issued before Decline cannot restore membership or a suggestion after it completes', async () => {
  const state = createDeferred<void>();
  const release = createDeferred<void>();
  const getContacts = api.getContacts;
  vi.spyOn(api, 'getContacts').mockImplementationOnce(async () => {
    const snapshot = await getContacts();
    state.resolve();
    await release.promise;
    return snapshot;
  });
  const refresh = syncContacts();
  await state.promise;
  await removeContactSuggestion(id);
  release.resolve();
  await refresh;
  expect(await db.getSuggestedContacts()).toEqual([]);
});

test('an authoritative state read failure remains retryable and sends no discovery poke', async () => {
  vi.mocked(api.scry).mockRejectedValueOnce(
    new api.BadResponseError(503, 'unavailable')
  );
  expect(await addContacts([id], { source: 'discovery' })).toEqual({
    addedContactIds: [],
    failedContactIds: [id],
  });
  expect(api.poke).not.toHaveBeenCalled();
  expect(await db.getContact({ id })).toMatchObject({
    isContact: false,
    isContactSuggestion: true,
  });
});

test('Remove, Add and Decline share one explicit-decision queue', async () => {
  saved.add(id);
  await db.updateContact({ id, isContact: true });
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  const poke = vi.mocked(api.poke).getMockImplementation()!;
  vi.mocked(api.poke).mockImplementationOnce(async (request) => {
    dispatch.resolve();
    await release.promise;
    return poke(request);
  });
  const remove = removeContact(id);
  await dispatch.promise;
  const add = addContact(id);
  release.resolve();
  await Promise.all([remove, add]);
  expect(saved.has(id)).toBe(true);
});

test('complete capability requires both agents and distinguishes unsupported from transient/auth failures', async () => {
  await syncContactDecisionSupport('12.5.0');
  expect(api.getDeskSupportsContactDecisionsState()).toBe(true);
  expect(api.scry).toHaveBeenNthCalledWith(1, {
    app: 'contacts',
    path: '/v3/init',
  });
  expect(api.scry).toHaveBeenNthCalledWith(2, {
    app: 'groups-ui',
    path: '/v1/contact-decline-protection',
  });
  vi.mocked(api.scry).mockRejectedValueOnce(
    new api.BadResponseError(404, 'missing')
  );
  await syncContactDecisionSupport('12.5.0');
  expect(api.getDeskSupportsContactDecisionsState()).toBe(false);
  for (const status of [403, 503]) {
    vi.mocked(api.scry).mockRejectedValueOnce(
      new api.BadResponseError(status, 'failed')
    );
    await expect(syncContactDecisionSupport('12.5.0')).rejects.toMatchObject({
      status,
    });
    expect(api.getDeskSupportsContactDecisionsState()).toBeNull();
  }
  vi.mocked(api.scry).mockClear();
  for (const version of ['12.4.0', 'unknown', null, undefined]) {
    await syncContactDecisionSupport(version);
    expect(api.getDeskSupportsContactDecisionsState()).toBe(false);
  }
  expect(api.scry).not.toHaveBeenCalled();
});

test.each([404, 403, 503])(
  'a successful contacts probe does not hide a groups-ui marker failure (%s)',
  async (status) => {
    api.setDeskSupportsContactDecisions(null);
    const scry = vi.mocked(api.scry).getMockImplementation()!;
    vi.mocked(api.scry).mockImplementation(async (request) => {
      if (
        request.app === 'groups-ui' &&
        request.path === '/v1/contact-decline-protection'
      ) {
        throw new api.BadResponseError(status, 'groups-ui probe failed');
      }
      return scry(request);
    });
    const probe = syncContactDecisionSupport('12.5.0');
    if (status === 404) {
      await expect(probe).resolves.toBeUndefined();
      expect(api.getDeskSupportsContactDecisionsState()).toBe(false);
    } else {
      await expect(probe).rejects.toMatchObject({ status });
      expect(api.getDeskSupportsContactDecisionsState()).toBeNull();
    }
    expect(api.scry).toHaveBeenCalledTimes(2);
    expect(api.scry).toHaveBeenNthCalledWith(1, {
      app: 'contacts',
      path: '/v3/init',
    });
    expect(api.scry).toHaveBeenNthCalledWith(2, {
      app: 'groups-ui',
      path: '/v1/contact-decline-protection',
    });
  }
);

test('a superseded failed Add rolls back before the latest queued Add can treat it as saved', async () => {
  const dispatch = createDeferred<void>();
  const release = createDeferred<void>();
  vi.mocked(api.poke).mockImplementationOnce(async () => {
    dispatch.resolve();
    await release.promise;
    throw new Error('first add rejected');
  });
  const first = addContact(id);
  await dispatch.promise;
  const supersededDecline = removeContactSuggestion(id);
  const latestAdd = addContact(id);
  release.resolve();
  await Promise.all([first, supersededDecline, latestAdd]);
  expect(saved.has(id)).toBe(true);
  expect(declined.has(id)).toBe(false);
  expect(api.poke).toHaveBeenCalledTimes(2);
  expect(await db.getContact({ id })).toMatchObject({
    isContact: true,
    isContactSuggestion: false,
  });
});

test.each(['app info', 'persisted capabilities'] as const)(
  'a pending %s capability probe cannot apply old flags or app info after an account switch',
  async (source) => {
    const probing = createDeferred<void>();
    const release = createDeferred<void>();
    api.setDeskSupportsContactDecisions(null);
    vi.spyOn(api, 'getAppInfo').mockResolvedValue({
      groupsVersion: '12.5.0',
      groupsHash: 'synthetic',
      groupsSyncNode: '~zod',
    });
    vi.spyOn(db.appInfo, 'getValue').mockResolvedValue({
      groupsVersion: '12.5.0',
      groupsHash: 'synthetic',
      groupsSyncNode: '~zod',
    });
    const persist = vi.spyOn(db.appInfo, 'setValue');
    const buckets = vi.spyOn(api, 'setDeskSupportsBuckets');
    vi.spyOn(api, 'probeContactDecisions').mockImplementationOnce(async () => {
      probing.resolve();
      await release.promise;
    });
    const sync = source === 'app info' ? syncAppInfo() : syncReactionSupport();
    await probing.promise;
    updateInitializedClient(false);
    release.resolve();
    await sync;
    expect(persist).not.toHaveBeenCalled();
    expect(buckets).not.toHaveBeenCalled();
    expect(api.getDeskSupportsContactDecisionsState()).toBeNull();
  }
);

test('a full refresh preserves attestations on an intent-changed row while updating another contact', async () => {
  const other = '~bud';
  await db.upsertContact({ id: other, peerNickname: 'Before refresh' });
  await db.resetContactAttestations({
    contactId: id,
    attestations: [
      {
        contactId: id,
        attestationId: 'synthetic-phone-proof',
        attestation: {
          id: 'synthetic-phone-proof',
          contactId: id,
          provider: 'test',
          type: 'phone',
          value: '+15555550123',
          status: 'verified',
          discoverability: 'verified',
        },
      },
    ],
  });
  const fetching = createDeferred<void>();
  const release = createDeferred<void>();
  vi.spyOn(api, 'getContacts').mockImplementationOnce(async () => {
    fetching.resolve();
    await release.promise;
    return [
      { id, isContact: false, isContactSuggestion: true, attestations: [] },
      { id: other, peerNickname: 'After refresh' },
    ];
  });
  const refresh = syncContacts();
  await fetching.promise;
  await removeContactSuggestion(id);
  release.resolve();
  await refresh;
  expect((await db.getContact({ id }))?.attestations).toEqual([
    expect.objectContaining({ attestationId: 'synthetic-phone-proof' }),
  ]);
  expect(await db.getContact({ id: other })).toMatchObject({
    peerNickname: 'After refresh',
  });
  expect(await db.getSuggestedContacts()).toEqual([]);
});

test.each(['full', 'suggestions'] as const)(
  'a %s refresh started during a pending Decline cannot re-expose its pre-decline response',
  async (kind) => {
    const dispatched = createDeferred<void>();
    const releasePoke = createDeferred<void>();
    const poke = vi.mocked(api.poke).getMockImplementation()!;
    vi.mocked(api.poke).mockImplementationOnce(async (request) => {
      dispatched.resolve();
      await releasePoke.promise;
      return poke(request);
    });
    const decline = removeContactSuggestion(id);
    await dispatched.promise;
    const fetching = createDeferred<void>();
    const releaseSnapshot = createDeferred<void>();
    const getContacts = api.getContacts;
    vi.spyOn(api, 'getContacts').mockImplementationOnce(async () => {
      const state = await getContacts();
      fetching.resolve();
      await releaseSnapshot.promise;
      return state;
    });
    const refresh =
      kind === 'full' ? syncContacts() : syncContactSuggestions([id]);
    await fetching.promise;
    releasePoke.resolve();
    await decline;
    releaseSnapshot.resolve();
    await refresh;
    expect(await db.getContact({ id })).toMatchObject({
      isContact: false,
      isContactSuggestion: false,
    });
  }
);

test.each(['single', 'bulk'] as const)(
  'explicit %s Add confirms membership rather than adopting a failed discovery optimistic row',
  async (kind) => {
    suggestions.clear();
    await db.updateContact({ id, isContactSuggestion: false });
    const dispatched = createDeferred<void>();
    const rejectDiscovery = createDeferred<void>();
    vi.mocked(api.poke).mockImplementationOnce(async () => {
      dispatched.resolve();
      await rejectDiscovery.promise;
      throw new Error('discovery rejected');
    });
    const discovery = addContacts([id], { source: 'discovery' });
    await dispatched.promise;
    expect(await db.getContact({ id })).toMatchObject({ isContact: true });
    const explicit = kind === 'single' ? addContact(id) : addContacts([id]);
    await explicit;
    rejectDiscovery.resolve();
    expect(await discovery).toMatchObject({ addedContactIds: [] });
    expect(saved.has(id)).toBe(true);
    expect(api.poke).toHaveBeenCalledWith(
      expect.objectContaining({ mark: 'contact-action-1' })
    );
    expect(await db.getContact({ id })).toMatchObject({
      isContact: true,
      isContactSuggestion: false,
    });
  }
);

test('a failed hidden-suggestion read does not become an empty suppression set', async () => {
  suggestions.clear();
  hidden.add(id);
  const scry = vi.mocked(api.scry).getMockImplementation()!;
  vi.mocked(api.scry).mockImplementation(async (request) => {
    if (request.path === '/hidden-contact-suggestions')
      throw new api.BadResponseError(503, 'unavailable');
    return scry(request);
  });
  expect(await addContacts([id], { source: 'discovery' })).toEqual({
    addedContactIds: [],
    failedContactIds: [id],
  });
  expect(api.poke).not.toHaveBeenCalled();
});

test('retrying a failed capability probe never downgrades previously confirmed Decline protection', async () => {
  vi.spyOn(api, 'probeContactDecisions').mockRejectedValueOnce(
    new api.BadResponseError(503, 'unavailable')
  );
  const probe = syncContactDecisionSupport('12.5.0');
  expect(api.getDeskSupportsContactDecisionsState()).toBe(true);
  await expect(probe).rejects.toMatchObject({ status: 503 });
  expect(api.getDeskSupportsContactDecisionsState()).toBe(true);
});
